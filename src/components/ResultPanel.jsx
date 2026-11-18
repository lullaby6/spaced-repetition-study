import { useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { useEnterHotkey } from '../hooks/useHotkey.js'
import MarkedText from './MarkedText.jsx'

const STYLES = {
  passed: 'alert-success',
  partial: 'alert-warning',
  failed: 'alert-error',
}

// Result of an exercise: verdict, what happens next, optional full answer, and the "next" button.
// `onRetry` adds a "try again" button; `practice` marks a retry whose result is not recorded.
export default function ResultPanel({
  result,
  label = null,
  outcome,
  detail,
  answer,
  keywords,
  showAnswerToggle = true,
  focusNext = true,
  practice = false,
  onRetry = null,
  onNext,
}) {
  const { t } = useI18n()
  const [showAnswer, setShowAnswer] = useState(false)
  useEnterHotkey(onNext)

  const outcomeText = outcome
    ? t(outcome.code, {
        ...outcome.params,
        stageName: outcome.params?.stage ? t(`stage.names.${outcome.params.stage}`) : '',
      })
    : null

  return (
    <div className="space-y-3">
      <div role="status" className={`alert ${STYLES[result]} items-start`}>
        <div>
          <div className="font-bold">{label || t(`result.${result}`)}</div>
          {detail && <div className="text-sm">{detail}</div>}
          {practice && <div className="text-sm font-medium">{t('exercise.practiceNote')}</div>}
          {outcomeText && <div className="text-sm opacity-90">{outcomeText}</div>}
        </div>
      </div>

      {showAnswerToggle && answer && (
        <div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAnswer((v) => !v)}>
            {showAnswer ? t('exercise.hideAnswer') : t('exercise.showAnswer')}
          </button>
          {showAnswer && <AnswerBox answer={answer} keywords={keywords} />}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onRetry && (
          <button type="button" className="btn btn-outline w-full sm:w-auto" onClick={onRetry}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('exercise.retry')}
          </button>
        )}
        <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={onNext} autoFocus={focusNext}>
          {t('exercise.next')}
          <kbd className="kbd kbd-sm hidden sm:inline-flex">Enter</kbd>
        </button>
      </div>
    </div>
  )
}

export function AnswerBox({ answer, keywords, title }) {
  const { t } = useI18n()
  return (
    <div className="mt-2 rounded-box border border-base-300 bg-base-200/60 p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">{title || t('exercise.fullAnswer')}</div>
      <p className="leading-relaxed">
        <MarkedText text={answer} keywords={keywords} />
      </p>
    </div>
  )
}
