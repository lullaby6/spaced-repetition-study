import { useState } from 'react'
import { useI18n } from '../i18n.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import Tooltip from './Tooltip.jsx'

const RESULT_BADGE = { passed: 'badge-success', partial: 'badge-warning', failed: 'badge-error', skipped: 'badge-ghost' }
const RESULT_ICON = { passed: '✓', partial: '~', failed: '✗', skipped: '–' }
const STATE_BADGE = {
  current: 'badge-primary',
  pending: 'badge-ghost',
  skipped: 'badge-warning badge-soft',
  mastered: 'badge-success badge-soft',
  answered: 'badge-ghost',
  unanswered: 'badge-ghost',
  excluded: 'badge-ghost border-dashed',
}

// Small icon button for the row actions. A native title is used as its explanation because CSS
// tooltips would be cut by the scrolling list.
function IconButton({ label, danger = false, onClick, children }) {
  return (
    <button type="button" className={`btn btn-ghost btn-xs btn-square ${danger ? 'text-error' : ''}`} onClick={onClick} title={label} aria-label={label}>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        {children}
      </svg>
    </button>
  )
}

// Rows for a study session: every question seen or waiting, in the order they appeared.
export function studyOverviewRows(session, progress) {
  const excluded = session.excluded ?? []
  const skippedItems = session.skippedItems ?? []
  const keys = [
    ...new Set([
      ...session.log.map((l) => l.key),
      ...session.queue.map((i) => i.key),
      ...skippedItems.map((i) => i.key),
      ...excluded.map((i) => i.key),
    ]),
  ]
  return keys.map((key) => {
    const entries = session.log.map((l, index) => ({ ...l, index })).filter((l) => l.key === key)
    const queued = session.queue.find((i) => i.key === key)
    const skippedItem = skippedItems.find((i) => i.key === key)
    const off = excluded.find((i) => i.key === key)
    let state = 'answered'
    if (off) state = 'excluded'
    else if (skippedItem) state = 'skipped'
    else if (session.queue[0]?.key === key) state = 'current'
    else if (queued) state = 'pending'
    else if (progress[key]?.status === 'mastered') state = 'mastered'
    return {
      key,
      state,
      nextStage: queued?.stage ?? skippedItem?.stage ?? off?.stage ?? null,
      canToggle: !!(off || queued || skippedItem),
      attempts: entries.map((e) => ({ stage: e.stage, result: e.result, index: e.index })),
      hints: entries.reduce((sum, e) => sum + (e.response?.hintsUsed || 0), 0),
    }
  })
}

// Rows for a mock exam: every question in its current order.
export function examOverviewRows(exam) {
  const skipped = new Set(exam.skipped ?? [])
  const excludedRows = (exam.excluded ?? []).map((key) => ({ key, state: 'excluded', nextStage: null, canToggle: true, attempts: [], hints: 0 }))
  return exam.keys.map((key, i) => {
    const resultIndex = exam.results.findIndex((r) => r.key === key)
    const answer = exam.results[resultIndex]
    let state = 'pending'
    if (answer) state = answer.result === 'skipped' ? 'unanswered' : 'answered'
    else if (i === exam.index) state = 'current'
    else if (skipped.has(key)) state = 'skipped'
    return {
      key,
      state,
      nextStage: null,
      canToggle: !answer,
      attempts: answer ? [{ stage: null, result: answer.result, index: resultIndex }] : [],
      hints: answer?.response?.hintsUsed || 0,
    }
  }).concat(excludedRows)
}

