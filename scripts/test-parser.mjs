// Usage: node scripts/test-parser.mjs <bank.md|.txt|.pdf> [question ids to print...]
import { readFile } from 'node:fs/promises'
import { parseBank } from '../src/lib/parser.js'

const file = process.argv[2]
let lines
if (file.toLowerCase().endsWith('.pdf')) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { extractPdfLines } = await import('../src/lib/pdf.js')
  lines = await extractPdfLines(pdfjs, new Uint8Array(await readFile(file)))
} else {
  lines = (await readFile(file, 'utf8')).split(/\r?\n/)
}
const { questions, warnings, topics } = parseBank(lines)

console.log(`Found ${questions.length} questions in ${topics.length} topics`)
topics.forEach((t) => console.log(' -', t, `(${questions.filter((q) => q.topic === t).length})`))
console.log('Warnings:', warnings)

const suspicious = questions.filter(
  (q) =>
    /Página|Page \d|\{\{|\}\}|---/.test(q.answer + q.question + q.keyPoints.join() + q.hints.join()) ||
    /\{|\}/.test(q.cloze.blanks.join()),
)
console.log('Questions with leftover artifacts:', suspicious.map((q) => q.id))
for (const id of process.argv.slice(3).map(Number)) {
  console.log(JSON.stringify(questions.find((q) => q.id === id), null, 2))
}
