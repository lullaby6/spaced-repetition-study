// Simulates study sessions against the bundled bank and checks the queue rules from section 4.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { clozeToRaw, missingFields, parseBank, parseCloze, serializeBank } from '../src/lib/parser.js'
import { MAX_LEARNING, describeOutcome, recordResult, startSession, countStatuses, resetQuestion, lastStudiedKey, removeFromSession, skipCurrent, lastSkipped, backToSkipped, jumpTo, excludeFromSession, includeInSession } from '../src/lib/queue.js'
import { isQuestionActive } from '../src/lib/bank.js'
import { buildChoice, CHOICE_OPTIONS, optionsToEliminate } from '../src/lib/exam.js'
import { buildShareData, decodeShare, encodeShare } from '../src/lib/share.js'
import { makeTrashId, removeFromTrash, restoreFromTrash, trashAllBanks, trashBank, trashProgress, trashQuestion } from '../src/lib/trash.js'
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

// Choosing stages: without stage 4, passing stage 3 masters the question; reviews happen at stage 3.
{
  const three = { ...settings, stages: [1, 2, 3] }
  let { session: s, progress: p } = startSession(bank, {}, three)
  const key = s.queue[0].key
  for (let guard = 0; p[key]?.status !== 'mastered' && guard < 50; guard++) {
    while (s.queue[0].key !== key) ({ session: s, progress: p } = recordResult(s, p, 'passed'))
    assert.ok(s.queue[0].stage <= 3, 'never stage 4')
    ;({ session: s, progress: p } = recordResult(s, p, 'passed'))
  }
  assert.equal(p[key].status, 'mastered')
  assert.equal(s.log.filter((l) => l.key === key).length, 3, 'three exercises: stages 1, 2, 3')
  const review = startSession(bank, p, three, 'review')
  assert.ok(review.session.queue.every((i) => i.stage === 3))
  assert.deepEqual(describeOutcome({ key, stage: 3, kind: 'learn' }, 'passed', s), { code: 'outcome.mastered' })

  // Starting at stage 2 (stage 1 off): new questions come in at stage 2.
  const fromTwo = startSession(bank, {}, { ...settings, stages: [2, 3, 4] })
  assert.ok(fromTwo.session.queue.every((i) => i.stage === 2))
  // A failure at the first enabled stage stays there.
  assert.deepEqual(describeOutcome({ key: '1', stage: 2, kind: 'learn' }, 'failed', fromTwo.session).params.stage, 2)
}

// How many questions are learned at once is configurable.
{
  const { session: s } = startSession(bank, {}, { ...settings, maxLearning: 4 })
  assert.equal(new Set(s.queue.map((i) => i.key)).size, 4)
  let { session: s2, progress: p2 } = startSession(bank, {}, { ...settings, maxLearning: 2 })
  for (let i = 0; i < 20 && s2.queue.length; i++) {
    assert.ok(new Set(s2.queue.filter((x) => x.kind === 'learn').map((x) => x.key)).size <= 2)
    ;({ session: s2, progress: p2 } = recordResult(s2, p2, 'passed'))
  }
}

// "Don't go back on failure": a failure repeats the same stage.
{
  const keep = { ...settings, noBacktrack: true }
  const { session: s } = startSession(bank, {}, keep)
  assert.equal(describeOutcome({ key: '1', stage: 3, kind: 'learn' }, 'failed', s).params.stage, 3)
  assert.equal(describeOutcome({ key: '1', stage: 3, kind: 'learn' }, 'failed', { options: { stages: [1, 2, 3, 4] } }).params.stage, 2, 'default goes back')
}

