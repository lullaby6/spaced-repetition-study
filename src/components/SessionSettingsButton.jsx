import { useState } from 'react'
import { useI18n } from '../i18n.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import Tooltip, { InfoTip } from './Tooltip.jsx'

const READ_RATES = [0.8, 1, 1.2, 1.5, 1.75, 2]

// Gear button in a running session: change settings without leaving it (read aloud, voice speed and
// "don't go back on failure"). Changes apply right away through `onChange(partialSettings)`.
export default function SessionSettingsButton({ autoRead, readRate, noBacktrack, onChange }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Tooltip text={t('sessionSettings.title')} side="bottom">
        <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={() => setOpen(true)} aria-label={t('sessionSettings.title')}>
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path
              d="M10.3 4.3c.4-1.7 2.9-1.7 3.4 0a1.7 1.7 0 0 0 2.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 0 0 1 2.5c1.8.4 1.8 2.9 0 3.4a1.7 1.7 0 0 0-1 2.6c.9 1.5-.9 3.3-2.4 2.4a1.7 1.7 0 0 0-2.6 1c-.4 1.8-3 1.8-3.4 0a1.7 1.7 0 0 0-2.5-1c-1.6.9-3.3-.9-2.4-2.4a1.7 1.7 0 0 0-1.1-2.6c-1.7-.4-1.7-3 0-3.4a1.7 1.7 0 0 0 1.1-2.5c-.9-1.6.8-3.3 2.4-2.4a1.7 1.7 0 0 0 2.5-1.1Z"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </Tooltip>
      <ConfirmModal open={open} title={t('sessionSettings.title')} onClose={() => setOpen(false)} closeLabel={t('common.close')}>
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm mt-0.5"
              checked={autoRead}
              onChange={(e) => onChange({ autoRead: e.target.checked })}
            />
            <span>
              <span className="font-semibold">{t('setup.autoRead')}</span> <InfoTip text={t('info.autoRead')} />
              <span className="block text-sm opacity-70">{t('setup.autoReadHelp')}</span>
            </span>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-semibold">{t('listen.rateLabel')}</span>
            <select
              className="select select-bordered select-sm w-auto"
              value={readRate}
              onChange={(e) => onChange({ readRate: Number(e.target.value) })}
            >
              {READ_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}×
                </option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm mt-0.5"
              checked={noBacktrack}
              onChange={(e) => onChange({ noBacktrack: e.target.checked })}
            />
            <span>
              <span className="font-semibold">{t('setup.noBacktrack')}</span> <InfoTip text={t('info.noBacktrack')} />
              <span className="block text-sm opacity-70">{t('setup.noBacktrackHelp')}</span>
            </span>
          </label>
          <p className="text-sm opacity-70">{t('sessionSettings.saved')}</p>
        </div>
      </ConfirmModal>
    </>
  )
}
