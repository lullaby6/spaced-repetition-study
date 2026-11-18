import { useI18n } from '../i18n.jsx'

// Back / forward through exercises already answered. `position` is the history index being
// viewed, or null while on the current exercise (forward only exists after going back).
export default function HistoryNav({ position, total, onMove }) {
  const { t } = useI18n()
  const viewing = position !== null
  const canBack = viewing ? position > 0 : total > 0

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={!canBack}
        onClick={() => onMove(viewing ? position - 1 : total - 1)}
      >
        <span aria-hidden="true">←</span> {t('history.back')}
      </button>
      {viewing && (
        <span className="badge badge-neutral badge-soft text-center">
          {t('history.viewing', { n: position + 1, total })}
        </span>
      )}
      {viewing && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onMove(position + 1 < total ? position + 1 : null)}
        >
          {position + 1 < total ? t('history.forward') : t('history.current')} <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  )
}
