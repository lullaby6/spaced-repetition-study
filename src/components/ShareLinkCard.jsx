import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import { copyText } from '../lib/clipboard.js'
import { buildShareLink, SHARE_SAFE_LENGTH } from '../lib/share.js'

const FEEDBACK_MS = 2000

// "Move to another device with a link": builds a link that carries the banks and progress.
export default function ShareLinkCard({ library }) {
  const { t, lang } = useI18n()
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [copyState, setCopyState] = useState('idle') // idle | copied | failed
  const inputRef = useRef(null)
  const canShare = typeof navigator !== 'undefined' && !!navigator.share
  const hasBanks = library.banks.length > 0

  // A link made earlier would carry old data: drop it when the data changes.
  useEffect(() => setLink(''), [library.banks])

  useEffect(() => {
    if (copyState === 'idle') return undefined
    const id = setTimeout(() => setCopyState('idle'), FEEDBACK_MS)
    return () => clearTimeout(id)
  }, [copyState])

  const create = async () => {
    setBusy(true)
    try {
      setLink(await buildShareLink(library))
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => setCopyState((await copyText(link, inputRef.current)) ? 'copied' : 'failed')
  const share = () => navigator.share({ title: t('app.title'), text: t('share.shareText'), url: link }).catch(() => {})

  const tooLong = link.length > SHARE_SAFE_LENGTH
  const size = new Intl.NumberFormat(lang).format(link.length)

  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">{t('share.title')}</h2>
            <p className="text-sm opacity-70">{t('share.help')}</p>
          </div>
          <button type="button" className="btn btn-primary shrink-0" onClick={create} disabled={!hasBanks || busy}>
            {busy && <span className="loading loading-spinner loading-xs" />}
            {link ? t('share.recreate') : t('share.create')}
          </button>
        </div>

        {link && (
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                ref={inputRef}
                type="text"
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                className="input input-bordered w-full font-mono text-xs"
                aria-label={t('share.title')}
              />
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className={`btn ${copyState === 'copied' ? 'btn-success' : copyState === 'failed' ? 'btn-error' : 'btn-outline'} flex-1`}
                  onClick={copy}
                >
                  {copyState === 'copied' ? t('aiPrompt.copiedButton') : t('share.copy')}
                </button>
                {canShare && (
                  <button type="button" className="btn btn-outline flex-1" onClick={share}>
                    {t('share.share')}
                  </button>
                )}
              </div>
            </div>
            <p role="status" aria-live="polite" className={`text-sm ${copyState === 'failed' ? 'text-error' : 'opacity-70'}`}>
              {copyState === 'failed' ? t('aiPrompt.copyFailed') : t('share.size', { size })}
            </p>
            {tooLong && <div className="alert alert-warning text-sm">{t('share.tooLong')}</div>}
            <p className="text-xs opacity-60">{t('share.privacy')}</p>
          </div>
        )}
      </div>
    </section>
  )
}
