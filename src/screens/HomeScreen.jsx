import { useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { ACCEPTED_EXTENSIONS } from '../lib/bank.js'
import StatusBar from '../components/StatusBar.jsx'
import Tooltip from '../components/Tooltip.jsx'

function WarningsList({ warnings }) {
  const { t } = useI18n()
  if (!warnings?.length) return null
  return (
    <div role="alert" className="alert alert-warning items-start">
      <div>
        <div className="font-bold">{t('home.warningsTitle', { count: warnings.length })}</div>
        <ul className="mt-1 list-inside list-disc text-sm">
          {warnings.map((w, i) => (
            <li key={i}>
              {t('exercise.questionNumber', { id: w.id })}: {t(`warnings.${w.code}`, w.params)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function HomeScreen({
  banks,
  activeBank,
  topics,
  disabledTopics,
  inactiveCount,
  counts,
  hasSession,
  dueReviews,
  onSwitchBank,
  onRenameBank,
  onEditBank,
  onDeleteBank,
  onUpload,
  onContinue,
  onNewSession,
  onReview,
  onExam,
  onStartOver,
  onShowAiPrompt,
  onShowHelp,
  deletedBanks = 0,
  onOpenDeletedBanks,
  onListen,
  onBrowse,
}) {
  const { t } = useI18n()
  const fileRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    setLoading(true)
    try {
      await onUpload(file)
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const bank = activeBank?.questions ?? []
  const hasBank = bank.length > 0
  const hasProgress = counts.learning + counts.review + counts.mastered > 0 || hasSession
  const aiButton = (
    <button type="button" className="btn btn-outline btn-secondary" onClick={onShowAiPrompt}>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Zm7 12 .9 2.1 2.1.9-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" strokeLinejoin="round" />
      </svg>
      {t('home.aiPrompt')}
    </button>
  )

  const helpButton = (
    <button type="button" className="btn btn-ghost" onClick={onShowHelp}>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.5" strokeLinecap="round" />
      </svg>
      {t('home.howItWorks')}
    </button>
  )

  const deletedBanksButton =
    deletedBanks > 0 ? (
      <button type="button" className="btn btn-ghost" onClick={onOpenDeletedBanks}>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t('home.deletedBanks', { count: deletedBanks })}
      </button>
    ) : null

  return (
    <div className="space-y-6">
      {!hasBank && (
        <section className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body items-center gap-3 p-6 text-center">
            <h2 className="card-title">{t('home.emptyTitle')}</h2>
            <p className="max-w-prose opacity-70">{t('home.emptyHelp')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {aiButton}
              {helpButton}
              {deletedBanksButton}
            </div>
          </div>
        </section>
      )}

      {hasBank && (
      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4 p-4 sm:p-6">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-60">
              {banks.length > 1 ? t('home.banksCount', { count: banks.length }) : t('home.currentBank')}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {banks.length > 1 ? (
                <select
                  className="select select-bordered min-w-0 basis-full font-semibold sm:flex-1 sm:basis-0"
                  value={activeBank.id}
                  onChange={(e) => onSwitchBank(e.target.value)}
                  aria-label={t('home.chooseBank')}
                >
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <h2 className="card-title min-w-0 basis-full text-lg [overflow-wrap:anywhere] sm:flex-1 sm:basis-0">{activeBank.name}</h2>
              )}
              <div className="flex gap-1">
                <button type="button" className="btn btn-outline btn-sm" onClick={onEditBank}>
                  {t('home.editBank')}
                </button>
                <Tooltip text={t('home.renameBank')}>
                  <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={onRenameBank} aria-label={t('home.renameBank')}>
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </Tooltip>
                <Tooltip text={t('home.deleteBankHelp')} side="left">
                  <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={onDeleteBank} aria-label={t('home.deleteBank')}>
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </Tooltip>
              </div>
            </div>
            <p className="text-lg">
              {t('home.summary', { questions: bank.length, topics: topics.length })}
              {inactiveCount > 0 && <span className="text-base opacity-60"> · {t('home.inactive', { count: inactiveCount })}</span>}
            </p>
          </div>

          <details className="collapse collapse-arrow border border-base-300 bg-base-200/50">
            <summary className="collapse-title min-h-0 py-3 font-medium">{t('home.topicsList')}</summary>
            <div className="collapse-content">
              <ul className="space-y-1 text-sm">
                {topics.map((topic) => (
                  <li key={topic} className={`flex justify-between gap-4 ${disabledTopics.includes(topic) ? 'line-through opacity-50' : ''}`}>
                    <span>{topic}</span>
                    <span className="opacity-60">{bank.filter((q) => q.topic === topic).length}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>

          <WarningsList warnings={activeBank.warnings} />
          <StatusBar counts={counts} />

          <div className="grid gap-2 sm:grid-cols-2">
            {hasSession && (
              <button type="button" className="btn btn-primary sm:col-span-2" onClick={onContinue}>
                {t('home.continue')}
              </button>
            )}
            <button type="button" className={`btn ${hasSession ? 'btn-outline' : 'btn-primary'} sm:col-span-2`} onClick={onNewSession}>
              {hasSession ? t('home.newSession') : hasProgress ? t('home.keepStudying') : t('home.start')}
            </button>
            <Tooltip text={t('info.review')} className="block">
              <button type="button" className="btn btn-outline w-full" onClick={onReview} disabled={!counts.mastered}>
                {t('home.review')}
                {dueReviews > 0 && <span className="badge badge-secondary badge-sm">{dueReviews}</span>}
              </button>
            </Tooltip>
            <Tooltip text={t('info.exam')} className="block">
              <button type="button" className="btn btn-outline w-full" onClick={onExam}>
                {t('home.exam')}
              </button>
            </Tooltip>
            <Tooltip text={t('browse.help')} className="block sm:col-span-2">
              <button type="button" className="btn btn-outline w-full" onClick={onBrowse}>
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M2 6.5C4.5 5 7.5 5 12 7c4.5-2 7.5-2 10-.5V19c-2.5-1.5-5.5-1.5-10 .5-4.5-2-7.5-2-10-.5V6.5ZM12 7v12.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t('browse.title')}
              </button>
            </Tooltip>
            <Tooltip text={t('listen.help')} className="block sm:col-span-2">
              <button type="button" className="btn btn-outline w-full" onClick={onListen}>
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1v-6h3v4ZM3 19a2 2 0 0 0 2 2h1v-6H3v4Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t('listen.title')}
              </button>
            </Tooltip>
          </div>
          {hasProgress && (
            <div className="flex justify-center">
              <button type="button" className="btn btn-ghost btn-sm text-error" onClick={onStartOver}>
                {t('home.startOver')}
              </button>
            </div>
          )}
        </div>
      </section>
      )}

      <section
        className={`rounded-box border-2 border-dashed p-6 text-center transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-base-300'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFile(e.dataTransfer.files?.[0])
        }}
      >
        <h3 className="font-semibold">{hasBank ? t('home.uploadTitle') : t('home.uploadFirst')}</h3>
        <p className="mx-auto mt-1 max-w-prose text-sm opacity-70">{t('home.uploadHelp')}</p>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button type="button" className="btn btn-outline btn-sm mt-3" onClick={() => fileRef.current?.click()} disabled={loading}>
          {loading && <span className="loading loading-spinner loading-xs" />}
          {loading ? t('home.reading') : t('home.uploadButton')}
        </button>
      </section>

      {hasBank && (
        <div className="flex flex-wrap justify-center gap-2">
          {aiButton}
          {helpButton}
          {deletedBanksButton}
        </div>
      )}
    </div>
  )
}
