import { Fragment } from 'react'
import { useI18n } from '../i18n.jsx'
import { AnswerBox } from './ResultPanel.jsx'
import { blankStyle } from './stages/ClozeStage.jsx'

const RESULT_STYLES = { passed: 'alert-success', partial: 'alert-warning', failed: 'alert-error' }

// Read-only view of an exercise already answered: what was typed, the result and the full answer.
// `entry.stage` is 1-4, or 'choice' for a multiple choice mock exam question (needs `bankByKey`).
export default function PastExercise({ question, entry, bankByKey }) {
  const { t } = useI18n()
  const response = entry.response
  const isChoice = entry.stage === 'choice'
  const label = isChoice ? t(entry.result === 'passed' ? 'choice.right' : 'choice.wrong') : t(`result.${entry.result}`)

  return (
    <div className="space-y-4">
      <div role="status" className={`alert ${RESULT_STYLES[entry.result]}`}>
        <span className="font-bold">{label}</span>
        {isChoice && response?.hintsUsed > 0 && <span className="text-sm">{t('choice.hintsUsed', { count: response.hintsUsed })}</span>}
      </div>

      {!response && <p className="text-sm italic opacity-60">{t('history.noResponse')}</p>}
      {response && isChoice && (
        <ul className="space-y-2">
          {response.options.map((key) => {
            const isRight = key === question.key
            const isChosen = key === response.chosen
            return (
              <li
                key={key}
                className={`rounded-box border-2 p-3 ${isRight ? 'border-success bg-success/10' : isChosen ? 'border-error bg-error/10' : 'border-base-300 opacity-60'}`}
              >
                {bankByKey?.get(key)?.answer}
              </li>
            )
          })}
        </ul>
      )}
      {response && entry.stage === 1 && <TypedBox text={response.typed} />}
      {response && entry.stage === 2 && <ClozeReview question={question} response={response} />}
      {response && entry.stage >= 3 && (
        <div className="grid gap-4 md:grid-cols-2">
          <TypedBox text={response.gaveUp ? '' : response.typed} />
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">{t('stages.recall.keyPoints')}</div>
            <ul className="space-y-2">
              {question.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-3 rounded-box border border-base-300 p-3">
                  <input type="checkbox" className="checkbox checkbox-primary checkbox-sm mt-0.5" checked={!!response.ticked?.[i]} readOnly tabIndex={-1} />
                  <span className="flex-1">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!isChoice && <AnswerBox answer={question.answer} keywords={question.cloze.blanks} />}
    </div>
  )
}

function TypedBox({ text }) {
  const { t } = useI18n()
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">{t('stages.recall.yourAnswer')}</div>
      <div className="min-h-16 whitespace-pre-wrap rounded-box border border-base-300 bg-base-200/60 p-4">
        {text?.trim() || <span className="italic opacity-50">{t('stages.recall.empty')}</span>}
      </div>
    </div>
  )
}

function ClozeReview({ question, response }) {
  const { text, blanks } = question.cloze
  const pieces = text.split(/\{\{(\d+)\}\}/)
  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-4 text-lg leading-[2.6]">
      {pieces.map((piece, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{piece}</Fragment>
        const index = Number(piece)
        const state = response.states?.[index]
        return (
          <span key={i} className="inline-flex flex-wrap items-center gap-1 align-middle">
            <span className={`input input-bordered inline-flex h-11 items-center px-2 text-base ${blankStyle(state)}`}>
              {response.values?.[index] || '   '}
            </span>
            {state === 'wrong' && <span className="badge badge-success badge-soft font-semibold">{blanks[index]}</span>}
          </span>
        )
      })}
    </div>
  )
}
