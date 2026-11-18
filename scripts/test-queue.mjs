// Simulates study sessions against the bundled bank and checks the queue rules from section 4.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { clozeToRaw, missingFields, parseBank, parseCloze, serializeBank } from '../src/lib/parser.js'
import { MAX_LEARNING, recordResult, startSession, countStatuses, resetQuestion, lastStudiedKey, removeFromSession } from '../src/lib/queue.js'
import { isQuestionActive } from '../src/lib/bank.js'
import { buildChoice, CHOICE_OPTIONS, optionsToEliminate } from '../src/lib/exam.js'
import { compareCopy, guessLanguage, isBlankCorrect, keywordRanges, suggestKeyPoints } from '../src/lib/text.js'

// Voice language guess
assert.equal(guessLanguage('Es una forma de Estado del capitalismo desarrollado que interviene en la vida social'), 'es')
assert.equal(guessLanguage('It is a form of state that intervenes in the economy and the social life', 'es'), 'en')
assert.equal(guessLanguage('1945', 'en'), 'en')

// --- parser, on the small sample bank in scripts/fixtures ---
const text = await readFile(new URL('./fixtures/sample-bank.md', import.meta.url), 'utf8')
const sample = parseBank(text.split(/\r?\n/))
assert.equal(sample.questions.length, 3)
assert.deepEqual(sample.warnings, [])
assert.deepEqual(sample.topics, ['Ciclo del agua', 'Fotosíntesis'])
assert.ok(sample.questions[0].answer.includes('nubes, precipitación'), 'wrapped line joined with a space')
assert.deepEqual(sample.questions[0].cloze.blanks, ['Evaporación', 'condensación', 'precipitación', 'infiltración'], 'blank split across lines rejoined')
assert.ok(!sample.questions.some((q) => /Página/.test(q.answer)), 'text outside blocks ignored')

// --- a larger generated bank for the queue rules (they need more than 15 questions) ---
const bank = Array.from({ length: 40 }, (_, i) => ({
  ...sample.questions[i % 3],
  id: i + 1,
  key: String(i + 1),
  topic: i < 20 ? 'Tema A' : 'Tema B',
}))
const settings = { topics: null, order: 'bank', newPerSession: 15 }

// --- text helpers ---
assert.ok(isBlankCorrect('politica', 'política'))
assert.ok(isBlankCorrect("'70", '70'))
assert.ok(isBlankCorrect('capitalimo', 'capitalismo'), 'one typo allowed in 6+ letters')
assert.ok(!isBlankCorrect('paa', 'paz'), 'no typo allowed in short words')
assert.ok(!isBlankCorrect('1946', '1945'), 'numbers must match exactly')
assert.ok(compareCopy(bank[0].answer, bank[0].answer.toUpperCase()).similarity === 1)
assert.ok(compareCopy(bank[0].answer, 'es una forma de estado').similarity < 0.8)
const sug = suggestKeyPoints(
  ['Indigencia → ingresos suficientes', 'Enfermedad → servicio sanitario', 'Ignorancia → educación', 'Suciedad → vivienda', 'Ociosidad → pleno empleo'],
  'indigencia con ingresos, enfermedad con un servicio sanitario, y la ociosidad con pleno empleo',
)
assert.deepEqual(sug, [true, true, false, false, true])

// --- queue ---
let { session, progress } = startSession(bank, {}, settings)
assert.equal(session.queue.length, MAX_LEARNING, 'starts with 6 new questions')
assert.deepEqual(session.queue.map((i) => i.key), ['1', '2', '3', '4', '5', '6'])

// Stage 1 passed → comes back at stage 2 three positions later.
;({ session, progress } = recordResult(session, progress, 'passed'))
assert.deepEqual(session.queue[3], { key: '1', stage: 2, kind: 'learn' })
assert.equal(progress['1'].stage, 2)

// Answer everything correctly until the session ends; count exercises per question.
let steps = 0
const learningMax = []
while (session.queue.length && steps < 1000) {
  learningMax.push(new Set(session.queue.filter((i) => i.kind === 'learn').map((i) => i.key)).size)
  ;({ session, progress } = recordResult(session, progress, 'passed'))
  steps++
}
assert.ok(Math.max(...learningMax) <= MAX_LEARNING, 'never more than 6 learning')
const counts = countStatuses(bank, progress)
assert.equal(counts.mastered, 15, '15 new per session, all mastered')
assert.equal(steps + 1, 15 * 4, 'each question took exactly 4 exercises')

// A failed stage 2 sends it back to stage 1, two positions later.
;({ session, progress } = startSession(bank, progress, settings))
const firstKey = session.queue[0].key
;({ session, progress } = recordResult(session, progress, 'passed')) // stage 1
while (session.queue[0].key !== firstKey) ({ session, progress } = recordResult(session, progress, 'passed'))
;({ session, progress } = recordResult(session, progress, 'failed')) // stage 2 failed
assert.deepEqual(session.queue[2], { key: firstKey, stage: 1, kind: 'learn' })

// Review mode: mastered questions come in stage 4; failing sends them to stage 3 as "review".
const review = startSession(bank, progress, settings, 'review')
assert.ok(review.session.queue.every((i) => i.stage === 4 && i.kind === 'review'))
const r = recordResult(review.session, review.progress, 'failed')
assert.equal(r.progress[review.session.queue[0].key].status, 'review')
const passedReview = recordResult(review.session, review.progress, 'passed')
const next = new Date(passedReview.progress[review.session.queue[0].key].nextReview)
assert.ok(next - Date.now() > 2.9 * 24 * 3600 * 1000, 'next review in 3 days')

