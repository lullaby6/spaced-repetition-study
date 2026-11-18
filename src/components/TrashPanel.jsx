import { useState } from 'react'
import { useI18n } from '../i18n.jsx'

const ICONS = {
  bank: 'M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Zm0 0A2 2 0 0 0 6 22h13',
  question: 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  progress: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5',
}

// Items taken down to the trash (deleted banks/questions, reset progress), each with "Restore" and
// "Delete forever" (asks first). "Empty" deletes every listed item forever (also asks first).
// `filter` narrows them: { types: ['bank' | 'question' | 'progress'], bankId }.
export default function TrashPanel({ trash, filter = {}, onRestore, onDeleteForever }) {
  const { t, lang } = useI18n()
  const [confirm, setConfirm] = useState(null) // item id, 'all', or null
  const items = trash.filter(
    (x) => (!filter.types || filter.types.includes(x.type)) && (!filter.bankId || x.type === 'bank' || x.bankId === filter.bankId),
  )
  const date = new Intl.DateTimeFormat(lang, { dateStyle: 'short', timeStyle: 'short' })

  if (!items.length) return <p className="text-sm opacity-60">{t('trash.empty')}</p>

  const removeForever = (ids) => {
    setConfirm(null)
    onDeleteForever(ids)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {confirm === 'all' ? (
          <>
            <span className="text-sm text-error">{t('trash.confirmEmpty', { count: items.length })}</span>
            <button type="button" className="btn btn-error btn-xs" onClick={() => removeForever(items.map((x) => x.id))}>
              {t('trash.yesDeleteForever')}
            </button>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => setConfirm('all')}>
            {t('trash.empty_all', { count: items.length })}
          </button>
        )}
      </div>

      <ul className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-box border border-base-300 p-2">
            <svg viewBox="0 0 24 24" className="size-5 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d={ICONS[item.type]} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium">{describe(item, t)}</div>
              <div className="text-xs opacity-60">{t('trash.deletedAt', { date: date.format(new Date(item.deletedAt)) })}</div>
            </div>
            {confirm === item.id ? (
              <div className="flex basis-full flex-wrap items-center justify-end gap-1">
                <span className="text-sm text-error">{t('trash.confirmForever')}</span>
                <button type="button" className="btn btn-error btn-xs" onClick={() => removeForever([item.id])}>
                  {t('trash.yesDeleteForever')}
                </button>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setConfirm(null)}>
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button type="button" className="btn btn-outline btn-primary btn-xs" onClick={() => onRestore(item.id)}>
                  {t('trash.restore')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-square text-error"
                  onClick={() => setConfirm(item.id)}
                  title={t('trash.deleteForever')}
                  aria-label={t('trash.deleteForever')}
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function describe(item, t) {
  if (item.type === 'bank') return t('trash.bank', { name: item.bank.name, count: item.bank.questions.length })
  if (item.type === 'question')
    return t('trash.question', { id: item.question.id, question: item.question.question, bank: item.bankName })
  return item.ids?.length
    ? t('trash.progressSome', { ids: item.ids.join(', '), bank: item.bankName })
    : t('trash.progressAll', { bank: item.bankName })
}
