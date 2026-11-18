import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import es from './languages/es.js'
import en from './languages/en.js'

export const LANGUAGES = { es, en }
const STORAGE_KEY = 'study-app-language'
// Missing translation keys fall back to Spanish, the language the strings are written in first.
const FALLBACK = 'es'
// Language for browsers whose language is not one of LANGUAGES.
const DEFAULT_FOR_OTHERS = 'en'

// A language the user picked wins; otherwise use the browser's (any es-* variant → es).
function detectLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LANGUAGES[saved]) return saved
  } catch {
    /* storage unavailable */
  }
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language || '']
  const primary = preferred[0].toLowerCase().split('-')[0]
  return LANGUAGES[primary] ? primary : DEFAULT_FOR_OTHERS
}

function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict)
}

// Translates `key` (dot path) and replaces {placeholders} with values from `params`.
export function translate(lang, key, params = {}) {
  let value = lookup(LANGUAGES[lang], key)
  if (value === undefined) value = lookup(LANGUAGES[FALLBACK], key)
  if (typeof value !== 'string') return key
  return value.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLanguage)

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = translate(lang, 'app.title')
  }, [lang])

  // Only an explicit choice is stored, so until then the browser language keeps deciding.
  const setLang = useCallback((next) => {
    if (!LANGUAGES[next]) return
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage unavailable */
    }
  }, [])
  const t = useCallback((key, params) => translate(lang, key, params), [lang])
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}
