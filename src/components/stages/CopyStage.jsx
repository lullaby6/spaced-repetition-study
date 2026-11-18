import { useState } from 'react'
import { useI18n } from '../../i18n.jsx'
import { useAltShortcut, useEnterHotkey } from '../../hooks/useHotkey.js'
import Tooltip from '../Tooltip.jsx'
import { useSpeech } from '../../hooks/useSpeech.js'
import { compareCopy, guessLanguage } from '../../lib/text.js'
import ResultPanel from '../ResultPanel.jsx'
import MarkedText from '../MarkedText.jsx'

const PASS_THRESHOLD = 0.8
// Remembers whether the user prefers the answer hidden (e.g. to copy it by ear).
const HIDE_KEY = 'study-app-hide-copy-answer'

function loadHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

function saveHidden(hidden) {
  try {
    localStorage.setItem(HIDE_KEY, hidden ? '1' : '0')
  } catch {
    /* storage unavailable */
  }
}

// Stage 1: read the full answer and type it once (pasting is blocked).
export default function CopyStage({ question, outcomeFor, onDone }) {
  // Copying always ends passed, so it never offers "try again".
  const { t, lang } = useI18n()
  const speech = useSpeech()
  const [hidden, setHidden] = useState(loadHidden)
  const [typed, setTyped] = useState('')
  const [check, setCheck] = useState(null) // { similarity, parts }
  const [pasteBlocked, setPasteBlocked] = useState(false)
  const passed = check && check.similarity >= PASS_THRESHOLD

  const runCheck = () => {
    if (!typed.trim()) return
    setCheck(compareCopy(question.answer, typed))
  }
  useEnterHotkey(runCheck, !passed)

  const blockPaste = (e) => {
    e.preventDefault()
    setPasteBlocked(true)
  }

  const toggleHidden = () => {
    setHidden((h) => {
      saveHidden(!h)
      return !h
    })
  }

  const toggleSpeech = () => speech.toggle(question.answer, guessLanguage(question.answer, lang))
  const restartSpeech = () => {
    if (speech.status === 'idle') toggleSpeech()
    else speech.restart()
  }

  // Alt+P play/pause, Alt+R from the start, Alt+O hide/show (they work while typing).
  useAltShortcut('KeyP', toggleSpeech, speech.supported)
  useAltShortcut('KeyR', restartSpeech, speech.supported)
  useAltShortcut('KeyO', toggleHidden)

  const speechLabel = {
    idle: t('stages.copy.listen'),
    speaking: t('stages.copy.pause'),
    paused: t('stages.copy.resume'),
  }[speech.status]

  return (
    <div className="space-y-4">
      <div className="rounded-box border border-primary/30 bg-primary/5 p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">{t('stages.copy.answerLabel')}</span>
          <div className="flex flex-wrap items-center gap-1">
            {speech.supported && (
              <>
                <Tooltip text={`${speechLabel} (Alt+P)`}>
                  <button
                    type="button"
                    className={`btn btn-sm ${speech.status === 'idle' ? 'btn-ghost' : 'btn-primary'}`}
                    onClick={toggleSpeech}
                    aria-keyshortcuts="Alt+P"
                  >
                    {speech.status === 'speaking' ? (
                      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                        <rect x="6" y="5" width="4" height="14" rx="1" />
                        <rect x="14" y="5" width="4" height="14" rx="1" />
                      </svg>
                    ) : speech.status === 'paused' ? (
                      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                        <path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5Z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M11 5 6 9H3v6h3l5 4V5Zm4.5 3.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {speechLabel}
                  </button>
                </Tooltip>
                {speech.status !== 'idle' && (
                  <>
                    <Tooltip text={`${t('stages.copy.restart')} (Alt+R)`}>
                      <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={speech.restart} aria-label={t('stages.copy.restart')} aria-keyshortcuts="Alt+R">
                        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </Tooltip>
                    <Tooltip text={t('stages.copy.stop')}>
                      <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={speech.stop} aria-label={t('stages.copy.stop')}>
                        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                          <rect x="6" y="6" width="12" height="12" rx="1.5" />
                        </svg>
                      </button>
                    </Tooltip>
                  </>
                )}
              </>
            )}
            <Tooltip text={`${hidden ? t('stages.copy.show') : t('stages.copy.hide')} (Alt+O)`}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={toggleHidden} aria-pressed={hidden} aria-keyshortcuts="Alt+O">
              {hidden ? (
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {hidden ? t('stages.copy.show') : t('stages.copy.hide')}
            </button>
            </Tooltip>
          </div>
        </div>
        {hidden ? (
          <p className="italic opacity-60">{t('stages.copy.hiddenNote')}</p>
        ) : (
          <p className="select-none leading-relaxed">
            <MarkedText text={question.answer} keywords={question.cloze.blanks} sentence={speech.sentence} word={speech.word} />
          </p>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t('stages.copy.instructions')}</span>
        <textarea
          className="textarea textarea-bordered min-h-40 w-full text-base"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onPaste={blockPaste}
          onDrop={blockPaste}
          readOnly={passed}
          autoFocus
          spellCheck={false}
          placeholder={t('stages.copy.placeholder')}
        />
      </label>
      {pasteBlocked && !passed && <p className="text-sm text-warning">{t('stages.copy.pasteBlocked')}</p>}

      {check && !passed && (
        <div className="space-y-2">
          <div role="alert" className="alert alert-warning">
            {t('stages.copy.notEnough', { pct: Math.round(check.similarity * 100), min: PASS_THRESHOLD * 100 })}
          </div>
          <p className="text-sm opacity-70">{t('stages.copy.missingHelp')}</p>
          <p className="rounded-box bg-base-200 p-4 leading-relaxed">
            {check.parts.map((part, i) =>
              part.ok ? (
                <span key={i}>{part.text}</span>
              ) : (
                <mark key={i} className="rounded bg-error/25 px-0.5 text-base-content underline decoration-error decoration-2">
                  {part.text}
                </mark>
              ),
            )}
          </p>
        </div>
      )}

      {passed ? (
        <ResultPanel
          result="passed"
          detail={t('stages.copy.similarity', { pct: Math.round(check.similarity * 100) })}
          outcome={outcomeFor('passed')}
          answer={question.answer}
          showAnswerToggle={false}
          onNext={() => onDone({ result: 'passed', response: { typed, similarity: check.similarity } })}
        />
      ) : (
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={runCheck} disabled={!typed.trim()}>
            {t('exercise.check')}
            <kbd className="kbd kbd-sm hidden sm:inline-flex">Ctrl+Enter</kbd>
          </button>
        </div>
      )}
    </div>
  )
}
