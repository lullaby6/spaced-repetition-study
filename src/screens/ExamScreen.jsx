import { useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { HotkeysActiveContext } from '../hooks/useHotkey.js'
import QuestionCard from '../components/QuestionCard.jsx'
import Exercise from '../components/Exercise.jsx'
import HistoryNav from '../components/HistoryNav.jsx'
import PastExercise from '../components/PastExercise.jsx'
import ChoiceStage from '../components/stages/ChoiceStage.jsx'

// Mock exam, without touching progress. exam.mode is 'write' (stage 4: recall with no help) or
// 'choice' (multiple choice; exam.options[key] are the option keys for each question).
export default function ExamScreen({ exam, bankByKey, onAnswer, onQuit }) {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm opacity-70">{t('exam.progress', { n: exam.index + 1, total: exam.keys.length })}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onQuit}>
          {t('exam.quit')}
        </button>
      </div>
      <progress className="progress progress-primary w-full" value={pct} max="100" />
      <HistoryNav position={position} total={exam.results.length} onMove={setPosition} />

      {past && pastQuestion && (
        <QuestionCard question={pastQuestion} badges={badge}>
          <PastExercise question={pastQuestion} entry={{ ...past, stage: isChoice ? 'choice' : 4 }} bankByKey={bankByKey} />
        </QuestionCard>
      )}

      <div className={past ? 'hidden' : ''}>
        <HotkeysActiveContext.Provider value={!past}>
          <QuestionCard key={exam.index} question={question} badges={badge}>
            {isChoice ? (
              <ChoiceStage question={question} optionKeys={exam.options[question.key]} bankByKey={bankByKey} onDone={finish} />
            ) : (
              <Exercise question={question} stage={4} outcomeFor={null} askHints onDone={finish} />
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
  const tone = (ratio) => (ratio >= 1 ? 'text-success' : ratio >= 0.5 ? 'text-warning' : 'text-error')

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
            {exam.results.map(({ key, ratio, response }) => {
              const q = bankByKey.get(key)
              return (
                <tr key={key}>
                  <td className="font-semibold">{q?.id}</td>
                  <td>{q?.question}</td>
                  {showHints && <td className="text-right opacity-70">{response?.hintsUsed || '—'}</td>}
                  <td className={`whitespace-nowrap text-right font-semibold ${tone(ratio)}`}>
                    {isChoice ? (ratio >= 1 ? `✓ ${t('choice.right')}` : `✗ ${t('choice.wrong')}`) : `${Math.round(ratio * 100)}%`}
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
