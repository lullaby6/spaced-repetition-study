import { useMemo, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { countStatuses, initialProgress } from '../lib/queue.js'
import StatusBar from '../components/StatusBar.jsx'
import Tooltip, { InfoTip } from '../components/Tooltip.jsx'
import { isQuestionActive } from '../lib/bank.js'
import { normalize } from '../lib/text.js'

const STATUS_BADGE = {
  new: 'badge-ghost',
  learning: 'badge-warning',
  review: 'badge-error',
  mastered: 'badge-success',
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Table of every question with its stage and status, filterable by topic and status.
// Any started question can be put back to "new"; `lastKey` is the most recently answered one,
// so resetting it repeatedly walks progress back one question at a time.
export default function ProgressScreen({
  banks,
  activeBank,
  bank,
  topics,
  disabledTopics,
  progress,
  lastKey,
  onSwitchBank,
  onResetQuestion,
  onResetAll,
}) {
  const { t, lang } = useI18n()
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState('')
  const [status, setStatus] = useState('')

  const rows = useMemo(() => {
    const needle = normalize(search)
    return bank
      .map((q) => ({ q, p: progress[q.key] || initialProgress(q.key), active: isQuestionActive(q, disabledTopics) }))
      .filter(
        ({ q, p }) =>
          (!topic || q.topic === topic) &&
          (!status || p.status === status) &&
          (!needle || normalize(`${q.id} ${q.question} ${q.answer} ${q.topic}`).includes(needle)),
      )
  }, [bank, progress, disabledTopics, search, topic, status])
  // The bar counts only questions that take part in study (active ones).
  const counts = countStatuses(
    bank.filter((q) => isQuestionActive(q, disabledTopics)),
    progress,
    topic ? [topic] : null,
  )
  const dateFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'short', timeStyle: 'short' })
  const lastQuestion = lastKey ? bank.find((q) => q.key === lastKey) : null

  return (
    <div className="space-y-4">
      <div className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="card-title">{t('progress.title')}</h2>
              {activeBank && banks.length <= 1 && (
                <p className="break-all text-sm opacity-70">
                  {t('progress.bank')} <strong>{activeBank.name}</strong>
                </p>
              )}
            </div>
            {activeBank && (
              <button
                type="button"
                className="btn btn-outline btn-error btn-sm"
                onClick={onResetAll}
                disabled={!Object.values(progress).some((p) => p.status !== 'new')}
              >
                <ResetIcon />
                {t('progress.resetAll')}
              </button>
            )}
          </div>
          {activeBank && banks.length > 1 && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide opacity-60">{t('progress.bank')}</span>
              <select
                className="select select-bordered w-full font-semibold"
                value={activeBank.id}
                onChange={(e) => onSwitchBank(e.target.value)}
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <input
            type="search"
            className="input input-bordered w-full"
            placeholder={t('editor.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('editor.search')}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select className="select select-bordered w-full" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label={t('progress.topic')}>
              <option value="">{t('progress.allTopics')}</option>
              {topics.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
            <select className="select select-bordered w-full" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('progress.status')}>
              <option value="">{t('progress.allStatuses')}</option>
              {Object.keys(STATUS_BADGE).map((s) => (
                <option key={s} value={s}>
                  {t(`status.one.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <StatusBar counts={counts} />
          {lastQuestion && (
            <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-200/50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                <InfoTip text={t('info.resetLast')} /> <span className="opacity-70">{t('progress.lastStudied')}</span>{' '}
                <strong>{t('exercise.questionNumber', { id: lastQuestion.id })}</strong>
                <span className="opacity-70"> · {lastQuestion.question}</span>
              </p>
              <button type="button" className="btn btn-outline btn-warning btn-sm shrink-0" onClick={() => onResetQuestion(lastKey)}>
                <ResetIcon />
                {t('progress.resetLast')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('progress.question')}</th>
              <th className="whitespace-nowrap">
                {t('progress.stage')} <InfoTip text={t('info.stage')} />
              </th>
              <th className="whitespace-nowrap">
                {t('progress.status')} <InfoTip text={t('info.status')} />
              </th>
              <th className="whitespace-nowrap text-right">
                {t('progress.correct')} <InfoTip text={t('info.correct')} />
              </th>
              <th className="hidden md:table-cell">{t('progress.lastSeen')}</th>
              <th>
                <span className="sr-only">{t('progress.reset')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ q, p, active }) => (
              <tr key={q.key} className={`align-top ${active ? '' : 'opacity-50'}`}>
                <td className="font-semibold">{q.id}</td>
                <td className="min-w-56">
                  <div>{q.question}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="opacity-60">{q.topic}</span>
                    {!active && <span className="badge badge-ghost badge-xs">{t('editor.inactive')}</span>}
                  </div>
                </td>
                <td className="whitespace-nowrap">{p.status === 'new' ? '—' : `${p.stage} · ${t(`stage.names.${p.stage}`)}`}</td>
                <td>
                  <span className={`badge badge-sm whitespace-nowrap ${STATUS_BADGE[p.status]}`}>{t(`status.one.${p.status}`)}</span>
                </td>
                <td className="text-right whitespace-nowrap">
                  {p.correct}/{p.attempts}
                </td>
                <td className="hidden whitespace-nowrap md:table-cell">{p.lastSeen ? dateFormat.format(new Date(p.lastSeen)) : '—'}</td>
                <td className="text-right">
                  {p.status !== 'new' && (
                    <Tooltip text={t('progress.resetOne', { id: q.id })} side="left">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-square"
                        onClick={() => onResetQuestion(q.key)}
                        aria-label={t('progress.resetOne', { id: q.id })}
                      >
                        <ResetIcon />
                      </button>
                    </Tooltip>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="py-6 text-center opacity-60">
                  {t('progress.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
