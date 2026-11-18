import { useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { HotkeysActiveContext } from '../hooks/useHotkey.js'
import { describeOutcome, lastSkipped, sessionStages } from '../lib/queue.js'
import QuestionCard from '../components/QuestionCard.jsx'
import StatusBar from '../components/StatusBar.jsx'
import Exercise from '../components/Exercise.jsx'
import HistoryNav from '../components/HistoryNav.jsx'
import Tooltip, { InfoTip } from '../components/Tooltip.jsx'
import SessionOverview, { studyOverviewRows } from '../components/SessionOverview.jsx'
import PastExercise from '../components/PastExercise.jsx'

export default function StudyScreen({
  session,
  progress,
  bankByKey,
  counts,
  onResult,
  onSkip,
  onBackToSkipped,
  onJump,
  onToggle,
  onDelete,
  onFinish,
  deletedCount,
  onOpenDeleted,
}) {
  const { t } = useI18n()
  const [position, setPosition] = useState(null) // index in session.log, or null for the current exercise
  const item = session.queue[0]
  const question = item && bankByKey.get(item.key)
  if (!item || !question) return null

  const reviewBadge = (kind) =>
    kind === 'review' ? <span className="badge badge-secondary badge-soft">{t('exercise.reviewBadge')}</span> : null
  const skippedKey = lastSkipped(session)
  const past = position !== null ? session.log[position] : null
  const pastQuestion = past && bankByKey.get(past.key)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm opacity-70">
          {t('study.sessionInfo', { done: session.log.length, pending: session.queue.length })} <InfoTip text={t('info.queue')} />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <SessionOverview
            rows={studyOverviewRows(session, progress)}
            bankByKey={bankByKey}
            title={t('overview.title')}
            onJump={(key) => {
              setPosition(null)
              onJump(key)
            }}
            onView={setPosition}
            onCurrent={() => setPosition(null)}
            onToggle={onToggle}
            onDelete={(key) => {
              setPosition(null) // its past exercises may disappear from the history view
              onDelete(key)
            }}
            deletedCount={deletedCount}
            onOpenDeleted={onOpenDeleted}
          />
          {skippedKey && (
            <Tooltip text={t('study.backToSkippedHelp', { id: bankByKey.get(skippedKey)?.id ?? '' })} side="bottom">
              <button type="button" className="btn btn-outline btn-sm" onClick={onBackToSkipped} disabled={position !== null}>
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t('study.backToSkipped')}
              </button>
            </Tooltip>
          )}
          <Tooltip text={session.queue.length < 2 ? t('study.skipNone') : t('study.skipHelp')} side="bottom">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onSkip}
              disabled={session.queue.length < 2 || position !== null}
            >
              {t('study.skip')}
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m5 5 7 7-7 7M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </Tooltip>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onFinish}>
            {t('study.finish')}
          </button>
        </div>
      </div>
      <StatusBar counts={counts} compact />
      <HistoryNav position={position} total={session.log.length} onMove={setPosition} />

      {past && pastQuestion && (
        <QuestionCard question={pastQuestion} stage={past.stage} stages={sessionStages(session)} badges={reviewBadge(past.kind)}>
          <PastExercise question={pastQuestion} entry={past} />
        </QuestionCard>
      )}

      {/* The current exercise stays mounted while browsing history so nothing typed is lost. */}
      <div className={past ? 'hidden' : ''}>
        <HotkeysActiveContext.Provider value={!past}>
          {/* key forces a fresh exercise component for every queue step */}
          <QuestionCard
            key={session.counter}
            question={question}
            stage={item.stage}
            stages={sessionStages(session)}
            badges={reviewBadge(item.kind)}
          >
            <Exercise
              question={question}
              stage={item.stage}
              outcomeFor={(result) => describeOutcome(item, result, session)}
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
