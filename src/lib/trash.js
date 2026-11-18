// Nothing is ever really deleted: deleted banks, deleted questions and reset progress are "taken
// down" into `trash` (newest first) and can always be restored. Pure functions over the library
// ({ banks, activeId, trash }).
import { newBankId } from './storage.js'

// Callers can pick the id beforehand so an "Undo" button can restore exactly that item.
export function makeTrashId() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function pushTrash(library, item, id = makeTrashId()) {
  return [{ id, deletedAt: new Date().toISOString(), ...item }, ...(library.trash ?? [])]
}

// Keeps all banks of the library in the trash (before an import replaces them).
export function trashAllBanks(library) {
  let trash = library.trash ?? []
  for (const bank of library.banks) trash = pushTrash({ trash }, { type: 'bank', bank: { ...bank, session: null } })
  return trash
}

// Keeps a copy of a whole bank as it is now (e.g. before it is replaced by another file).
export function trashBankCopy(library, bank, id) {
  return { ...library, trash: pushTrash(library, { type: 'bank', bank: { ...bank, session: null } }, id) }
}

// Keeps the progress of `keys` (all questions when null) before it is reset.
export function trashProgress(library, bank, keys = null, id) {
  const picked = keys ? Object.fromEntries(keys.filter((k) => bank.progress[k]).map((k) => [k, bank.progress[k]])) : bank.progress
  const started = Object.values(picked).filter((p) => p.status !== 'new' || p.attempts)
  if (!started.length) return library
  const ids = keys ? keys.map((k) => bank.questions.find((q) => q.key === k)?.id).filter((x) => x != null) : null
  return { ...library, trash: pushTrash(library, { type: 'progress', bankId: bank.id, bankName: bank.name, progress: picked, ids }, id) }
}

// Moves the bank `bankId` to the trash.
export function trashBank(library, bankId, id) {
  const bank = library.banks.find((b) => b.id === bankId)
  if (!bank) return library
  const banks = library.banks.filter((b) => b.id !== bankId)
  return {
    banks,
    activeId: library.activeId === bankId ? (banks[0]?.id ?? null) : library.activeId,
    trash: pushTrash(library, { type: 'bank', bank: { ...bank, session: null } }, id),
  }
}

// Keeps a copy of a question that is being deleted from `bank` (with its progress, its position and,
// if it was in the current session, its place in the queue).
export function trashQuestion(library, bank, key, id) {
  const index = bank.questions.findIndex((q) => q.key === key)
  if (index < 0) return library
  return {
    ...library,
    trash: pushTrash(library, {
      type: 'question',
      bankId: bank.id,
      bankName: bank.name,
      index,
      question: bank.questions[index],
      progress: bank.progress[key] ?? null,
      sessionItem: bank.session?.queue.find((i) => i.key === key) ?? null,
    }, id),
  }
}

// Where a restored question goes: by its number, before the first question with a higher one, so the
// order is right even if several were deleted and are restored in any order. Banks without numeric
// ids fall back to the position it had when deleted.
function restorePosition(questions, question, oldIndex) {
  const id = Number(question.id)
  if (Number.isFinite(id) && questions.every((q) => Number.isFinite(Number(q.id)))) {
    const at = questions.findIndex((q) => Number(q.id) > id)
    return at < 0 ? questions.length : at
  }
  return Math.min(oldIndex, questions.length)
}

// Puts a trashed item back. Returns { library, error } where error is a code when it can't be done
// (a question whose bank is gone).
export function restoreFromTrash(library, trashItemId) {
  const item = (library.trash ?? []).find((x) => x.id === trashItemId)
  if (!item) return { library, error: 'notFound' }
  const trash = library.trash.filter((x) => x.id !== trashItemId)

  if (item.type === 'bank') {
    const id = library.banks.some((b) => b.id === item.bank.id) ? newBankId() : item.bank.id
    return { library: { banks: [...library.banks, { ...item.bank, id }], activeId: id, trash }, error: null }
  }

  const bank = library.banks.find((b) => b.id === item.bankId)
  if (!bank) return { library, error: 'bankMissing' }

  if (item.type === 'progress') {
    // Only questions that still exist get their progress back.
    const existing = new Set(bank.questions.map((q) => q.key))
    const back = Object.fromEntries(Object.entries(item.progress).filter(([k]) => existing.has(k)))
    return {
      library: { ...library, banks: library.banks.map((b) => (b.id === bank.id ? { ...b, progress: { ...b.progress, ...back } } : b)), trash },
      error: null,
    }
  }

  // Keep its key unless another question took it meanwhile.
  let key = item.question.key
  const taken = new Set(bank.questions.map((q) => q.key))
  for (let n = 2; taken.has(key); n++) key = `${item.question.key}-r${n}`
  const question = { ...item.question, key }
  const questions = [...bank.questions]
  questions.splice(restorePosition(questions, question, item.index), 0, question)
  const progress = item.progress ? { ...bank.progress, [key]: { ...item.progress, key } } : bank.progress
  const session =
    bank.session && item.sessionItem ? { ...bank.session, queue: [...bank.session.queue, { ...item.sessionItem, key }] } : bank.session
  return {
    library: { ...library, banks: library.banks.map((b) => (b.id === bank.id ? { ...b, questions, progress, session } : b)), trash },
    error: null,
  }
}
