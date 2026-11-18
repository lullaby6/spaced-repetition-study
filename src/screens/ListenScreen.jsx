import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { guessLanguage, shuffle } from '../lib/text.js'
import { InfoTip } from '../components/Tooltip.jsx'
import MarkedText from '../components/MarkedText.jsx'

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
const PAUSES = [0, 1, 2, 3, 5, 10]
const RATES = [0.8, 1, 1.2, 1.5, 1.75, 2]
const BETWEEN_QUESTIONS_MS = 1200

function sentences(text) {
  const parts = text.match(/[^.!?;:]+[.!?;:]*/g)?.map((s) => s.trim()).filter(Boolean)
  return parts?.length ? parts : [text]
}

// "Learn by listening": a playlist that reads each question, waits a moment to let you think, then
// reads the answer, and goes on to the next one. Uses the browser's speech synthesis.
// `saved` / `onSave`: this screen's settings, kept per bank.
export default function ListenScreen({ questions, saved = {}, onSave, onBack }) {
  const { t, lang } = useI18n()
  const topics = useMemo(() => [...new Set(questions.map((q) => q.topic))], [questions])
  // Saved topics: null means all (so topics added later are included too).
  const [selected, setSelected] = useState(
    () => new Set(saved.topics ? saved.topics.filter((tp) => topics.includes(tp)) : topics),
  )
  const [order, setOrder] = useState(saved.order ?? 'bank')
  const [pause, setPause] = useState(PAUSES.includes(saved.pause) ? saved.pause : 3)
  const [rate, setRate] = useState(RATES.includes(saved.rate) ? saved.rate : 1)
  const [loop, setLoop] = useState(saved.loop ?? false)
  const [showText, setShowText] = useState(saved.showText ?? true)
  const [shuffleSeed, setShuffleSeed] = useState(0)
  // All chosen topics one after another: grouped by topic (in bank order), announcing each topic.
  const [byTopic, setByTopic] = useState(saved.byTopic ?? true)
  // Playlist mode: after each answer it goes on to the next question by itself.
  const [autoNext, setAutoNext] = useState(saved.autoNext ?? true)

  // Save the settings whenever they change.
  const settingsToSave = useMemo(
    () => ({
      topics: selected.size === topics.length ? null : topics.filter((tp) => selected.has(tp)),
      order,
      pause,
      rate,
      loop,
      showText,
      byTopic,
      autoNext,
    }),
    [selected, topics, order, pause, rate, loop, showText, byTopic, autoNext],
  )
  const lastSaved = useRef(JSON.stringify(saved))
  useEffect(() => {
    const json = JSON.stringify(settingsToSave)
    if (json === lastSaved.current) return
    lastSaved.current = json
    onSave?.(settingsToSave)
  }, [settingsToSave, onSave])

  const list = useMemo(() => {
    const picked = questions.filter((q) => selected.has(q.topic))
    if (!byTopic) return order === 'random' ? shuffle(picked) : picked
    return topics.flatMap((topic) => {
      const ofTopic = picked.filter((q) => q.topic === topic)
      return order === 'random' ? shuffle(ofTopic) : ofTopic
    })
    // shuffleSeed: a new random order each time "random" is chosen again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, topics, selected, order, byTopic, shuffleSeed])

  const [index, setIndex] = useState(0)
  const [part, setPart] = useState('question') // question | gap | answer
  const [status, setStatus] = useState('idle') // idle | playing | paused | done
  const run = useRef(0) // ignores callbacks from cancelled speech
  const timer = useRef(null)
  // Latest settings for callbacks that run later.
  const live = useRef({})
  live.current = { list, pause, rate, loop, lang, t, byTopic, autoNext }

  const clearTimer = () => {
    clearTimeout(timer.current)
    timer.current = null
  }

  // Utterances being spoken are kept here: Chrome can garbage-collect them mid-speech and then never
  // fire `onend`, which would leave the playlist stuck.
  const utterances = useRef([])
  const watchdog = useRef(null)

  const speak = (text, voiceLang, id, onDone) => {
    synth.cancel()
    clearInterval(watchdog.current)
    let finished = false
    const done = () => {
      if (finished || run.current !== id) return
      finished = true
      clearInterval(watchdog.current)
      onDone()
    }
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(voiceLang))
    const parts = sentences(text)
    utterances.current = parts.map((s, i) => {
      const u = new SpeechSynthesisUtterance(s)
      u.lang = voiceLang
      u.rate = live.current.rate
      if (voice) u.voice = voice
      if (i === parts.length - 1) u.onend = done
      u.onerror = (e) => e.error !== 'interrupted' && e.error !== 'canceled' && done()
      synth.speak(u)
      return u
    })
    // Backup in case the browser stops talking without firing `onend`: once speech has started and then
    // been silent for a moment (nothing speaking or queued), carry on. Online voices can take a while
    // to start, so silence only counts after it started (or after a long wait if it never does).
    let started = false
    let silentTicks = 0
    let waitedTicks = 0
    utterances.current[0].onstart = () => {
      started = true
    }
    watchdog.current = setInterval(() => {
      if (run.current !== id) return clearInterval(watchdog.current)
      const busy = synth.speaking || synth.pending
      if (busy && synth.speaking) started = true
      if (!started) {
        if (++waitedTicks >= 25) done() // ~10 s without ever starting
        return
      }
      silentTicks = busy ? 0 : silentTicks + 1
      if (silentTicks >= 3) done()
    }, 400)
  }

  const play = useCallback((i, which = 'question') => {
    const { list: items, pause: wait, loop: again, lang: uiLang, t: tr, byTopic: grouped } = live.current
    if (!synth || !items.length) return
    const id = ++run.current
    clearTimer()
    const q = items[i]
    setIndex(i)
    setPart(which)
    setStatus('playing')
    const voiceLang = guessLanguage(q.answer, uiLang)
    if (which === 'question') {
      // When going by topics, a new topic is announced before its first question.
      const newTopic = grouped && (i === 0 || items[i - 1].topic !== q.topic)
      const intro = newTopic ? `${tr('listen.topicPrefix', { topic: q.topic })}. ` : ''
      speak(`${intro}${tr('listen.questionPrefix', { id: q.id })}. ${q.question}`, voiceLang, id, () => {
        setPart('gap')
        timer.current = setTimeout(() => run.current === id && play(i, 'answer'), wait * 1000)
      })
    } else {
      speak(q.answer, voiceLang, id, () => {
        const next = i + 1 < items.length ? i + 1 : again ? 0 : null
        if (next === null) {
          setStatus('done')
          return
        }
        // Playlist mode goes on by itself; otherwise it stops, ready on the next question.
        if (!live.current.autoNext) {
          setIndex(next)
          setPart('question')
          setStatus('paused')
          return
        }
        timer.current = setTimeout(() => run.current === id && play(next, 'question'), BETWEEN_QUESTIONS_MS)
      })
    }
  }, [])

  const stopAll = useCallback(() => {
    run.current++
    clearTimer()
    clearInterval(watchdog.current)
    synth?.cancel()
  }, [])

  const pausePlayback = () => {
    stopAll()
    setStatus('paused')
  }
  const resume = () => play(index, part === 'gap' ? 'answer' : part)
  const toggle = () => {
    if (status === 'playing') pausePlayback()
    else if (status === 'paused') resume()
    else play(status === 'done' ? 0 : index, 'question')
  }
  const go = (i) => play(Math.max(0, Math.min(list.length - 1, i)), 'question')

  // Stop when leaving the screen; reset when the playlist changes.
  useEffect(() => stopAll, [stopAll])
  useEffect(() => {
    stopAll()
    setIndex(0)
    setPart('question')
    setStatus('idle')
  }, [list, stopAll])

  // Headphone / lock-screen buttons where the browser supports them.
  useEffect(() => {
    const ms = navigator.mediaSession
    if (!ms || !list[index]) return undefined
    if (window.MediaMetadata) ms.metadata = new window.MediaMetadata({ title: list[index].question, artist: t('listen.title') })
    const handlers = { play: toggle, pause: toggle, nexttrack: () => go(index + 1), previoustrack: () => go(index - 1) }
    for (const [action, fn] of Object.entries(handlers)) {
      try {
        ms.setActionHandler(action, fn)
      } catch {
        /* action not supported */
      }
    }
    return () => {
      for (const action of Object.keys(handlers)) {
        try {
          ms.setActionHandler(action, null)
        } catch {
          /* ignore */
        }
      }
    }
  })

  const current = list[index]
  const toggleTopic = (topic) =>
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(topic)) next.delete(topic)
      else next.add(topic)
      return next
    })

  if (!synth) {
    return (
      <div className="card border border-base-300 bg-base-100">
        <div className="card-body items-center text-center">
          <p>{t('listen.unsupported')}</p>
          <button type="button" className="btn btn-primary" onClick={onBack}>
            {t('common.back')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="card-title">
                {t('listen.title')} <InfoTip text={t('listen.help')} />
              </h2>
              <p className="text-sm opacity-70">{t('listen.count', { count: list.length })}</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
              {t('common.back')}
            </button>
          </div>

          {/* Player */}
          <div className="rounded-box border border-primary/30 bg-primary/5 p-4">
            {current ? (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{t('listen.position', { n: index + 1, total: list.length })}</span>
                  <span className="opacity-60">· {current.topic}</span>
                  {status !== 'idle' && (
                    <span className="badge badge-primary badge-soft badge-sm">{t(`listen.part_${status === 'done' ? 'done' : part}`)}</span>
                  )}
                </div>
                {showText && (
                  <div className="space-y-2">
                    <p className={`text-lg font-semibold ${part === 'question' && status === 'playing' ? 'text-primary' : ''}`}>{current.question}</p>
                    {(part === 'answer' || status === 'done') && (
                      <p className={`leading-relaxed ${status === 'playing' ? 'text-primary' : ''}`}>
                        <MarkedText text={current.answer} keywords={current.cloze.blanks} />
                      </p>
                    )}
                    {part === 'gap' && status === 'playing' && <p className="text-sm italic opacity-70">{t('listen.thinking')}</p>}
                  </div>
                )}
              </>
            ) : (
              <p className="opacity-70">{t('listen.empty')}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button type="button" className="btn btn-circle btn-ghost" onClick={() => go(index - 1)} disabled={!list.length || index === 0} aria-label={t('listen.previous')} title={t('listen.previous')}>
                <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
                  <path d="M6 5h2v14H6zM20 5.5v13a.5.5 0 0 1-.8.4L9.6 12.4a.5.5 0 0 1 0-.8l9.6-6.5a.5.5 0 0 1 .8.4Z" />
                </svg>
              </button>
              <button type="button" className="btn btn-circle btn-primary btn-lg" onClick={toggle} disabled={!list.length} aria-label={status === 'playing' ? t('listen.pause') : t('listen.play')}>
                {status === 'playing' ? (
                  <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
                    <path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5Z" />
                  </svg>
                )}
              </button>
              <button type="button" className="btn btn-circle btn-ghost" onClick={() => go(index + 1)} disabled={!list.length || index >= list.length - 1} aria-label={t('listen.next')} title={t('listen.next')}>
                <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
                  <path d="M16 5h2v14h-2zM4 5.5v13a.5.5 0 0 0 .8.4l9.6-6.5a.5.5 0 0 0 0-.8L4.8 5.1a.5.5 0 0 0-.8.4Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Settings */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t('listen.pauseLabel')}</span>
              <select className="select select-bordered select-sm w-full" value={pause} onChange={(e) => setPause(Number(e.target.value))}>
                {PAUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === 0 ? t('listen.noPause') : s === 1 ? t('listen.oneSecond') : t('listen.seconds', { count: s })}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t('listen.rateLabel')}</span>
              <select className="select select-bordered select-sm w-full" value={rate} onChange={(e) => setRate(Number(e.target.value))}>
                {RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}×
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t('setup.examOrder')}</span>
              <select
                className="select select-bordered select-sm w-full"
                value={order}
                onChange={(e) => {
                  setOrder(e.target.value)
                  setShuffleSeed((s) => s + 1)
                }}
              >
                <option value="bank">{t('setup.examOrder_bank')}</option>
                <option value="random">{t('setup.examOrder_random')}</option>
              </select>
            </label>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} />
                {t('listen.autoNext')} <InfoTip text={t('listen.autoNextHelp')} />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={byTopic} onChange={(e) => setByTopic(e.target.checked)} />
                {t('listen.byTopic')} <InfoTip text={t('listen.byTopicHelp')} />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
                {t('listen.loop')}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={showText} onChange={(e) => setShowText(e.target.checked)} />
                {t('listen.showText')}
              </label>
            </div>
          </div>

          <fieldset className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <legend className="text-sm font-medium">{t('setup.topics')}</legend>
              <div className="flex gap-1">
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setSelected(new Set(topics))}>
                  {t('setup.all')}
                </button>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setSelected(new Set())}>
                  {t('setup.none')}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className={`btn btn-sm ${selected.has(topic) ? 'btn-primary' : 'btn-outline'}`}
                  aria-pressed={selected.has(topic)}
                  onClick={() => toggleTopic(topic)}
                >
                  {topic}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      {/* Playlist */}
      {list.length > 0 && (
        <ol className="space-y-1">
          {list.map((q, i) => (
            <li key={q.key}>
              {byTopic && (i === 0 || list[i - 1].topic !== q.topic) && (
                <div className="px-1 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide opacity-60">{q.topic}</div>
              )}
              <button
                type="button"
                className={`flex w-full items-start gap-3 rounded-box border p-2 text-left text-sm ${i === index ? 'border-primary bg-primary/5' : 'border-base-300 bg-base-100 hover:bg-base-200'}`}
                onClick={() => go(i)}
              >
                <span className="badge badge-ghost shrink-0 font-semibold">{q.id}</span>
                <span className="flex-1">{q.question}</span>
                {i === index && status === 'playing' && (
                  <span className="loading loading-bars loading-xs text-primary" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
