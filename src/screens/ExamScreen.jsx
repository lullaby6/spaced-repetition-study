import { useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { HotkeysActiveContext } from '../hooks/useHotkey.js'
import QuestionCard from '../components/QuestionCard.jsx'
import Exercise from '../components/Exercise.jsx'
import HistoryNav from '../components/HistoryNav.jsx'
import PastExercise from '../components/PastExercise.jsx'

// Mock exam: questions only in stage 4, without touching progress.
export default function ExamScreen({ exam, bankByKey, onAnswer, onQuit }) {
  const { t } = useI18n()
  const [position, setPosition] = useState(null)
  const question = bankByKey.get(exam.keys[exam.index])
  if (!question) return null
  const pct = Math.round((exam.index / exam.keys.length) * 100)
  const past = position !== null ? exam.results[position] : null
  const pastQuestion = past && bankByKey.get(past.key)
  const badge = <span className="badge badge-accent badge-soft">{t('exam.badge')}</span>

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
          <PastExercise question={pastQuestion} entry={{ ...past, stage: 4 }} />
        </QuestionCard>
      )}

      <div className={past ? 'hidden' : ''}>
        <HotkeysActiveContext.Provider value={!past}>
          <QuestionCard key={exam.index} question={question} badges={badge}>
            <Exercise
              question={question}
              stage={4}
              outcomeFor={null}
              onDone={(record) => {
                setPosition(null)
                onAnswer(record)
              }}
            />
          </QuestionCard>
        </HotkeysActiveContext.Provider>
      </div>
    </div>
  )
}

export function ExamSummaryScreen({ exam, bankByKey, onRetry, onHome }) {
  const { t } = useI18n()
  const average = exam.results.length ? exam.results.reduce((a, r) => a + r.ratio, 0) / exam.results.length : 0
  const tone = (ratio) => (ratio >= 1 ? 'text-success' : ratio >= 0.5 ? 'text-warning' : 'text-error')

  return (
    <div className="space-y-4">
      <div className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body items-center gap-2 p-6 text-center">
          <h2 className="card-title">{t('exam.summaryTitle')}</h2>
          <div className={`text-5xl font-bold ${tone(average)}`}>{Math.round(average * 100)}%</div>
          <p className="opacity-70">{t('exam.average')}</p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('progress.question')}</th>
              <th className="text-right">{t('exam.recalled')}</th>
            </tr>
          </thead>
          <tbody>
            {exam.results.map(({ key, ratio }) => {
              const q = bankByKey.get(key)
              return (
                <tr key={key}>
                  <td className="font-semibold">{q?.id}</td>
                  <td>{q?.question}</td>
                  <td className={`text-right font-semibold ${tone(ratio)}`}>{Math.round(ratio * 100)}%</td>
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