// Questions waiting in the queue stay "new" until they are first answered.
{
  const { session: s, progress: p } = startSession(bank, {}, settings)
  assert.equal(s.queue.length, MAX_LEARNING)
  assert.ok(s.queue.every((i) => p[i.key].status === 'new'), 'queued but unanswered → still new')
  const after = recordResult(s, p, 'passed')
  assert.equal(after.progress['1'].status, 'learning', 'answered → learning')
  assert.equal(after.progress['2'].status, 'new')
}

// Resetting one question: back to new; in a session it starts over itself, no other question is pulled in.
{
  let { session: s, progress: p } = startSession(bank, {}, settings)
  ;({ session: s, progress: p } = recordResult(s, p, 'passed')) // question 1, stage 1
  await new Promise((done) => setTimeout(done, 5))
  ;({ session: s, progress: p } = recordResult(s, p, 'passed')) // question 2, stage 1
  assert.equal(lastStudiedKey(p), '2')
  const reset = resetQuestion(s, p, '2')
  assert.equal(reset.progress['2'].status, 'new')
  assert.equal(reset.progress['2'].attempts, 0)
  assert.deepEqual(reset.session.queue.filter((i) => i.key === '2'), [{ key: '2', stage: 1, kind: 'learn' }], 'back at stage 1')
  assert.deepEqual(
    [...new Set(reset.session.queue.map((i) => i.key))].sort(),
    [...new Set(s.queue.map((i) => i.key))].sort(),
    'same questions in the session: none pulled in',
  )
  assert.equal(reset.session.newIntroduced, s.newIntroduced, 'no extra new-question slot used')
  const statuses = Object.values(reset.progress).filter((x) => x.status !== 'new').map((x) => x.key)
  assert.deepEqual(statuses, ['1'], 'only the answered one shows progress')
  assert.equal(lastStudiedKey(reset.progress), '1', 'stepping back goes to the previous one')
  assert.equal(resetQuestion(null, p, '1').session, null)
  assert.equal(resetQuestion(s, p, '30').session, s, 'resetting one outside the session leaves it as is')
}

// Turning questions off: they leave the session (and the new-question list) but keep their progress.
{
  let { session: s, progress: p } = startSession(bank, {}, settings)
  ;({ session: s, progress: p } = recordResult(s, p, 'passed')) // question 1 → stage 2
  const after = removeFromSession(s, p, ['1', '7'])
  assert.ok(!after.queue.some((i) => i.key === '1'))
  assert.ok(!after.pendingNew.includes('7'), 'an off question is not introduced later')
  assert.equal(new Set(after.queue.map((i) => i.key)).size, MAX_LEARNING, 'slot refilled with the next new one')
  assert.equal(p['1'].stage, 2, 'progress untouched')
  assert.ok(isQuestionActive({ topic: 'A' }) && !isQuestionActive({ topic: 'A', disabled: true }) && !isQuestionActive({ topic: 'A' }, ['A']))
}

// Multiple choice: right answer included, no repeated answers, same topic preferred, ruling out leaves ≥ 2.
{
  const pool = Array.from({ length: 10 }, (_, i) => ({ key: `k${i}`, topic: i < 5 ? 'A' : 'B', answer: `respuesta ${i}` }))
  pool.push({ key: 'dup', topic: 'A', answer: 'Respuesta 0' }) // same text as k0 once normalized
  for (let run = 0; run < 50; run++) {
    const options = buildChoice(pool[0], pool)
    assert.equal(options.length, CHOICE_OPTIONS)
    assert.ok(options.includes('k0'))
    assert.ok(!options.includes('dup'), 'an answer identical to the right one is never an option')
    assert.equal(new Set(options).size, options.length)
    assert.ok(options.filter((k) => k !== 'k0').every((k) => Number(k.slice(1)) < 5), 'same topic first when there are enough')
    const gone = optionsToEliminate(options, 'k0')
    assert.ok(!gone.includes('k0'))
    assert.equal(options.length - gone.length, 2, 'four options → two left')
  }
  assert.equal(buildChoice(pool[0], pool.slice(0, 2)).length, 2, 'small banks give fewer options')
  assert.deepEqual(optionsToEliminate(['a', 'b'], 'a'), [], 'never below two options')
}

// Editing: a bank written back to .md parses to the same questions.
{
  const again = parseBank(serializeBank(bank).split('\n'))
  assert.equal(again.warnings.length, 0)
  assert.deepEqual(again.questions, bank.map(({ key, ...q }) => q))
  assert.equal(clozeToRaw(parseCloze('a {{b c}} d {{e}}')), 'a {{b c}} d {{e}}')
  assert.deepEqual(missingFields({ topic: 'x', question: 'y', answer: 'z', keyPoints: ['k'], clozeRaw: 'sin huecos', hints: ['h'] }), ['COMPLETAR {{...}}'])
}

// Key words: whole words only, case and accents ignored.
assert.deepEqual(keywordRanges('La política y el Estado; estadística', ['politica', 'estado']), [[3, 11], [17, 23]])

console.log('All queue and text checks passed.')
