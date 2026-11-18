// Loading question banks uploaded by the user (.md, .txt, .pdf).
import { parseBank } from './parser.js'

export const ACCEPTED_EXTENSIONS = ['.md', '.txt', '.pdf']

function splitLines(text) {
  return text.split(/\r?\n/)
}

export async function readBankFile(file) {
  const name = file.name.toLowerCase()
  if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) throw new Error('unsupportedFile')
  let lines
  if (name.endsWith('.pdf')) {
    // pdf.js is only downloaded when a PDF is actually uploaded.
    const [pdfjs, worker, { extractPdfLines }] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      import('./pdf.js'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    lines = await extractPdfLines(pdfjs, new Uint8Array(await file.arrayBuffer()))
  } else {
    lines = splitLines(await file.text())
  }
  return parseBank(lines)
}

// Each question gets a unique `key` (its number, or number-N when appending a bank with repeated numbers).
export function assignKeys(questions, takenKeys = new Set()) {
  const taken = new Set(takenKeys)
  return questions.map((q) => {
    let key = String(q.id)
    for (let n = 2; taken.has(key); n++) key = `${q.id}-${n}`
    taken.add(key)
    return { ...q, key }
  })
}
