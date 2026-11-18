import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n.jsx'

// Generic modal. `actions` is a list of { label, onClick, className }.
export default function ConfirmModal({ open, title, children, actions = [], onClose, closeLabel, boxClassName = '' }) {
  const { t } = useI18n()
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose}>
      <div className={`modal-box ${boxClassName}`}>
        <h3 className="text-lg font-bold">{title}</h3>
        <div className="py-3">{children}</div>
        <div className="modal-action flex-wrap">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {closeLabel || t('common.cancel')}
          </button>
          {actions.map((a) => (
            <button key={a.label} type="button" className={`btn ${a.className || 'btn-primary'}`} onClick={a.onClick}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">{t('common.close')}</button>
      </form>
    </dialog>
  )
}
