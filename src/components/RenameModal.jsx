import { useEffect, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import ConfirmModal from './ConfirmModal.jsx'

// Asks for a new name for the active bank.
export default function RenameModal({ open, initialName, onSave, onClose }) {
  const { t } = useI18n()
  const [name, setName] = useState(initialName)

  useEffect(() => {
    if (open) setName(initialName)
  }, [open, initialName])

  const save = () => {
    const trimmed = name.trim()
    if (trimmed) onSave(trimmed)
  }

  return (
    <ConfirmModal
      open={open}
      title={t('modal.renameTitle')}
      onClose={onClose}
      actions={[{ label: t('common.save'), className: 'btn-primary', onClick: save }]}
    >
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t('modal.renameLabel')}</span>
        <input
          type="text"
          className="input input-bordered w-full"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
          autoFocus
        />
      </label>
    </ConfirmModal>
  )
}
