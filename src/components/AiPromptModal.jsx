import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import { copyText } from '../lib/clipboard.js'

const FEEDBACK_MS = 2000

// Shows the prompt to paste into an AI chat so it turns a PDF / book / notes into a question bank.
export default function AiPromptModal({ open, onClose }) {
  const { t } = useI18n()
  const [copyState, setCopyState] = useState('idle') // idle | copied | failed
  const textRef = useRef(null)
  const prompt = t('aiPrompt.text')

  useEffect(() => {
    if (copyState === 'idle') return undefined
    const id = setTimeout(() => setCopyState('idle'), FEEDBACK_MS)
    return () => clearTimeout(id)
  }, [copyState])

  const copy = async () => setCopyState((await copyText(prompt, textRef.current)) ? 'copied' : 'failed')

  const buttonClass = { idle: 'btn-primary', copied: 'btn-success', failed: 'btn-error' }[copyState]

  return (
    <ConfirmModal
      open={open}
      title={t('aiPrompt.title')}
      onClose={onClose}
      closeLabel={t('common.close')}
      boxClassName="max-w-2xl"
      actions={[]}
    >
      <ol className="mb-3 list-inside list-decimal space-y-1 text-sm opacity-80">
        <li>{t('aiPrompt.step1')}</li>
        <li>{t('aiPrompt.step2')}</li>
        <li>{t('aiPrompt.step3')}</li>
      </ol>
      <div role="note" className="alert alert-info alert-soft mb-3 items-start text-sm">
        <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <div className="font-semibold">{t('aiPrompt.tipTitle')}</div>
          <p>{t('aiPrompt.tipIntro')}</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>{t('aiPrompt.tipTotal')}</li>
            <li>{t('aiPrompt.tipPerTopic')}</li>
            <li>{t('aiPrompt.tipShorter')}</li>
            <li>{t('aiPrompt.tipCustom')}</li>
          </ul>
        </div>
      </div>
      <textarea
        ref={textRef}
        className="textarea textarea-bordered h-64 w-full font-mono text-sm leading-relaxed"
        value={prompt}
        readOnly
        onClick={(e) => e.target.select()}
        aria-label={t('aiPrompt.title')}
      />
      <div className="mt-2 flex items-center justify-end gap-3">
        <span role="status" aria-live="polite" className={`text-sm ${copyState === 'failed' ? 'text-error' : 'text-success'}`}>
          {copyState === 'copied' && t('aiPrompt.copied')}
          {copyState === 'failed' && t('aiPrompt.copyFailed')}
        </span>
        <button type="button" className={`btn ${buttonClass} min-w-32 transition-colors`} onClick={copy}>
          {copyState === 'copied' ? (
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="9" y="9" width="12" height="12" rx="2" />
              <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" strokeLinecap="round" />
            </svg>
          )}
          {copyState === 'copied' ? t('aiPrompt.copiedButton') : t('aiPrompt.copy')}
        </button>
      </div>
    </ConfirmModal>
  )
}
