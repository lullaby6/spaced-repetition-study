import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n.jsx'
import { useEnterHotkey } from '../../hooks/useHotkey.js'
import { suggestKeyPoints } from '../../lib/text.js'
import ResultPanel, { AnswerBox } from '../ResultPanel.jsx'
import { InfoTip } from '../Tooltip.jsx'
import MarkedText from '../MarkedText.jsx'

export function recallResult(ratio) {
  if (ratio >= 1) return 'passed'
  if (ratio >= 0.5) return 'partial'
  return 'failed'
}

// Hints the written mock exam can ask for, one at a time.
export const WRITE_HINT_LEVELS = ['hints', 'keywords', 'starts', 'summary']
const START_WORDS = 2

// A blank word with only its first letter shown: "evaporación" → "e__________" (spaces are kept).
function maskWord(word) {
  return Array.from(word, (c, i) => (i === 0 || c === ' ' ? c : '_')).join('')
}

// The cloze summary of the answer with every blank half covered (last and strongest hint).
function MaskedSummary({ cloze }) {
  return cloze.text.split(/\{\{(\d+)\}\}/).map((piece, i) =>
    i % 2 === 0 ? (
      piece
    ) : (
      <span key={i} className="rounded bg-info/15 px-1 font-mono font-semibold tracking-wider">
        {maskWord(cloze.blanks[Number(piece)] ?? '')}
      </span>
    ),
  )
}

// First words of a key point, as a cue: "Indigencia → ingresos suficientes" → "Indigencia →…".
function keyPointStart(point) {
  const words = point.split(/\s+/)
  return words.length > START_WORDS ? `${words.slice(0, START_WORDS).join(' ')}…` : `${words[0]}…`
}

// Stages 3 (with hints) and 4 (no help): write the key points, then self-assess with a checklist.
// Also used by the mock exam, where `outcomeFor` is null and progress is not affected.
// `askHints` lets the user reveal help step by step (WRITE_HINT_LEVELS), recorded as hintsUsed.
// With `hintsCapResult` (stage 4 of a study session) using any hint turns a pass into "partial",
// so a question is only mastered when recalled with no help.
export default function RecallStage({
  question,
  withHints,
  askHints = false,
  hintsCapResult = false,
  readFirst = false,
  outcomeFor,
  practice,
  onDone,
  onRetry,
}) {
  const { t } = useI18n()
  const [typed, setTyped] = useState('')
  // [reading →] writing → comparing (tick the key points; the result is not shown yet) → assessed; or gaveUp.
  // With `readFirst` the answer is shown first; "I'm ready" hides it and the user writes it from memory.
  const [phase, setPhase] = useState(readFirst ? 'reading' : 'writing')
  const [ticked, setTicked] = useState(() => question.keyPoints.map(() => false))
  const [hintLevel, setHintLevel] = useState(0)
  const nextHint = WRITE_HINT_LEVELS[hintLevel]
  const suggested = useMemo(
    () => (phase === 'writing' ? [] : suggestKeyPoints(question.keyPoints, typed)),
    [phase, question.keyPoints, typed],
  )

  // Comparing starts with the suggested key points already ticked; the user unticks what doesn't apply.
  const compare = () => {
    setTicked(suggestKeyPoints(question.keyPoints, typed))
    setPhase('comparing')
  }
  useEnterHotkey(() => setPhase('writing'), phase === 'reading')
  useEnterHotkey(compare, phase === 'writing')
  useEnterHotkey(() => setPhase('assessed'), phase === 'comparing')

  const total = question.keyPoints.length
  const count = ticked.filter(Boolean).length
  const ratio = phase === 'gaveUp' ? 0 : count / total
  const capped = hintsCapResult && hintLevel > 0 && recallResult(ratio) === 'passed'
  const result = capped ? 'partial' : recallResult(ratio)
  const showFullAnswer = !withHints || phase === 'gaveUp'
  const record = { result, ratio, response: { typed, ticked, gaveUp: phase === 'gaveUp', hintsUsed: hintLevel } }

  if (phase === 'reading') {
    return (
      <div className="space-y-4">
        <div className="rounded-box border border-primary/30 bg-primary/5 p-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">{t('stages.recall.readTitle')}</div>
          <p className="select-none leading-relaxed">
            <MarkedText text={question.answer} keywords={question.cloze.blanks} />
          </p>
        </div>
        <p className="text-sm opacity-70">{t('stages.recall.readHelp')}</p>
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={() => setPhase('writing')} autoFocus>
            {t('stages.recall.ready')}
            <kbd className="kbd kbd-sm hidden sm:inline-flex">Enter</kbd>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {askHints && phase === 'writing' && (
        <div className="flex items-center justify-end gap-1">
          <button type="button" className="btn btn-outline btn-warning btn-sm" onClick={() => setHintLevel((l) => l + 1)} disabled={!nextHint}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {nextHint ? t(`writeHints.${nextHint}`) : t('choice.noMoreHints')}
            <span className="badge badge-warning badge-sm">
              {hintLevel}/{WRITE_HINT_LEVELS.length}
            </span>
          </button>
          <InfoTip text={t('info.writeHints')} />
        </div>
      )}

      {askHints && hintLevel >= 1 && (
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
          {hintLevel >= 3 && (
            <div className="mt-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-info">{t('writeHints.startsTitle')}</div>
              <ul className="list-inside list-disc space-y-0.5">
                {question.keyPoints.map((p, i) => (
                  <li key={i}>{keyPointStart(p)}</li>
                ))}
              </ul>
            </div>
          )}
          {hintLevel >= 4 && (
            <div className="mt-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-info">{t('writeHints.summaryTitle')}</div>
              <p className="leading-relaxed">
                <MaskedSummary cloze={question.cloze} />
              </p>
            </div>
          )}
        </div>
      )}

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
            <button type="button" className="btn btn-primary" onClick={compare}>
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

          {phase === 'comparing' ? (
            <div className="flex justify-end">
              <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={() => setPhase('assessed')}>
                {t('stages.recall.showResult', { count, total })}
                <kbd className="kbd kbd-sm hidden sm:inline-flex">Enter</kbd>
              </button>
            </div>
          ) : (
          <ResultPanel
            focusNext={false}
            result={result}
            detail={[
              phase === 'gaveUp' ? null : t('stages.recall.score', { count, total, pct: Math.round(ratio * 100) }),
              hintLevel ? t('choice.hintsUsed', { count: hintLevel }) : null,
              capped ? t('writeHints.capped') : null,
            ]
              .filter(Boolean)
              .join(' · ') || null}
            outcome={outcomeFor ? outcomeFor(result) : null}
            answer={question.answer}
            keywords={question.cloze.blanks}
            showAnswerToggle={!showFullAnswer}
            practice={practice}
            onRetry={result === 'failed' ? () => onRetry(record) : null}
            onNext={() => onDone(record)}
          />
          )}
        </>
      )}
    </div>
  )
}
