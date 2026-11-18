import { Fragment, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n.jsx'
import { useEnterHotkey } from '../../hooks/useHotkey.js'
import { isBlankCorrect } from '../../lib/text.js'
import ResultPanel from '../ResultPanel.jsx'
import Tooltip from '../Tooltip.jsx'

// Hint levels per blank: 0 none, 1 first letter shown, 2 whole word shown (does not count as correct).
const FIRST_LETTER = 1
const WHOLE_WORD = 2

function resultFor(correctCount, total) {
  if (correctCount === total) return 'passed'
  if (correctCount >= total / 2) return 'partial'
  return 'failed'
}

export function blankStyle(state) {
  if (state === 'correct') return 'input-success border-2 bg-success/10'
  if (state === 'revealed') return 'input-warning border-2 bg-warning/10'
  if (state === 'wrong') return 'input-error border-2 bg-error/10 line-through'
  return ''
}

// Stage 2: fill in the blanks of the summarized answer.
export default function ClozeStage({ question, outcomeFor, practice, onDone, onRetry }) {
  const { t } = useI18n()
  const { text, blanks } = question.cloze
  const pieces = useMemo(() => text.split(/\{\{(\d+)\}\}/), [text])
  const [values, setValues] = useState(() => blanks.map(() => ''))
  const [hints, setHints] = useState(() => blanks.map(() => 0))
  const [checked, setChecked] = useState(null) // { states: ('correct'|'wrong'|'revealed')[], gaveUp }
  const inputs = useRef([])

  const runCheck = () =>
    setChecked({
      states: blanks.map((b, i) => (hints[i] >= WHOLE_WORD ? 'revealed' : isBlankCorrect(values[i], b) ? 'correct' : 'wrong')),
      gaveUp: false,
    })
  const giveUp = () => setChecked({ states: blanks.map(() => 'wrong'), gaveUp: true })
  useEnterHotkey(runCheck, !checked)

  // First blank that is neither right yet nor fully revealed.
  const hintTarget = blanks.findIndex((b, i) => hints[i] < WHOLE_WORD && !isBlankCorrect(values[i], b))

  const giveHint = () => {
    const index = hintTarget
    if (index < 0) return
    const level = hints[index] + 1
    const value = level === FIRST_LETTER ? blanks[index].charAt(0) : blanks[index]
    setValues((v) => v.map((x, k) => (k === index ? value : x)))
    setHints((h) => h.map((x, k) => (k === index ? level : x)))
    requestAnimationFrame(() => {
      const el = inputs.current[index]
      if (!el) return
      el.focus()
      el.setSelectionRange(value.length, value.length)
    })
  }

  const onKeyDown = (e, index) => {
    if (e.key !== 'Enter' || checked) return
    e.preventDefault()
    const next = inputs.current[index + 1]
    if (next && !e.ctrlKey && !e.metaKey) next.focus()
    else runCheck()
  }

  const correctCount = checked ? checked.states.filter((s) => s === 'correct').length : 0
  const revealedCount = hints.filter((h) => h >= WHOLE_WORD).length
  const hintsUsed = hints.reduce((a, h) => a + h, 0)
  const result = checked ? (checked.gaveUp ? 'failed' : resultFor(correctCount, blanks.length)) : null
  const record = checked && { result, response: { values, states: checked.states, hintsUsed } }

  const detail = checked && !checked.gaveUp
    ? [
        t('stages.cloze.score', { correct: correctCount, total: blanks.length }),
        revealedCount ? t('stages.cloze.revealedNote', { count: revealedCount }) : '',
      ].filter(Boolean).join(' · ')
    : null

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-70">{t('stages.cloze.instructions')}</p>
      <div className="rounded-box border border-base-300 bg-base-100 p-4 text-lg leading-[2.6]">
        {pieces.map((piece, i) => {
          if (i % 2 === 0) return <Fragment key={i}>{piece}</Fragment>
          const index = Number(piece)
          const answer = blanks[index]
          const state = checked?.states[index]
          const width = `${Math.min(Math.max(answer.length + 2, 6), 22)}ch`
          return (
            <span key={i} className="inline-flex flex-wrap items-center gap-1 align-middle">
              <input
                ref={(el) => (inputs.current[index] = el)}
                type="text"
                className={`input input-bordered h-11 px-2 text-base ${checked ? blankStyle(state) : hints[index] ? 'border-warning/60' : ''}`}
                style={{ width }}
                value={values[index]}
                onChange={(e) => setValues((v) => v.map((x, k) => (k === index ? e.target.value : x)))}
                onKeyDown={(e) => onKeyDown(e, index)}
                readOnly={!!checked || hints[index] >= WHOLE_WORD}
                tabIndex={checked ? -1 : 0}
                autoFocus={index === 0}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={index === blanks.length - 1 ? 'done' : 'next'}
                aria-label={t('stages.cloze.blankLabel', { n: index + 1 })}
              />
              {state === 'wrong' && <span className="badge badge-success badge-soft font-semibold">{answer}</span>}
            </span>
          )
        })}
      </div>

      {checked ? (
        <ResultPanel
          result={result}
          detail={detail}
          outcome={outcomeFor(result)}
          answer={question.answer}
          keywords={blanks}
          practice={practice}
          onRetry={result === 'failed' ? () => onRetry(record) : null}
          onNext={() => onDone(record)}
        />
      ) : (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={giveUp}>
            {t('exercise.dontRemember')}
          </button>
          <Tooltip text={t('stages.cloze.hintHelp')} className="block sm:inline-block">
            <button
              type="button"
              className="btn btn-outline btn-warning w-full"
              onClick={giveHint}
              disabled={hintTarget < 0}
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {hintTarget >= 0 && hints[hintTarget] === FIRST_LETTER ? t('stages.cloze.hintWord') : t('stages.cloze.hintLetter')}
              {hintsUsed > 0 && <span className="badge badge-warning badge-sm">{hintsUsed}</span>}
            </button>
          </Tooltip>
          <button type="button" className="btn btn-primary" onClick={runCheck}>
            {t('exercise.check')}
            <kbd className="kbd kbd-sm hidden sm:inline-flex">Enter</kbd>
          </button>
        </div>
      )}
    </div>
  )
}
