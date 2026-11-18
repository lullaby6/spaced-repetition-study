import { useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { HotkeysActiveContext } from '../hooks/useHotkey.js'
import { describeOutcome } from '../lib/queue.js'
import QuestionCard from '../components/QuestionCard.jsx'
import StatusBar from '../components/StatusBar.jsx'
import Exercise from '../components/Exercise.jsx'
import HistoryNav from '../components/HistoryNav.jsx'
import { InfoTip } from '../components/Tooltip.jsx'
import PastExercise from '../components/PastExercise.jsx'

export default function StudyScreen({ session, bankByKey, counts, onResult, onFinish }) {
  const { t } = useI18n()
  const [position, setPosition] = useState(null) // index in session.log, or null for the current exercise
  const item = session.queue[0]
  const question = item && bankByKey.get(item.key)
  if (!item || !question) return null

  const reviewBadge = (kind) =>
    kind === 'review' ? <span className="badge badge-secondary badge-soft">{t('exercise.reviewBadge')}</span> : null
  const past = position !== null ? session.log[position] : null
  const pastQuestion = past && bankByKey.get(past.key)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm opacity-70">
          {t('study.sessionInfo', { done: session.log.length, pending: session.queue.length })} <InfoTip text={t('info.queue')} />
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onFinish}>
          {t('study.finish')}
        </button>
      </div>
      <StatusBar counts={counts} compact />
      <HistoryNav position={position} total={session.log.length} onMove={setPosition} />

      {past && pastQuestion && (
        <QuestionCard question={pastQuestion} stage={past.stage} badges={reviewBadge(past.kind)}>
          <PastExercise question={pastQuestion} entry={past} />
        </QuestionCard>
      )}

      {/* The current exercise stays mounted while browsing history so nothing typed is lost. */}
      <div className={past ? 'hidden' : ''}>
        <HotkeysActiveContext.Provider value={!past}>
          {/* key forces a fresh exercise component for every queue step */}
          <QuestionCard key={session.counter} question={question} stage={item.stage} badges={reviewBadge(item.kind)}>
            <Exercise
              question={question}
              stage={item.stage}
              outcomeFor={(result) => describeOutcome(item, result)}
              onDone={(record) => {
                setPosition(null)
                onResult(record)
              }}
            />
          </QuestionCard>
        </HotkeysActiveContext.Provider>
      </div>
    </div>
  )
}
