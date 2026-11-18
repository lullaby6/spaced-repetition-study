// Copies text to the clipboard. Falls back to selecting `fallbackEl` (an input or textarea with the
// text) and the legacy copy command for older browsers or non-secure contexts.
export async function copyText(text, fallbackEl) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    if (!fallbackEl) return false
    fallbackEl.focus()
    fallbackEl.select()
    return document.execCommand?.('copy') ?? false
  }
}
