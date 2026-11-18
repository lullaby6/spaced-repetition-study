import { useEffect, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { HotkeysActiveContext } from '../hooks/useHotkey.js'
import { useSpeech } from '../hooks/useSpeech.js'
import { guessLanguage } from '../lib/text.js'
import { describeOutcome, lastSkipped, sessionStages } from '../lib/queue.js'
import QuestionCard from '../components/QuestionCard.jsx'
import StatusBar from '../components/StatusBar.jsx'
import Exercise from '../components/Exercise.jsx'
import HistoryNav from '../components/HistoryNav.jsx'
import Tooltip, { InfoTip } from '../components/Tooltip.jsx'
import SessionOverview, { studyOverviewRows } from '../components/SessionOverview.jsx'
import PastExercise from '../components/PastExercise.jsx'
import SessionSettingsButton from '../components/SessionSettingsButton.jsx'
import { copySpokenText } from '../components/stages/CopyStage.jsx'
import { clipRange } from '../components/MarkedText.jsx'

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
  autoRead = false,
  readRate = 1,
  onChangeSettings,
}) {
  const { t, lang } = useI18n()
  const [position, setPosition] = useState(null) // index in session.log, or null for the current exercise
  const item = session.queue[0]
  const question = item && bankByKey.get(item.key)

  // "Read each question aloud": every new exercise reads its question, plus the answer in the stages
  // that show it in full (1 Copy, 4 No help, which starts by reading it).
  const speech = useSpeech({ rate: readRate })
  const { play: speak, stop: stopSpeaking } = speech
  useEffect(() => {
    if (!autoRead || !question) return undefined
    // Same text as stage 1's Listen button, so that button can pause/resume this reading.
    const text = item.stage === 1 ? copySpokenText(question) : item.stage === 4 ? `${question.question} ${question.answer}` : question.question
    speak(text, guessLanguage(question.answer, lang))
    return stopSpeaking
    // Only when a new exercise shows up (the counter changes on every step).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.counter, autoRead])

  if (!item || !question) return null

  // Everything the voice reads starts with the question, so its first characters map to the title.
  const reading = speech.status !== 'idle'
  const qLen = question.question.length
  const titleHighlight = reading
    ? { sentence: clipRange(speech.sentence, 0, qLen), word: clipRange(speech.word, 0, qLen) }
    : null

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
          <SessionSettingsButton
            autoRead={autoRead}
            readRate={readRate}
            noBacktrack={!!session.options?.noBacktrack}
            onChange={onChangeSettings}
          />
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
          <Tooltip text={session.queue.length < 2 ? t('study.skipLast') : t('study.skipHelp')} side="bottom">
            <button type="button" className="btn btn-outline btn-sm" onClick={onSkip} disabled={position !== null}>
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
            titleHighlight={titleHighlight}
          >
            <Exercise
              question={question}
              stage={item.stage}
              outcomeFor={(result) => describeOutcome(item, result, session)}
              readRate={readRate}
              speech={speech}
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
