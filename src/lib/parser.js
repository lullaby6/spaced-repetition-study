// Turns the lines of a question bank (.md, .txt or extracted PDF text) into questions.
// The field markers (TEMA:, PREGUNTA:, ...) are part of the bank file format and stay in Spanish.

const FIELD_RE = /^(TEMA|PREGUNTA|RESPUESTA|PUNTOS CLAVE|COMPLETAR|PISTAS)\s*:\s*(.*)$/i
const ITEM_RE = /^(?:-|•|–)\s+(.*)$/
const START_RE = /^###\s*PREGUNTA\s+(\d+)/i
const END_RE = /^###\s*FIN\b/i

const FIELD_NAMES = {
  TEMA: 'topic',
  PREGUNTA: 'question',
  RESPUESTA: 'answer',
  'PUNTOS CLAVE': 'keyPoints',
  COMPLETAR: 'clozeRaw',
  PISTAS: 'hints',
}
const LIST_FIELDS = new Set(['keyPoints', 'hints'])

function isMarker(line) {
  return line.startsWith('###') || ITEM_RE.test(line) || FIELD_RE.test(line)
}

// Rules 3 and 5: rejoin lines that were wrapped (mostly by PDFs).
export function joinWrappedLines(lines) {
  const logical = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (!logical.length || isMarker(line)) {
      logical.push(line)
      continue
    }
    const prev = logical[logical.length - 1]
    const insideBlank = prev.lastIndexOf('{{') > prev.lastIndexOf('}}')
    logical[logical.length - 1] = insideBlank ? prev + line : prev + ' ' + line
  }
  return logical
}

// "a {{word}} b" → { text: 'a {{0}} b', blanks: ['word'] }
export function parseCloze(text) {
  const blanks = []
  const template = text.replace(/\{\{(.*?)\}\}/g, (_, word) => {
    blanks.push(word.trim())
    return `{{${blanks.length - 1}}}`
  })
  return { text: template, blanks }
}

// Inverse of parseCloze: back to the "a {{word}} b" form used in bank files and the editor.
export function clozeToRaw(cloze) {
  return cloze.text.replace(/\{\{(\d+)\}\}/g, (_, i) => `{{${cloze.blanks[Number(i)] ?? ''}}}`)
}

// Fields that are missing or empty, with the bank file marker names (same rule as rule 6 of the parser).
export function missingFields({ topic, question, answer, keyPoints, clozeRaw, hints }) {
  const missing = []
  if (!topic?.trim()) missing.push('TEMA')
  if (!question?.trim()) missing.push('PREGUNTA')
  if (!answer?.trim()) missing.push('RESPUESTA')
  if (!keyPoints?.length) missing.push('PUNTOS CLAVE')
  if (!parseCloze(clozeRaw || '').blanks.filter(Boolean).length) missing.push('COMPLETAR {{...}}')
  if (!hints?.length) missing.push('PISTAS')
  return missing
}

// Writes questions back in the bank file format, so an edited bank can be downloaded as .md.
export function serializeBank(questions) {
  const oneLine = (s) => String(s).replace(/\s*\n\s*/g, ' ').trim()
  return questions
    .map((q) =>
      [
        `### PREGUNTA ${q.id}`,
        `TEMA: ${oneLine(q.topic)}`,
        `PREGUNTA: ${oneLine(q.question)}`,
        `RESPUESTA: ${oneLine(q.answer)}`,
        'PUNTOS CLAVE:',
        ...q.keyPoints.map((p) => `- ${oneLine(p)}`),
        `COMPLETAR: ${oneLine(clozeToRaw(q.cloze))}`,
        'PISTAS:',
        ...q.hints.map((h) => `- ${oneLine(h)}`),
        '### FIN',
      ].join('\n'),
    )
    .join('\n\n')
    .concat('\n')
}

export function parseBank(lines) {
  const logical = joinWrappedLines(lines)
  const questions = []
  const warnings = []
  const seenIds = new Set()
  let current = null
  let field = null

  const close = () => {
    const q = current
    current = null
    field = null
    // Warnings carry a code + params; the UI translates them.
    const missing = missingFields(q)
    const cloze = parseCloze(q.clozeRaw)
    if (missing.length) {
      warnings.push({ id: q.id, code: 'missingFields', params: { fields: missing.join(', ') } })
      return
    }
    if (seenIds.has(q.id)) warnings.push({ id: q.id, code: 'duplicateId' })
    seenIds.add(q.id)
    questions.push({
      id: q.id,
      topic: q.topic,
      question: q.question,
      answer: q.answer,
      keyPoints: q.keyPoints,
      cloze,
      hints: q.hints,
    })
  }

  for (const line of logical) {
    const start = line.match(START_RE)
    if (start) {
      if (current) {
        warnings.push({ id: current.id, code: 'missingEnd' })
        close()
      }
      current = { id: Number(start[1]), topic: '', question: '', answer: '', clozeRaw: '', keyPoints: [], hints: [] }
      field = null
      continue
    }
    if (END_RE.test(line)) {
      if (current) close()
      continue
    }
    if (!current) continue // rule 2: anything outside a block is ignored

    const m = line.match(FIELD_RE)
    if (m) {
      field = FIELD_NAMES[m[1].toUpperCase()]
      const rest = m[2].trim()
      if (LIST_FIELDS.has(field)) {
        if (rest) current[field].push(rest)
      } else {
        current[field] = rest
      }
      continue
    }
    const item = line.match(ITEM_RE)
    if (item && LIST_FIELDS.has(field)) {
      current[field].push(item[1].trim())
      continue
    }
    // Loose text inside a block: append it to the current field.
    if (LIST_FIELDS.has(field)) {
      const list = current[field]
      if (list.length) list[list.length - 1] += ' ' + line
    } else if (field) {
      current[field] = (current[field] + ' ' + line).trim()
    }
  }
  if (current) {
    warnings.push({ id: current.id, code: 'missingEnd' })
    close()
  }

  const topics = [...new Set(questions.map((q) => q.topic))]
  return { questions, warnings, topics }
}
