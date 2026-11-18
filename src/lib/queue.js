// Study queue with spaced repetition (section 4 of the spec).
// Every function is pure: it receives state and returns new state.
import { shuffle } from './text.js'

export const MAX_LEARNING = 6
export const REVIEW_INTERVAL_DAYS = 3

// Table 4.1: finished stage + result → stage it comes back in, and how many exercises later.
const TRANSITIONS = {
  1: { passed: { stage: 2, gap: 3 } },
  2: { passed: { stage: 3, gap: 4 }, partial: { stage: 2, gap: 2 }, failed: { stage: 1, gap: 2 } },
  3: { passed: { stage: 4, gap: 6 }, partial: { stage: 3, gap: 3 }, failed: { stage: 2, gap: 2 } },
  4: { passed: { mastered: true }, partial: { stage: 4, gap: 4 }, failed: { stage: 3, gap: 3 } },
}
const REVIEW_FAIL_GAP = 3
const DAY_MS = 24 * 60 * 60 * 1000

export function initialProgress(key) {
  return { key, stage: 1, status: 'new', comesBackIn: null, attempts: 0, correct: 0, lastSeen: null, nextReview: null }
}

function startOfTomorrow(from = new Date()) {
  const d = new Date(from)
  d.setHours(24, 0, 0, 0)
  return d.toISOString()
}

// Consequence of a result as a translation code + params, shown before "next".
export function describeOutcome(item, result) {
  if (item.kind === 'review') {
    return result === 'passed'
      ? { code: 'outcome.reviewPassed', params: { days: REVIEW_INTERVAL_DAYS } }
      : { code: 'outcome.reviewFailed' }
  }
  const t = TRANSITIONS[item.stage][result]
  if (t.mastered) return { code: 'outcome.mastered' }
  return { code: 'outcome.comesBack', params: { stage: t.stage, gap: t.gap } }
}

function countLearning(queue) {
  return new Set(queue.filter((i) => i.kind === 'learn').map((i) => i.key)).size
}

// Rule 4.2: a new question enters while there is room (max 6 learning) and the session limit allows it.
// Entering the queue does not change its status: it stays "new" until it is first answered.
function refill(session, progress) {
  const queue = [...session.queue]
  const pending = [...session.pendingNew]
  let introduced = session.newIntroduced
  while (countLearning(queue) < MAX_LEARNING && introduced < session.newLimit && pending.length) {
    const key = pending.shift()
    if ((progress[key]?.status ?? 'new') !== 'new') continue
    queue.push({ key, stage: 1, kind: 'learn' })
    introduced++
  }
  return { session: { ...session, queue, pendingNew: pending, newIntroduced: introduced }, progress }
}

function interleave(a, b) {
  const out = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i])
    if (i < b.length) out.push(b[i])
  }
  return out
}

// mode: 'normal' (learning + reviews that are due) or 'review' (every mastered question, in stage 4).
export function startSession(bank, progress, settings, mode = 'normal') {
  const now = new Date()
  const fullProgress = { ...progress }
  for (const q of bank) if (!fullProgress[q.key]) fullProgress[q.key] = initialProgress(q.key)
  const pool = bank.filter((q) => !settings.topics || settings.topics.includes(q.topic))
  const prog = (q) => fullProgress[q.key]

  const reviews = shuffle(
    pool.filter(
      (q) =>
        prog(q).status === 'mastered' &&
        (mode === 'review' || !prog(q).nextReview || new Date(prog(q).nextReview) <= now),
    ),
  ).map((q) => ({ key: q.key, stage: 4, kind: 'review' }))

  const learning =
    mode === 'review'
      ? []
      : pool
          .filter((q) => prog(q).status === 'learning' || prog(q).status === 'review')
          .map((q) => ({ key: q.key, stage: prog(q).stage, kind: 'learn' }))

  let fresh = pool.filter((q) => prog(q).status === 'new').map((q) => q.key)
  if (settings.order === 'random') fresh = shuffle(fresh)

  const session = {
    mode,
    startedAt: now.toISOString(),
    queue: learning,
    pendingNew: mode === 'review' ? [] : fresh,
    newIntroduced: 0,
    newLimit: mode === 'review' ? 0 : settings.newPerSession,
    log: [],
    counter: 0,
  }
  const r = refill(session, fullProgress)
  r.session.queue = interleave(r.session.queue, reviews)
  return r
}

function insertAt(queue, item, gap) {
  const pos = Math.min(gap, queue.length)
  return [...queue.slice(0, pos), item, ...queue.slice(pos)]
}