// Skipping: the exercise leaves the session (does not come back by itself), nothing is recorded.
{
  const { session: s, progress: p } = startSession(bank, {}, settings)
  const skipped = skipCurrent(s)
  assert.ok(!skipped.queue.some((i) => i.key === s.queue[0].key), 'not in the queue anymore')
  assert.deepEqual(skipped.skippedItems, [s.queue[0]])
  assert.equal(skipped.log.length, 0)
  assert.notEqual(skipped.counter, s.counter)
  assert.equal(skipCurrent({ ...s, queue: [s.queue[0]] }).queue.length, 0, 'skipping the last one ends the session')
  const refilled = skipCurrent(s, p)
  assert.equal(new Set(refilled.queue.map((i) => i.key)).size, s.queue.length, 'with progress, a new question fills the slot')
  assert.equal(p['1'].attempts, 0)

  // Going back: skip 1 and 2, then return to 2, then to 1; the current one becomes the next.
  const twice = skipCurrent(skipCurrent(s)) // current is now 3
  assert.equal(lastSkipped(twice), '2')
  const back = backToSkipped(twice)
  assert.deepEqual(back.queue.slice(0, 2).map((i) => i.key), ['2', '3'])
  assert.equal(lastSkipped(back), '1')
  const backAgain = backToSkipped(back)
  assert.deepEqual(backAgain.queue.slice(0, 3).map((i) => i.key), ['1', '2', '3'])
  assert.equal(lastSkipped(backAgain), null)
  assert.equal(backToSkipped(backAgain), backAgain, 'nothing to go back to')
  // Jumping to any waiting question.
  const jumped = jumpTo(s, '4')
  assert.deepEqual(jumped.queue.slice(0, 2).map((i) => i.key), ['4', '1'])
  assert.equal(jumpTo(s, '1'), s, 'already current')
  assert.equal(jumpTo(s, '99'), s, 'not in the queue')
  // Answering a skipped one forgets it.
  const answered = recordResult(back, p, 'passed')
  assert.ok(!answered.session.skipped.includes('2'))
}

// Turning a question off and on again for this session only.
{
  let { session: s, progress: p } = startSession(bank, {}, settings)
  ;({ session: s, progress: p } = recordResult(s, p, 'passed')) // q1 → waits at stage 2
  const off = excludeFromSession(s, p, '1')
  assert.ok(!off.queue.some((i) => i.key === '1'))
  assert.deepEqual(off.excluded, [{ key: '1', stage: 2, kind: 'learn' }])
  assert.ok(off.queue.some((i) => i.key === '7'), 'slot refilled')
  assert.equal(p['1'].stage, 2, 'progress untouched')
  const on = includeInSession(off, '1')
  assert.deepEqual(on.queue.at(-1), { key: '1', stage: 2, kind: 'learn' }, 'back at the same stage')
  assert.deepEqual(on.excluded, [])
  const offPending = excludeFromSession(s, p, '10') // still in the list of new questions
  assert.ok(!offPending.pendingNew.includes('10') && offPending.excluded[0].key === '10')
}

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

