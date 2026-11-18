import { useI18n } from '../i18n.jsx'
import { InfoTip } from './Tooltip.jsx'

const SEGMENTS = [
  { status: 'new', bar: 'bg-base-300', dot: 'bg-base-content/30' },
  { status: 'learning', bar: 'bg-warning', dot: 'bg-warning' },
  { status: 'review', bar: 'bg-error', dot: 'bg-error' },
  { status: 'mastered', bar: 'bg-success', dot: 'bg-success' },
]

// Stacked bar with how many questions are in each status.
export default function StatusBar({ counts, compact = false }) {
  const { t } = useI18n()
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1
  return (
    <div className="w-full">
      <div className={`flex w-full overflow-hidden rounded-full bg-base-200 ${compact ? 'h-2' : 'h-3'}`}>
        {SEGMENTS.map(({ status, bar }) =>
          counts[status] ? (
            <div key={status} className={`${bar} transition-all`} style={{ width: `${(counts[status] / total) * 100}%` }} />
          ) : null,
        )}
      </div>
      <div className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 ${compact ? 'text-xs' : 'text-sm'}`}>
        {SEGMENTS.map(({ status, dot }) =>
          status === 'review' && !counts.review ? null : (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className={`inline-block size-2.5 rounded-full ${dot}`} />
              {t(`status.plural.${status}`)}: <strong>{counts[status]}</strong>
            </span>
          ),
        )}
        {!compact && <InfoTip text={t('info.status')} />}
      </div>
    </div>
  )
}
