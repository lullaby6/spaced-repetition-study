import { useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { InfoTip } from '../components/Tooltip.jsx'
import { DEFAULT_EXAM_SIZE, EXAM_SIZES, resolveExamSize } from '../lib/exam.js'

// Session settings (topics, order, new questions per session), or mock exam settings
// (type, order, how many questions, topics). `topicCounts` maps each topic to its active questions.
export default function SetupScreen({ purpose, topics, topicCounts, settings, hasSession, onStart, onCancel }) {
  const { t } = useI18n()
  const [selected, setSelected] = useState(() => new Set((settings.topics || topics).filter((tp) => topics.includes(tp))))
  const [order, setOrder] = useState(settings.order)
  const [newPerSession, setNewPerSession] = useState(settings.newPerSession)
  const [examMode, setExamMode] = useState(settings.examMode || 'choice') // 'choice' | 'write'
  const [examOrder, setExamOrder] = useState(settings.examOrder || 'random') // 'random' | 'bank'
  // A preset (5, 10, 20, 'half', 'all') or 'custom' with its own number.
  const savedSize = settings.examSize ?? DEFAULT_EXAM_SIZE
  const [examSize, setExamSize] = useState(EXAM_SIZES.includes(savedSize) ? savedSize : 'custom')
  const [customSize, setCustomSize] = useState(EXAM_SIZES.includes(savedSize) ? '' : String(savedSize))
  const isExam = purpose === 'exam'

  const available = topics.filter((tp) => selected.has(tp)).reduce((sum, tp) => sum + (topicCounts?.get(tp) || 0), 0)
  const sizeValue = examSize === 'custom' ? Number(customSize) || DEFAULT_EXAM_SIZE : examSize
  const examCount = resolveExamSize(sizeValue, available)
  const sizeLabel = (size) =>
    size === 'half' ? t('setup.examSize_half') : size === 'all' ? t('setup.examSize_all') : String(size)

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
      examMode,
      examOrder,
      examSize: sizeValue,
    })
  }

  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-5 p-4 sm:p-6">
        <h2 className="card-title">{isExam ? t('setup.examTitle') : t('setup.title')}</h2>
        {isExam && <p className="opacity-70">{t('setup.examHelp')}</p>}

        {isExam && (
          <fieldset className="space-y-2">
            <legend className="font-semibold">{t('setup.examMode')}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {['choice', 'write'].map((mode) => (
                <label
                  key={mode}
                  className={`flex cursor-pointer items-start gap-3 rounded-box border-2 p-3 ${examMode === mode ? 'border-primary bg-primary/5' : 'border-base-300'}`}
                >
                  <input type="radio" name="exam-mode" className="radio radio-primary radio-sm mt-0.5" checked={examMode === mode} onChange={() => setExamMode(mode)} />
                  <span>
                    <span className="block font-medium">{t(`setup.examMode_${mode}`)}</span>
                    <span className="block text-sm opacity-70">{t(`setup.examModeHelp_${mode}`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {isExam && (
          <fieldset className="space-y-2">
            <legend className="font-semibold">
              {t('setup.examOrder')} <InfoTip text={t('info.examOrder')} />
            </legend>
            <div className="flex flex-wrap gap-4">
              {['random', 'bank'].map((value) => (
                <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2">
                  <input type="radio" name="exam-order" className="radio radio-primary radio-sm" checked={examOrder === value} onChange={() => setExamOrder(value)} />
                  {t(`setup.examOrder_${value}`)}
                </label>
              ))}
            </div>
          </fieldset>
        )}

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

        {isExam && (
          <fieldset className="space-y-2">
            <legend className="font-semibold">
              {t('setup.examSize')} <InfoTip text={t('info.examSize')} />
            </legend>
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t('setup.examSize')}>
              {[...EXAM_SIZES, 'custom'].map((size) => (
                <button
                  key={size}
                  type="button"
                  role="radio"
                  aria-checked={examSize === size}
                  className={`btn btn-sm min-w-11 ${examSize === size ? 'btn-primary' : 'btn-outline'} ${
                    examSize !== size && typeof size === 'number' && size > available ? 'opacity-50' : ''
                  }`}
                  onClick={() => setExamSize(size)}
                >
                  {size === 'custom' ? t('setup.examSize_custom') : sizeLabel(size)}
                </button>
              ))}
              {examSize === 'custom' && (
                <input
                  type="number"
                  min="1"
                  max={available || undefined}
                  inputMode="numeric"
                  className="input input-bordered input-sm w-24"
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                  placeholder={String(DEFAULT_EXAM_SIZE)}
                  aria-label={t('setup.examSize_custom')}
                  autoFocus
                />
              )}
            </div>
            <p className="text-sm opacity-70">{t('setup.examSizeResult', { count: examCount, available })}</p>
          </fieldset>
        )}

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
          <button type="button" className="btn btn-primary" onClick={start} disabled={selected.size === 0 || (isExam && !examCount)}>
            {isExam ? t('setup.startExam') : t('setup.start')}
          </button>
        </div>
      </div>
    </div>
  )
}