// `response` is what the user answered; it is kept in the log so the exercise can be reviewed later.
export function recordResult(session, progress, result, response = null) {
  const [item, ...rest] = session.queue
  if (!item) return { session, progress }
  const now = new Date()
  const prev = progress[item.key] || initialProgress(item.key)
  const p = {
    ...prev,
    attempts: prev.attempts + 1,
    correct: prev.correct + (result === 'passed' ? 1 : 0),
    lastSeen: now.toISOString(),
  }
  let reinsert = null

  if (item.kind === 'review') {
    if (result === 'passed') {
      p.status = 'mastered'
      p.nextReview = new Date(now.getTime() + REVIEW_INTERVAL_DAYS * DAY_MS).toISOString()
    } else {
      Object.assign(p, { status: 'review', stage: 3, comesBackIn: REVIEW_FAIL_GAP, nextReview: null })
      reinsert = { item: { key: item.key, stage: 3, kind: 'learn' }, gap: REVIEW_FAIL_GAP }
    }
  } else {
    const t = TRANSITIONS[item.stage][result]
    if (t.mastered) {
      Object.assign(p, { status: 'mastered', stage: 4, comesBackIn: null, nextReview: startOfTomorrow(now) })
    } else {
      p.stage = t.stage
      p.comesBackIn = t.gap
      if (p.status === 'new') p.status = 'learning'
      reinsert = { item: { key: item.key, stage: t.stage, kind: 'learn' }, gap: t.gap }
    }
  }

  let queue = rest
  // Reinsert first so it counts as "learning"; new questions are then appended at the end.
  if (reinsert) queue = insertAt(queue, reinsert.item, reinsert.gap)
  const nextSession = {
    ...session,
    queue,
    counter: session.counter + 1,
    log: [...session.log, { key: item.key, stage: item.stage, kind: item.kind, result, response, at: now.toISOString() }],
  }
  return refill(nextSession, { ...progress, [item.key]: p })
}

// Puts one question back to "new". If it was in the current session it starts over there (it goes
// first in line to come back at stage 1, without using up another new-question slot); other
// questions are not pulled in. Returns the new progress and session (null when nothing is left).
export function resetQuestion(session, progress, key) {
  const nextProgress = { ...progress, [key]: initialProgress(key) }
  if (!session) return { session: null, progress: nextProgress }
  const wasQueued = session.queue.some((i) => i.key === key)
  if (!wasQueued) return { session, progress: nextProgress }
  const trimmed = {
    ...session,
    queue: session.queue.filter((i) => i.key !== key),
    pendingNew: [key, ...session.pendingNew.filter((k) => k !== key)],
    newIntroduced: Math.max(0, session.newIntroduced - 1),
  }
  const r = refill(trimmed, nextProgress)
  return { session: r.session.queue.length ? r.session : null, progress: r.progress }
}

// Takes questions out of the current session (e.g. when they are deactivated), keeping their progress.
// Returns the new session, or null when nothing is left in it.
export function removeFromSession(session, progress, keys) {
  if (!session) return null
  const gone = new Set(keys)
  const trimmed = {
    ...session,
    queue: session.queue.filter((i) => !gone.has(i.key)),
    pendingNew: session.pendingNew.filter((k) => !gone.has(k)),
  }
  const r = refill(trimmed, progress)
  return r.session.queue.length ? r.session : null
}

// The question with progress that was answered most recently, or null.
export function lastStudiedKey(progress) {
  let best = null
  for (const p of Object.values(progress)) {
    if (p.status === 'new' || !p.lastSeen) continue
    if (!best || p.lastSeen > best.lastSeen) best = p
  }
  return best?.key ?? null
}

export function countStatuses(bank, progress, topics = null) {
  const counts = { new: 0, learning: 0, review: 0, mastered: 0 }
  for (const q of bank) {
    if (topics && !topics.includes(q.topic)) continue
    counts[(progress[q.key] || initialProgress(q.key)).status]++
  }
  return counts
}

export function summarizeSession(session, bank) {
  const byKey = new Map(bank.map((q) => [q.key, q]))
  const masteredKeys = [
    ...new Set(session.log.filter((l) => l.stage === 4 && l.result === 'passed').map((l) => l.key)),
  ].filter((k) => byKey.has(k))
  const misses = new Map()
  const byTopic = new Map()
  for (const entry of session.log) {
    const q = byKey.get(entry.key)
    if (!q) continue
    const t = byTopic.get(q.topic) || { topic: q.topic, total: 0, misses: 0 }
    t.total++
    if (entry.result !== 'passed') {
      t.misses++
      misses.set(entry.key, (misses.get(entry.key) || 0) + (entry.result === 'failed' ? 2 : 1))
    }
    byTopic.set(q.topic, t)
  }
  const hardest = [...misses.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, score]) => ({ question: byKey.get(key), score }))
  const weakTopics = [...byTopic.values()]
    .filter((t) => t.misses > 0)
    .map((t) => ({ ...t, rate: t.misses / t.total }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3)
  return { exercises: session.log.length, mastered: masteredKeys.map((k) => byKey.get(k)), hardest, weakTopics }
}
