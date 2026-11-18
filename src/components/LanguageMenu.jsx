import { useEffect, useRef } from 'react'
import { LANGUAGES, useI18n } from '../i18n.jsx'

// Language picker for the navbar: globe icon + current language (only the icon on phones).
export default function LanguageMenu() {
  const { t, lang, setLang } = useI18n()
  const ref = useRef(null)

  // Close when clicking anywhere else.
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current?.open && !ref.current.contains(e.target)) ref.current.open = false
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  const choose = (code) => {
    setLang(code)
    if (ref.current) ref.current.open = false
  }

  return (
    <details ref={ref} className="dropdown dropdown-end">
      <summary className="btn btn-ghost btn-sm gap-1.5" aria-label={t('app.language')} title={t('app.language')}>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" strokeLinejoin="round" />
        </svg>
        <span className="hidden sm:inline">{LANGUAGES[lang].languageName}</span>
        <svg viewBox="0 0 24 24" className="hidden size-3 sm:inline" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <ul className="menu dropdown-content z-30 mt-1 w-40 rounded-box border border-base-300 bg-base-100 p-1 shadow-lg">
        {Object.keys(LANGUAGES).map((code) => (
          <li key={code}>
            <button type="button" className={code === lang ? 'menu-active' : ''} onClick={() => choose(code)} lang={code}>
              {LANGUAGES[code].languageName}
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
