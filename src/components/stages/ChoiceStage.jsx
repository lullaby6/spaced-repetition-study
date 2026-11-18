import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n.jsx'
import { useDigitHotkey } from '../../hooks/useHotkey.js'
import { HINT_LEVELS, optionsToEliminate } from '../../lib/exam.js'
import ResultPanel from '../ResultPanel.jsx'
import MarkedText from '../MarkedText.jsx'
import { InfoTip } from '../Tooltip.jsx'

const LETTERS = 'ABCDEFGHI'

// Multiple choice question of the mock exam. `optionKeys` are question keys whose answers are the
// options; the right one is `question.key`. Hints come one level at a time (see HINT_LEVELS).
export default function ChoiceStage({ question, optionKeys, bankByKey, onDone }) {
  const { t } = useI18n()
  const [chosen, setChosen] = useState(null)
  const [hintLevel, setHintLevel] = useState(0)
  const eliminated = useMemo(() => optionsToEliminate(optionKeys, question.key), [optionKeys, question.key])
  const hidden = hintLevel >= 3 ? new Set(eliminated) : new Set()
  const answered = chosen !== null
  const correct = chosen === question.key

  const choose = (key) => {
    if (answered || hidden.has(key)) return
    setChosen(key)
  }
  useDigitHotkey((index) => optionKeys[index] && choose(optionKeys[index]), !answered)

  const nextHint = HINT_LEVELS[hintLevel]
  const result = correct ? 'passed' : 'failed'
  const record = {
    result,
    ratio: correct ? 1 : 0,
    response: { options: optionKeys, chosen, hintsUsed: hintLevel },
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm opacity-70">{t('choice.instructions')}</p>
        {!answered && (
          <div className="flex items-center gap-1">
            <button type="button" className="btn btn-outline btn-warning btn-sm" onClick={() => setHintLevel((l) => l + 1)} disabled={!nextHint}>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {nextHint ? t(`choice.hint_${nextHint}`) : t('choice.noMoreHints')}
              <span className="badge badge-warning badge-sm">
                {hintLevel}/{HINT_LEVELS.length}
              </span>
            </button>
            <InfoTip text={t('info.choiceHints')} />
          </div>
        )}
      </div>

      {hintLevel >= 1 && (
        <div className="rounded-box border border-info/30 bg-info/5 p-3 text-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-info">{t('stages.recall.hints')}</div>
          <ul className="list-inside list-disc space-y-0.5">
            {question.hints.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
          {hintLevel >= 2 && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-info">{t('choice.keywords')}</span>
              {question.cloze.blanks.map((w, i) => (
                <span key={i} className="badge badge-info badge-soft badge-sm">
                  {w}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {optionKeys.map((key, i) => {
          const option = bankByKey.get(key)
          if (!option) return null
          const isRight = key === question.key
          const isChosen = key === chosen
          const gone = hidden.has(key)
          const tone = answered
            ? isRight
              ? 'border-success bg-success/10'
              : isChosen
                ? 'border-error bg-error/10'
                : 'border-base-300 opacity-60'
            : 'border-base-300 hover:border-primary hover:bg-primary/5'
          return (
            <li key={key}>
              <button
                type="button"
                className={`flex w-full items-start gap-3 rounded-box border-2 p-3 text-left transition-colors ${gone ? 'cursor-not-allowed border-dashed border-base-300 opacity-35' : tone}`}
                onClick={() => choose(key)}
                disabled={answered || gone}
                aria-label={`${LETTERS[i]}: ${option.answer}`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${
                    answered && isRight ? 'bg-success text-success-content' : answered && isChosen ? 'bg-error text-error-content' : 'bg-base-200'
                  }`}
                >
                  {LETTERS[i]}
                </span>
                <span className={`flex-1 leading-relaxed ${gone ? 'line-through' : ''}`}>
                  {answered && isRight ? <MarkedText text={option.answer} keywords={question.cloze.blanks} /> : option.answer}
                </span>
                {!answered && !gone && <kbd className="kbd kbd-sm hidden sm:inline-flex">{i + 1}</kbd>}
              </button>
            </li>
          )
        })}
      </ul>

      {answered && (
        <ResultPanel
          result={result}
          label={correct ? t('choice.right') : t('choice.wrong')}
          detail={hintLevel ? t('choice.hintsUsed', { count: hintLevel }) : null}
          answer={question.answer}
          showAnswerToggle={false}
          onNext={() => onDone(record)}
        />
      )}
    </div>
  )
}
