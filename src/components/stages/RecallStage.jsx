import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n.jsx'
import { useEnterHotkey } from '../../hooks/useHotkey.js'
import { suggestKeyPoints } from '../../lib/text.js'
import ResultPanel, { AnswerBox } from '../ResultPanel.jsx'

export function recallResult(ratio) {
  if (ratio >= 1) return 'passed'
  if (ratio >= 0.5) return 'partial'
  return 'failed'
}

// Stages 3 (with hints) and 4 (no help): write the key points, then self-assess with a checklist.
// Also used by the mock exam, where `outcomeFor` is null and progress is not affected.
export default function RecallStage({ question, withHints, outcomeFor, practice, onDone, onRetry }) {
  const { t } = useI18n()
  const [typed, setTyped] = useState('')
  const [phase, setPhase] = useState('writing') // writing | comparing | gaveUp
  const [ticked, setTicked] = useState(() => question.keyPoints.map(() => false))
  const suggested = useMemo(
    () => (phase === 'writing' ? [] : suggestKeyPoints(question.keyPoints, typed)),
    [phase, question.keyPoints, typed],
  )

  useEnterHotkey(() => setPhase('comparing'), phase === 'writing')

  const total = question.keyPoints.length
  const count = ticked.filter(Boolean).length
  const ratio = phase === 'gaveUp' ? 0 : count / total
  const result = recallResult(ratio)
  const showFullAnswer = !withHints || phase === 'gaveUp'
  const record = { result, ratio, response: { typed, ticked, gaveUp: phase === 'gaveUp' } }

  return (
    <div className="space-y-4">
      {withHints && (
        <div className="rounded-box border border-info/30 bg-info/5 p-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-info">{t('stages.recall.hints')}</div>
          <ul className="list-inside list-disc space-y-1">
            {question.hints.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {phase === 'writing' ? (
        <>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t('stages.recall.instructions')}</span>
            <textarea
              className="textarea textarea-bordered min-h-40 w-full text-base"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              placeholder={t('stages.recall.placeholder')}
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn btn-ghost" onClick={() => setPhase('gaveUp')}>
              {t('exercise.dontRemember')}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setPhase('comparing')}>
              {t('stages.recall.compare')}
              <kbd className="kbd kbd-sm hidden sm:inline-flex">Ctrl+Enter</kbd>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">{t('stages.recall.yourAnswer')}</div>
              <div className="min-h-24 whitespace-pre-wrap rounded-box border border-base-300 bg-base-200/60 p-4">
                {typed.trim() || <span className="italic opacity-50">{t('stages.recall.empty')}</span>}
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide opacity-60">{t('stages.recall.keyPoints')}</span>
                {phase === 'comparing' && suggested.some(Boolean) && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => setTicked((cur) => cur.map((v, i) => v || suggested[i]))}
                  >
                    {t('stages.recall.tickSuggested')}
                  </button>
                )}
              </div>
              {phase === 'comparing' && <p className="mb-2 text-sm opacity-70">{t('stages.recall.checklistHelp')}</p>}
              <ul className="space-y-2">
                {question.keyPoints.map((point, i) => (
                  <li key={i}>
                    <label
                      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-box border p-3 ${
                        suggested[i] ? 'border-success/60 bg-success/10' : 'border-base-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary mt-0.5"
                        checked={ticked[i]}
                        disabled={phase === 'gaveUp'}
                        onChange={() => setTicked((cur) => cur.map((v, k) => (k === i ? !v : v)))}
                      />
                      <span className="flex-1">{point}</span>
                      {suggested[i] && <span className="badge badge-success badge-soft badge-sm">{t('stages.recall.suggested')}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {showFullAnswer && <AnswerBox answer={question.answer} keywords={question.cloze.blanks} />}

          <ResultPanel
            focusNext={false}
            result={result}
            detail={
              phase === 'gaveUp'
                ? null
                : t('stages.recall.score', { count, total, pct: Math.round(ratio * 100) })
            }
            outcome={outcomeFor ? outcomeFor(result) : null}
            answer={question.answer}
            keywords={question.cloze.blanks}
            showAnswerToggle={!showFullAnswer}
            practice={practice}
            onRetry={result === 'failed' ? () => onRetry(record) : null}
            onNext={() => onDone(record)}
          />
        </>
      )}
    </div>
  )
}