// "Session questions" button + modal with one row per question. From it you can go to a pending or
// skipped question (`onJump(key)`) or look at an answered exercise (`onView(index)`, history index).
// It also manages questions: turn one off/on for this session or exam only (`onToggle`; the bank and
// progress are not touched) or delete it from the bank (`onDelete`, asks first).
export default function SessionOverview({ rows, bankByKey, title, onJump, onView, onCurrent, onToggle, onDelete, deletedCount = 0, onOpenDeleted }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const go = (action) => {
    setOpen(false)
    action()
  }
  const count = (state) => rows.filter((r) => r.state === state).length
  const totalHints = rows.reduce((a, r) => a + r.hints, 0)

  return (
    <>
      <Tooltip text={t('overview.help')} side="bottom">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} aria-label={title}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" />
          </svg>
          <span className="hidden sm:inline">{title}</span>
        </button>
      </Tooltip>
      <ConfirmModal open={open} title={title} onClose={() => setOpen(false)} closeLabel={t('common.close')} boxClassName="max-w-3xl">
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          {['answered', 'mastered', 'pending', 'skipped', 'unanswered', 'excluded'].map((state) =>
            count(state) ? (
              <span key={state} className={`badge ${STATE_BADGE[state]}`}>
                {t(`overview.state_${state}`)}: {count(state)}
              </span>
            ) : null,
          )}
          {totalHints > 0 && <span className="badge badge-warning badge-soft">{t('overview.hintsTotal', { count: totalHints })}</span>}
          {deletedCount > 0 && (
            <button type="button" className="btn btn-ghost btn-xs ml-auto" onClick={() => go(onOpenDeleted)}>
              {t('editor.deleted', { count: deletedCount })}
            </button>
          )}
        </div>
        <p className="mb-2 text-sm opacity-70">{t('overview.navHelp')}</p>
        <ul className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
          {rows.map((row) => {
            const q = bankByKey.get(row.key)
            if (!q) return null
            return (
              <li
                key={row.key}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-box border p-2 ${row.state === 'current' ? 'border-primary bg-primary/5' : 'border-base-300'}`}
              >
                <span className="badge badge-ghost shrink-0 font-semibold">{q.id}</span>
                <span className={`min-w-0 flex-1 text-sm ${row.state === 'excluded' ? 'line-through opacity-50' : ''}`}>{q.question}</span>
                <span className="flex flex-wrap items-center gap-1">
                  {row.attempts.map((a, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`badge badge-sm cursor-pointer hover:brightness-95 ${RESULT_BADGE[a.result]}`}
                      onClick={() => go(() => onView(a.index))}
                      title={t('overview.view', { result: t(`result.${a.result}`) })}
                    >
                      {a.stage ? `${t('overview.stageShort', { stage: a.stage })} ` : ''}
                      {RESULT_ICON[a.result]}
                    </button>
                  ))}
                  {row.hints > 0 && (
                    <span className="badge badge-sm badge-warning badge-soft">{t('overview.hints', { count: row.hints })}</span>
                  )}
                  <span className={`badge badge-sm ${STATE_BADGE[row.state]}`}>
                    {t(`overview.state_${row.state}`)}
                    {row.state === 'pending' && row.nextStage ? ` · ${t('overview.stageShort', { stage: row.nextStage })}` : ''}
                  </span>
                  {(row.state === 'pending' || row.state === 'skipped') && (
                    <button type="button" className="btn btn-primary btn-xs" onClick={() => go(() => onJump(row.key))}>
                      {t('overview.go')} →
                    </button>
                  )}
                  {row.state === 'current' && (
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => go(onCurrent)}>
                      {t('overview.goCurrent')}
                    </button>
                  )}
                </span>
                {confirmDelete === row.key ? (
                  <span className="flex basis-full items-center justify-end gap-1 text-sm">
                    <span className="text-error">{t('overview.confirmDelete')}</span>
                    <button
                      type="button"
                      className="btn btn-error btn-xs"
                      onClick={() => {
                        setConfirmDelete(null)
                        onDelete(row.key)
                      }}
                    >
                      {t('editor.yesDelete')}
                    </button>
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => setConfirmDelete(null)}>
                      {t('common.cancel')}
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5">
                    {row.canToggle && (
                    <IconButton
                      label={row.state === 'excluded' ? t('overview.turnOn') : t('overview.turnOff')}
                      onClick={() => onToggle(row.key)}
                    >
                      {row.state === 'excluded' ? (
                        <>
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      ) : (
                        <path
                          d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </IconButton>
                    )}
                    <IconButton label={t('overview.deleteFromBank')} danger onClick={() => setConfirmDelete(row.key)}>
                      <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                    </IconButton>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </ConfirmModal>
    </>
  )
}
