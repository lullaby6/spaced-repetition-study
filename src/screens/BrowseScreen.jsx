import { useMemo, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { useSpeech } from '../hooks/useSpeech.js'
import { guessLanguage, normalize } from '../lib/text.js'
import MarkedText from '../components/MarkedText.jsx'
import SpeechControls from '../components/SpeechControls.jsx'

const RATES = [0.8, 1, 1.2, 1.5, 1.75, 2]

// What is read for a question: its text, then its answer (one string, so highlights can be mapped back).
const spokenText = (q) => `${q.question} ${q.answer}`

// The part of `range` ([start, end] in the spoken text) that falls inside [from, to), shifted to start at 0.
function clip(range, from, to) {
  if (!range) return null
  const start = Math.max(range[0], from)
  const end = Math.min(range[1], to)
  return start < end ? [start - from, end - from] : null
}

// Read-only view of the whole bank: every question with its answer, grouped by topic.
// Answers can be hidden to test yourself (tap a question to reveal its answer). Each question can be
// read aloud with the same controls as in the sessions; the voice speed is kept per bank.
export default function BrowseScreen({ questions, savedRate, onSaveRate, onBack }) {
  const { t, lang } = useI18n()
  const [rate, setRate] = useState(RATES.includes(savedRate) ? savedRate : 1)
  const speech = useSpeech({ rate })
  const [playingKey, setPlayingKey] = useState(null) // which question the voice is on
  const topics = useMemo(() => [...new Set(questions.map((q) => q.topic))], [questions])

  // Another question starts from the beginning; the same one plays, pauses or resumes.
  const toggleListen = (q) => {
    const text = spokenText(q)
    const voiceLang = guessLanguage(q.answer, lang)
    if (playingKey !== q.key) {
      setPlayingKey(q.key)
      speech.play(text, voiceLang)
    } else {
      speech.toggle(text, voiceLang)
    }
  }
  const restartListen = () => speech.restart()
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState('')
  const [showAnswers, setShowAnswers] = useState(true)
  const [showKeyPoints, setShowKeyPoints] = useState(false)
  const [revealed, setRevealed] = useState(() => new Set())

  const groups = useMemo(() => {
    const needle = normalize(search)
    const match = (q) =>
      (!topic || q.topic === topic) &&
      (!needle || normalize(`${q.id} ${q.question} ${q.answer} ${q.topic} ${q.keyPoints.join(' ')}`).includes(needle))
    return topics
      .map((tp) => ({ topic: tp, items: questions.filter((q) => q.topic === tp && match(q)) }))
      .filter((g) => g.items.length)
  }, [questions, topics, search, topic])
  const shown = groups.reduce((n, g) => n + g.items.length, 0)

  const toggleReveal = (key) =>
    setRevealed((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="space-y-4">
      <div className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="card-title">{t('browse.title')}</h2>
              <p className="text-sm opacity-70">{t('browse.count', { count: shown, total: questions.length })}</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
              {t('common.back')}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="search"
              className="input input-bordered w-full"
              placeholder={t('editor.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('editor.search')}
            />
            <select className="select select-bordered w-full" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label={t('progress.topic')}>
              <option value="">{t('progress.allTopics')}</option>
              {topics.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={showAnswers}
                onChange={(e) => {
                  setShowAnswers(e.target.checked)
                  setRevealed(new Set())
                }}
              />
              {t('browse.showAnswers')}
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={showKeyPoints} onChange={(e) => setShowKeyPoints(e.target.checked)} />
              {t('browse.showKeyPoints')}
            </label>
            {speech.supported && (
              <label className="flex items-center gap-2">
                {t('listen.rateLabel')}
                <select
                  className="select select-bordered select-xs w-auto"
                  value={rate}
                  onChange={(e) => {
                    const value = Number(e.target.value)
                    setRate(value)
                    onSaveRate?.(value)
                  }}
                >
                  {RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}×
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {!showAnswers && <p className="text-sm opacity-70">{t('browse.hiddenHelp')}</p>}
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.topic} className="space-y-2">
          <h3 className="px-1 text-sm font-semibold uppercase tracking-wide opacity-60">
            {group.topic} <span className="font-normal">({group.items.length})</span>
          </h3>
          <ul className="space-y-2">
            {group.items.map((q) => {
              const visible = showAnswers || revealed.has(q.key)
              const active = playingKey === q.key && speech.status !== 'idle'
              // Highlights of the spoken text, split between the question and the answer.
              const qEnd = q.question.length
              const aStart = qEnd + 1
              const aEnd = spokenText(q).length
              const hl = (from, to) => ({
                sentence: active ? clip(speech.sentence, from, to) : null,
                word: active ? clip(speech.word, from, to) : null,
              })
              return (
                <li key={q.key} className={`card border bg-base-100 ${active ? 'border-primary' : 'border-base-300'}`}>
                  <div className="card-body gap-2 p-4">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        className={`flex flex-1 items-start gap-3 text-left ${showAnswers ? 'cursor-default' : ''}`}
                        onClick={() => !showAnswers && toggleReveal(q.key)}
                        aria-expanded={visible}
                      >
                        <span className="badge badge-ghost mt-0.5 shrink-0 font-semibold">{q.id}</span>
                        <span className="flex-1 font-semibold">
                          <MarkedText text={q.question} {...hl(0, qEnd)} />
                        </span>
                        {!showAnswers && <span className="text-xs text-primary">{visible ? t('browse.hide') : t('browse.reveal')}</span>}
                      </button>
                      {speech.supported && (
                        <SpeechControls
                          speech={speech}
                          active={active}
                          label={t('browse.listen', { id: q.id })}
                          onToggle={() => toggleListen(q)}
                          onRestart={restartListen}
                        />
                      )}
                    </div>
                    {visible && (
                      <div className="space-y-2 pl-10">
                        <p className="leading-relaxed">
                          <MarkedText text={q.answer} keywords={q.cloze.blanks} {...hl(aStart, aEnd)} />
                        </p>
                        {showKeyPoints && (
                          <ul className="list-inside list-disc text-sm opacity-80">
                            {q.keyPoints.map((p, i) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {!shown && <p className="py-6 text-center opacity-60">{t('progress.empty')}</p>}
    </div>
  )
}
