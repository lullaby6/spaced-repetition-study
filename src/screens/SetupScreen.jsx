import { useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { InfoTip } from '../components/Tooltip.jsx'

// Session settings (topics, order, new questions per session). For the mock exam only topics apply.
export default function SetupScreen({ purpose, topics, settings, hasSession, onStart, onCancel }) {
  const { t } = useI18n()
  const [selected, setSelected] = useState(() => new Set(settings.topics || topics))
  const [order, setOrder] = useState(settings.order)
  const [newPerSession, setNewPerSession] = useState(settings.newPerSession)
  const isExam = purpose === 'exam'

  const toggle = (topic) =>
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(topic)) next.delete(topic)
      else next.add(topic)
      return next
    })

  const start = () => {
    const chosen = topics.filter((tp) => selected.has(tp))
    onStart({
      topics: chosen.length === topics.length ? null : chosen,
      order,
      newPerSession: Math.max(1, Math.min(500, Number(newPerSession) || 15)),
    })
  }

  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-5 p-4 sm:p-6">
        <h2 className="card-title">{isExam ? t('setup.examTitle') : t('setup.title')}</h2>
        {isExam && <p className="opacity-70">{t('setup.examHelp')}</p>}

        <fieldset className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <legend className="font-semibold">
              {t('setup.topics')} <InfoTip text={isExam ? t('info.examTopics') : t('info.topics')} side="right" />
            </legend>
            <div className="flex gap-1">
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setSelected(new Set(topics))}>
                {t('setup.all')}
              </button>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setSelected(new Set())}>
                {t('setup.none')}
              </button>
            </div>
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            {topics.map((topic) => (
              <label key={topic} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-box px-2 hover:bg-base-200">
                <input type="checkbox" className="checkbox checkbox-primary checkbox-sm" checked={selected.has(topic)} onChange={() => toggle(topic)} />
                <span>{topic}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {!isExam && (
          <>
            <fieldset className="space-y-2">
              <legend className="font-semibold">
                {t('setup.order')} <InfoTip text={t('info.order')} side="right" />
              </legend>
              <div className="flex flex-wrap gap-4">
                {['bank', 'random'].map((value) => (
                  <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2">
                    <input type="radio" name="order" className="radio radio-primary radio-sm" checked={order === value} onChange={() => setOrder(value)} />
                    {t(`setup.order_${value}`)}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="max-w-xs space-y-1">
              <div className="flex items-center gap-1">
                <label htmlFor="new-per-session" className="font-semibold">
                  {t('setup.newPerSession')}
                </label>
                <InfoTip text={t('info.newPerSession')} side="right" />
              </div>
              <input
                id="new-per-session"
                type="number"
                min="1"
                max="500"
                inputMode="numeric"
                className="input input-bordered w-full"
                value={newPerSession}
                onChange={(e) => setNewPerSession(e.target.value)}
              />
            </div>
            {hasSession && <p className="text-sm text-warning">{t('setup.replacesSession')}</p>}
          </>
        )}

        <div className="card-actions flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('common.back')}
          </button>
          <button type="button" className="btn btn-primary" onClick={start} disabled={selected.size === 0}>
            {isExam ? t('setup.startExam') : t('setup.start')}
          </button>
        </div>
      </div>
    </div>
  )
}