// Trash: nothing is lost; banks, questions and progress come back.
{
  const make = (id, name) => ({ id, name, questions: bank.slice(0, 3), warnings: [], progress: {}, settings, session: null, disabledTopics: [] })
  let lib = { banks: [make('A', 'a.md'), make('B', 'b.md')], activeId: 'A', trash: [] }
  // a question with progress, in the current session
  let { session: s, progress: p } = startSession(lib.banks[0].questions, {}, settings)
  ;({ session: s, progress: p } = recordResult(s, p, 'passed'))
  lib.banks[0] = { ...lib.banks[0], progress: p, session: s }

  const tq = makeTrashId()
  lib = trashQuestion(lib, lib.banks[0], '1', tq)
  lib.banks[0] = { ...lib.banks[0], questions: lib.banks[0].questions.filter((q) => q.key !== '1'), session: removeFromSession(s, p, ['1']) }
  const r1 = restoreFromTrash(lib, tq)
  assert.equal(r1.error, null)
  const back = r1.library.banks[0]
  assert.deepEqual(back.questions.map((q) => q.key), ['1', '2', '3'], 'same place')
  assert.equal(back.progress['1'].stage, 2, 'with its progress')
  assert.ok(back.session.queue.some((i) => i.key === '1' && i.stage === 2), 'back in the session')
  assert.equal(r1.library.trash.length, 0)

  // Several deleted, restored in another order: they still end up in number order.
  {
    let l = r1.library
    const bankA = () => l.banks.find((b) => b.id === 'A')
    const del = (key, tid) => {
      l = trashQuestion(l, bankA(), key, tid)
      l = { ...l, banks: l.banks.map((b) => (b.id === 'A' ? { ...b, questions: b.questions.filter((q) => q.key !== key) } : b)) }
    }
    del('2', 'd2')
    del('1', 'd1')
    l = restoreFromTrash(l, 'd2').library // 2 first, then 1
    l = restoreFromTrash(l, 'd1').library
    assert.deepEqual(bankA().questions.map((q) => q.key), ['1', '2', '3'], 'number order after restoring in any order')
  }

  // progress reset and restored
  const tp = makeTrashId()
  let lib2 = trashProgress(r1.library, back, null, tp)
  lib2 = { ...lib2, banks: lib2.banks.map((b) => (b.id === 'A' ? { ...b, progress: {} } : b)) }
  assert.equal(restoreFromTrash(lib2, tp).library.banks[0].progress['1'].stage, 2)
  assert.equal(trashProgress(lib2, lib2.banks[0], null).trash.length, lib2.trash.length, 'nothing to keep when there is no progress')

  // bank deleted and restored; a question of a deleted bank can't come back until the bank does
  const tb = makeTrashId()
  const lib3 = trashBank(trashQuestion(lib2, lib2.banks[1], '2', 'tq2'), 'B', tb)
  assert.deepEqual(lib3.banks.map((b) => b.id), ['A'])
  assert.equal(restoreFromTrash(lib3, 'tq2').error, 'bankMissing')
  const r3 = restoreFromTrash(lib3, tb)
  assert.equal(r3.library.activeId, 'B')
  assert.equal(r3.library.banks.length, 2)
  assert.equal(trashAllBanks(r3.library).length, r3.library.trash.length + 2)

  // Deleting forever only removes the chosen items from the trash.
  const before = lib3.trash.map((x) => x.id)
  assert.deepEqual(removeFromTrash(lib3, 'tq2').trash.map((x) => x.id), before.filter((id) => id !== 'tq2'))
  assert.deepEqual(removeFromTrash(lib3, before).trash, [])
  assert.equal(removeFromTrash(lib3, before).banks.length, lib3.banks.length, 'banks untouched')
}

// Share link: what goes in comes out the same; a cut link fails clearly.
{
  const library = { banks: [{ id: 'A', name: 'a.md', questions: bank, progress: { 1: { key: '1', stage: 2 } }, session: { queue: [] } }], activeId: 'A', trash: [{ id: 'x' }] }
  const data = buildShareData(library)
  assert.equal(data.banks[0].session, undefined, 'no sessions in the link')
  assert.equal(data.trash, undefined, 'no trash in the link')
  const encoded = await encodeShare(data)
  assert.deepEqual(await decodeShare(encoded), data)
  await assert.rejects(decodeShare(encoded.slice(0, encoded.length / 2)), 'a cut link does not decode')

  // Size estimate for a realistic bank: 95 questions of varied text.
  const words = text.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  const pick = (n, seed) => Array.from({ length: n }, (_, i) => words[(seed * 31 + i * 17) % words.length]).join(' ')
  const big = Array.from({ length: 95 }, (_, i) => ({
    id: i + 1, key: String(i + 1), topic: `Tema ${i % 11}`, question: `${pick(12, i)}?`, answer: pick(70, i + 100),
    keyPoints: [pick(6, i + 1), pick(6, i + 2), pick(6, i + 3), pick(6, i + 4)],
    cloze: { text: `${pick(10, i + 5)} {{0}} ${pick(8, i + 6)} {{1}}`, blanks: [pick(1, i + 7), pick(1, i + 8)] }, hints: [pick(5, i + 9)],
  }))
  const size = (await encodeShare(buildShareData({ banks: [{ id: 'B', name: 'b.md', questions: big, progress: {} }], activeId: 'B' }))).length
  console.log(`  share link for 95 questions: ~${size} characters`)
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
