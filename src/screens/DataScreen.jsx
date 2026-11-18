import { useRef } from 'react'
import { useI18n } from '../i18n.jsx'
import TrashPanel from '../components/TrashPanel.jsx'
import ShareLinkCard from '../components/ShareLinkCard.jsx'

// Export / import every bank with its progress as JSON, reset the active bank's progress, and the
// trash with everything deleted or reset (always restorable).
export default function DataScreen({ hasBank, library, onExport, onImport, onReset, trash, onRestore, onDeleteForever }) {
  const { t } = useI18n()
  const fileRef = useRef(null)

  return (
    <div className="space-y-4">
      <ShareLinkCard library={library} />
      <DataCard title={t('data.exportTitle')} text={t('data.exportHelp')}>
        <button type="button" className="btn btn-primary" onClick={onExport} disabled={!hasBank}>
          {t('data.export')}
        </button>
      </DataCard>

      <DataCard title={t('data.importTitle')} text={t('data.importHelp')}>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImport(file)
            e.target.value = ''
          }}
        />
        <button type="button" className="btn btn-outline" onClick={() => fileRef.current?.click()}>
          {t('data.import')}
        </button>
      </DataCard>

      <DataCard title={t('data.resetTitle')} text={t('data.resetHelp')}>
        <button type="button" className="btn btn-error btn-outline" onClick={onReset} disabled={!hasBank}>
          {t('data.reset')}
        </button>
      </DataCard>

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-3 p-4 sm:p-6">
          <div>
            <h2 className="font-semibold">
              {t('trash.title')} <span className="font-normal opacity-60">({trash.length})</span>
            </h2>
            <p className="text-sm opacity-70">{t('trash.help')}</p>
          </div>
          <TrashPanel trash={trash} onRestore={onRestore} onDeleteForever={onDeleteForever} />
        </div>
      </section>
    </div>
  )
}

function DataCard({ title, text, children }) {
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm opacity-70">{text}</p>
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    </section>
  )
}
