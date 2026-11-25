// Persistence in localStorage plus JSON export/import for moving progress between devices.
//
// State (v2) is a library of banks, each with its own progress, session and settings:
// { banks: [{ id, name, questions, warnings, progress, settings, session }], activeId }

const STORAGE_KEY = 'study-app-state-v2'
const LEGACY_STORAGE_KEY = 'study-app-state-v1'
export const BACKUP_APP_ID = 'study-app'
export const BACKUP_VERSION = 2
export const DEFAULT_SETTINGS = {
  topics: null,
  order: 'bank',
  newPerSession: 15,
  maxLearning: 4, // questions being learned at once
  stages: [1, 2, 3],
  noBacktrack: false,
  readFirst: true, // stage 3 shows the answer until "I'm ready"
  autoRead: true, // read each exercise aloud when it appears
  readRate: 1,
}

export function newBankId() {
  return globalThis.crypto?.randomUUID?.() ?? `bank-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// `disabledTopics` lists the topics turned off in this bank; single questions use `question.disabled`.
export function createBank({ name, questions, warnings = [], progress = {}, settings = DEFAULT_SETTINGS, session = null, disabledTopics = [] }) {
  return { id: newBankId(), name, questions, warnings, progress, settings: { ...DEFAULT_SETTINGS, ...settings }, session, disabledTopics }
}

// `trash` keeps everything that was deleted or reset so it can always be restored (see trash.js).
export const EMPTY_LIBRARY = { banks: [], activeId: null, trash: [] }

// v1 kept a single bank: { bankName, bank, warnings, progress, settings, session }.
function fromSingleBank(old) {
  if (!old?.bank?.length) return EMPTY_LIBRARY
  const bank = createBank({
    name: old.bankName || 'banco.md',
    questions: old.bank,
    warnings: old.warnings,
    progress: old.progress,
    settings: old.settings,
    session: old.session,
  })
  return { banks: [bank], activeId: bank.id, trash: [] }
}

function isLibrary(data) {
  return data && Array.isArray(data.banks)
}

// Stages are 1-3; older data could have a stage 4 (removed): it becomes the last stage.
const LAST_STAGE = 3
const fixStage = (stage) => Math.min(stage ?? 1, LAST_STAGE)
const fixItem = (item) => (item && item.stage > LAST_STAGE ? { ...item, stage: LAST_STAGE } : item)
const fixStages = (stages) => {
  if (!Array.isArray(stages)) return stages
  const kept = stages.filter((s) => s <= LAST_STAGE)
  return kept.length ? kept : [1, 2, 3]
}

function fixSession(session) {
  if (!session) return session
  return {
    ...session,
    queue: (session.queue ?? []).map(fixItem),
    skippedItems: session.skippedItems?.map(fixItem),
    excluded: session.excluded?.map(fixItem),
    options: session.options ? { ...session.options, stages: fixStages(session.options.stages) } : session.options,
  }
}

// Brings saved data up to date:
// - older versions marked a question "learning" as soon as it entered the queue, even if it was never
//   answered; those are really still new;
// - stage 4 no longer exists: anything at stage 4 moves to stage 3.
export function normalizeLibrary(library) {
  return {
    ...library,
    trash: Array.isArray(library.trash) ? library.trash : [],
    banks: library.banks.map((bank) => {
      const progress = { ...bank.progress }
      for (const [key, p] of Object.entries(progress)) {
        if (!p) continue
        if (p.status === 'learning' && !p.attempts) progress[key] = { ...p, status: 'new', stage: 1 }
        else if (p.stage > LAST_STAGE) progress[key] = { ...p, stage: fixStage(p.stage) }
      }
      const settings = bank.settings ? { ...bank.settings, stages: fixStages(bank.settings.stages) } : bank.settings
      return { ...bank, progress, settings, session: fixSession(bank.session) }
    }),
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (isLibrary(data)) return normalizeLibrary(data)
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) return normalizeLibrary(fromSingleBank(JSON.parse(legacy)))
  } catch {
    /* corrupted or unavailable storage: start empty */
  }
  return EMPTY_LIBRARY
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function buildBackup(state) {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    activeId: state.activeId,
    banks: state.banks.map(({ session, ...bank }) => bank), // sessions are not exported
    trash: state.trash ?? [],
  }
}

function isValidQuestions(questions) {
  return Array.isArray(questions) && questions.every((q) => q && q.key && q.question && Array.isArray(q.keyPoints))
}

export function isValidBackup(data) {
  if (!data || data.app !== BACKUP_APP_ID) return false
  if (Array.isArray(data.banks)) {
    return data.banks.length > 0 && data.banks.every((b) => b && isValidQuestions(b.questions) && b.progress && typeof b.progress === 'object')
  }
  // v1 backup: a single bank
  return isValidQuestions(data.bank) && data.progress && typeof data.progress === 'object'
}

// Turns a valid backup (v1 or v2) into a library.
export function libraryFromBackup(data) {
  if (!Array.isArray(data.banks)) return normalizeLibrary(fromSingleBank(data))
  const banks = data.banks.map((b) => ({ ...createBank({ ...b, name: b.name || 'banco.md' }), id: b.id || newBankId() }))
  const activeId = banks.some((b) => b.id === data.activeId) ? data.activeId : banks[0].id
  return normalizeLibrary({ banks, activeId, trash: Array.isArray(data.trash) ? data.trash : [] })
}

export function downloadJson(filename, data) {
  downloadText(filename, JSON.stringify(data, null, 2), 'application/json')
}

export function downloadText(filename, text, type = 'text/markdown') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
