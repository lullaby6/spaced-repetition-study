// Moving banks + progress to another device with a link. The data travels inside the URL fragment
// (after "#"), which browsers never send to the server: it only exists in the link itself.
import { BACKUP_APP_ID, BACKUP_VERSION } from './storage.js'

export const SHARE_PARAM = 'import'
// Longer links may be cut by some chat apps (e.g. WhatsApp allows ~65,000 characters per message).
export const SHARE_SAFE_LENGTH = 60000

// What goes in the link: banks with their progress and settings (no sessions, no trash, to keep it short).
export function buildShareData(library) {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    activeId: library.activeId,
    banks: library.banks.map(({ session, ...bank }) => bank),
  }
}

function toBase64Url(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

async function transform(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer())
}

const canCompress = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'

// Data → text for the link: "z" + deflate + base64url when the browser can compress, "j" + base64url otherwise.
export async function encodeShare(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  if (canCompress) return `z${toBase64Url(await transform(bytes, new CompressionStream('deflate-raw')))}`
  return `j${toBase64Url(bytes)}`
}

export async function decodeShare(text) {
  const kind = text[0]
  let bytes = fromBase64Url(text.slice(1))
  if (kind === 'z') bytes = await transform(bytes, new DecompressionStream('deflate-raw'))
  else if (kind !== 'j') throw new Error('unknownFormat')
  return JSON.parse(new TextDecoder().decode(bytes))
}

export async function buildShareLink(library) {
  // Always the site's home (not the current tab, e.g. /data), under its base path.
  const base = `${location.origin}${import.meta.env.BASE_URL}`
  return `${base}#${SHARE_PARAM}=${await encodeShare(buildShareData(library))}`
}

// The shared data in the current URL, if any (as text, still encoded).
export function sharedDataInUrl() {
  const match = location.hash.match(new RegExp(`^#${SHARE_PARAM}=(.+)$`))
  return match ? match[1] : null
}

export function clearSharedDataFromUrl() {
  history.replaceState(null, '', `${location.pathname}${location.search}`)
}
