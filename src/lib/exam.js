// Multiple choice mock exam: options are the right answer plus answers of other questions.
import { normalize, shuffle } from './text.js'

export const CHOICE_OPTIONS = 4
// Hint levels, asked one by one: the question's hints, then its key words, then two wrong options removed.
export const HINT_LEVELS = ['hints', 'keywords', 'eliminate']

// Picks the wrong options for `question` from `pool`: same topic first (they are more alike, so
// harder to tell apart), then the rest. Answers identical to the right one are skipped.
// Returns the keys of the options, shuffled, the right one included.
export function buildChoice(question, pool, size = CHOICE_OPTIONS) {
  const seen = new Set([normalize(question.answer)])
  const pick = []
  const candidates = [
    ...shuffle(pool.filter((q) => q.key !== question.key && q.topic === question.topic)),
    ...shuffle(pool.filter((q) => q.key !== question.key && q.topic !== question.topic)),
  ]
  for (const q of candidates) {
    if (pick.length >= size - 1) break
    const text = normalize(q.answer)
    if (seen.has(text)) continue
    seen.add(text)
    pick.push(q.key)
  }
  return shuffle([question.key, ...pick])
}

// Which wrong options the "eliminate" hint hides: half of them rounded up (2 of 3 with four options),
// never leaving fewer than two options.
export function optionsToEliminate(optionKeys, rightKey) {
  const wrong = shuffle(optionKeys.filter((k) => k !== rightKey))
  const count = Math.min(Math.ceil(wrong.length / 2), optionKeys.length - 2)
  return wrong.slice(0, Math.max(0, count))
}
