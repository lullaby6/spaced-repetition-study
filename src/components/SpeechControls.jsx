import { useI18n } from '../i18n.jsx'
import Tooltip from './Tooltip.jsx'

// Play / pause / resume, "from the start" and stop for a useSpeech() instance.
// `active` says whether this text is the one the speech is reading (several texts can share one voice).
export default function SpeechControls({ speech, active, onToggle, onRestart, label }) {
  const { t } = useI18n()
  const status = active ? speech.status : 'idle'
  const mainLabel = { idle: t('stages.copy.listen'), speaking: t('stages.copy.pause'), paused: t('stages.copy.resume') }[status]

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className={`btn btn-xs ${status === 'idle' ? 'btn-ghost' : 'btn-primary'}`}
        onClick={onToggle}
        aria-label={status === 'idle' && label ? label : mainLabel}
        title={status === 'idle' && label ? label : mainLabel}
      >
        {status === 'speaking' ? (
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : status === 'paused' ? (
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
            <path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5Zm4.5 3.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <span className="hidden sm:inline">{mainLabel}</span>
      </button>
      {status !== 'idle' && (
        <>
          <Tooltip text={t('stages.copy.restart')}>
            <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={onRestart} aria-label={t('stages.copy.restart')}>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </Tooltip>
          <Tooltip text={t('stages.copy.stop')}>
            <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={speech.stop} aria-label={t('stages.copy.stop')}>
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
            </button>
          </Tooltip>
        </>
      )}
    </div>
  )
}
