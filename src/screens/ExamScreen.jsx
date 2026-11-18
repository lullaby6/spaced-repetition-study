import { useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { HotkeysActiveContext } from '../hooks/useHotkey.js'
import QuestionCard from '../components/QuestionCard.jsx'
import Exercise from '../components/Exercise.jsx'
import HistoryNav from '../components/HistoryNav.jsx'
import PastExercise from '../components/PastExercise.jsx'
import ChoiceStage from '../components/stages/ChoiceStage.jsx'
import Tooltip from '../components/Tooltip.jsx'
import SessionOverview, { examOverviewRows } from '../components/SessionOverview.jsx'

// Mock exam, without touching progress. exam.mode is 'write' (stage 4: recall with no help) or
// 'choice' (multiple choice; exam.options[key] are the option keys for each question).
export default function ExamScreen({
  exam,
  bankByKey,
  skippedKey,
  onAnswer,
  onSkip,
  onBackToSkipped,
  onJump,
  onToggle,
  onDelete,
  onQuit,
  deletedCount,
  onOpenDeleted,
}) {
  const { t } = useI18n()
  const [position, setPosition] = useState(null)
  const question = bankByKey.get(exam.keys[exam.index])
  if (!question) return null
  const isChoice = exam.mode === 'choice'
  const pct = Math.round((exam.index / exam.keys.length) * 100)
  const past = position !== null ? exam.results[position] : null
  const pastQuestion = past && bankByKey.get(past.key)
  const badge = (
    <span className="badge badge-accent badge-soft">{isChoice ? t('choice.badge') : t('exam.badge')}</span>
  )
  const finish = (record) => {
    setPosition(null)
    onAnswer(record)
  }
  const isLast = exam.index >= exam.keys.length - 1
  // In random order, the question that comes before this one in the bank is shown as context
  // (questions often build on the previous one).
  const bankOrder = [...bankByKey.keys()]
  const previousInBank = exam.order !== 'bank' ? bankByKey.get(bankOrder[bankOrder.indexOf(question.key) - 1]) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm opacity-70">{t('exam.progress', { n: exam.index + 1, total: exam.keys.length })}</span>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <SessionOverview
            rows={examOverviewRows(exam)}
            bankByKey={bankByKey}
            title={t('overview.examTitle')}
            onJump={(key) => {
              setPosition(null)
              onJump(key)
            }}
            onView={setPosition}
            onCurrent={() => setPosition(null)}
            onToggle={onToggle}
            onDelete={(key) => {
              setPosition(null)
              onDelete(key)
            }}
            deletedCount={deletedCount}
            onOpenDeleted={onOpenDeleted}
          />
          {skippedKey && (
            <Tooltip text={t('study.backToSkippedHelp', { id: bankByKey.get(skippedKey)?.id ?? '' })} side="bottom">
              <button type="button" className="btn btn-outline btn-sm" onClick={onBackToSkipped} disabled={past !== null}>
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t('study.backToSkipped')}
              </button>
            </Tooltip>
          )}
          <Tooltip text={isLast ? t('exam.leaveBlankHelp') : t('exam.skipHelp')} side="bottom">
            <button type="button" className="btn btn-outline btn-sm" onClick={onSkip} disabled={past !== null}>
              {isLast ? t('exam.leaveBlank') : t('study.skip')}
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m5 5 7 7-7 7M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </Tooltip>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onQuit}>
            {t('exam.quit')}
          </button>
        </div>
      </div>
      <progress className="progress progress-primary w-full" value={pct} max="100" />
      <HistoryNav position={position} total={exam.results.length} onMove={setPosition} />

      {past && pastQuestion && (
        <QuestionCard question={pastQuestion} badges={badge}>
          <PastExercise question={pastQuestion} entry={{ ...past, stage: isChoice ? 'choice' : 4 }} bankByKey={bankByKey} />
        </QuestionCard>
      )}

      <div className={past ? 'hidden' : 'space-y-3'}>
        {previousInBank && (
          <div className="rounded-box border border-base-300 bg-base-100/60 px-4 py-2 text-sm">
            <span className="font-semibold opacity-70">{t('exam.previousInBank', { id: previousInBank.id })}</span>{' '}
            <span className="opacity-80">{previousInBank.question}</span>
          </div>
        )}
        <HotkeysActiveContext.Provider value={!past}>
          {/* keyed by position and question so a skipped question's exercise starts fresh */}
          <QuestionCard key={`${exam.index}-${question.key}`} question={question} badges={badge}>
            {isChoice ? (
              <ChoiceStage question={question} optionKeys={exam.options[question.key]} bankByKey={bankByKey} onDone={finish} />
            ) : (
              <Exercise question={question} stage={4} outcomeFor={null} onDone={finish} />
            )}
          </QuestionCard>
        </HotkeysActiveContext.Provider>
      </div>
    </div>
  )
}

export function ExamSummaryScreen({ exam, bankByKey, onRetry, onHome }) {
  const { t } = useI18n()
  const isChoice = exam.mode === 'choice'
  const average = exam.results.length ? exam.results.reduce((a, r) => a + r.ratio, 0) / exam.results.length : 0
  const rightCount = exam.results.filter((r) => r.ratio >= 1).length
  const hintsUsed = exam.results.reduce((a, r) => a + (r.response?.hintsUsed || 0), 0)
  const showHints = isChoice || hintsUsed > 0
  const skippedCount = exam.results.filter((r) => r.result === 'skipped').length
  const tone = (ratio) => (ratio >= 1 ? 'text-success' : ratio >= 0.5 ? 'text-warning' : 'text-error')
  const resultText = ({ result, ratio }) => {
    if (result === 'skipped') return t('exam.skipped')
    if (isChoice) return ratio >= 1 ? `✓ ${t('choice.right')}` : `✗ ${t('choice.wrong')}`
    return `${Math.round(ratio * 100)}%`
  }

  return (
    <div className="space-y-4">
      <div className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body items-center gap-2 p-6 text-center">
          <h2 className="card-title">{isChoice ? t('choice.summaryTitle') : t('exam.summaryTitle')}</h2>
          <div className={`text-5xl font-bold ${tone(average)}`}>{Math.round(average * 100)}%</div>
          <p className="opacity-70">
            {isChoice ? t('choice.score', { right: rightCount, total: exam.results.length }) : t('exam.average')}
          </p>
          {hintsUsed > 0 && <p className="text-sm opacity-60">{t('choice.totalHints', { count: hintsUsed })}</p>}
          {skippedCount > 0 && <p className="text-sm opacity-60">{t('exam.skippedCount', { count: skippedCount })}</p>}
        </div>
      </div>
      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('progress.question')}</th>
              {showHints && <th className="text-right">{t('choice.hintsColumn')}</th>}
              <th className="text-right">{isChoice ? t('choice.resultColumn') : t('exam.recalled')}</th>
            </tr>
          </thead>
          <tbody>
            {exam.results.map((entry) => {
              const { key, ratio, response, result } = entry
              const q = bankByKey.get(key)
              return (
                <tr key={key}>
                  <td className="font-semibold">{q?.id}</td>
                  <td>{q?.question}</td>
                  {showHints && <td className="text-right opacity-70">{response?.hintsUsed || '—'}</td>}
                  <td className={`whitespace-nowrap text-right font-semibold ${result === 'skipped' ? 'opacity-60' : tone(ratio)}`}>
                    {resultText(entry)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-ghost" onClick={onHome}>
          {t('nav.home')}
        </button>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          {t('exam.retry')}
        </button>
      </div>
    </div>
  )
}
