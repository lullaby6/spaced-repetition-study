import { createContext, useContext, useEffect, useRef } from 'react'

// Lets a screen keep an exercise mounted (e.g. while browsing history) without its shortcuts firing.
export const HotkeysActiveContext = createContext(true)

// Alt + letter shortcut (by physical key, e.g. 'KeyP'), usable while typing in a text field.
export function useAltShortcut(code, handler, enabled = true) {
  const ref = useRef(handler)
  ref.current = handler
  const active = useContext(HotkeysActiveContext) && enabled

  useEffect(() => {
    if (!active) return undefined
    const onKeyDown = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.code !== code) return
      e.preventDefault()
      ref.current(e)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, code])
}

// Number keys 1-9 (outside text fields): handler receives the 0-based index.
export function useDigitHotkey(handler, enabled = true) {
  const ref = useRef(handler)
  ref.current = handler
  const active = useContext(HotkeysActiveContext) && enabled

  useEffect(() => {
    if (!active) return undefined
    const onKeyDown = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || !/^Digit[1-9]$/.test(e.code)) return
      const tag = e.target?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return
      e.preventDefault()
      ref.current(Number(e.code.slice(5)) - 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])
}

// Global "Enter" shortcut: plain Enter outside text fields, Ctrl/Cmd+Enter anywhere.
// Text inputs and focused buttons handle Enter themselves, so they are skipped.
export function useEnterHotkey(handler, enabled = true) {
  const ref = useRef(handler)
  ref.current = handler
  const active = useContext(HotkeysActiveContext) && enabled

  useEffect(() => {
    if (!active) return undefined
    const onKeyDown = (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return
      const tag = e.target?.tagName
      const withModifier = e.ctrlKey || e.metaKey
      if (!withModifier && (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT')) return
      e.preventDefault()
      ref.current(e)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])
}
