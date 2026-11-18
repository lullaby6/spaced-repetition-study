// Checks that every language has the same keys and that every literal t('key') used in src exists.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import es from '../src/languages/es.js'
import en from '../src/languages/en.js'

const languages = { es, en }

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? sourceFiles(join(dir, e.name)) : [join(dir, e.name)])),
  )
  return files.flat().filter((f) => /\.(jsx?|mjs)$/.test(f))
}

let problems = 0
const keySets = Object.fromEntries(Object.entries(languages).map(([code, d]) => [code, new Set(flatten(d))]))
for (const [a, setA] of Object.entries(keySets)) {
  for (const [b, setB] of Object.entries(keySets)) {
    for (const key of setA) if (!setB.has(key)) (problems++, console.log(`"${key}" is in ${a} but missing in ${b}`))
  }
}

const used = new Set()
for (const file of await sourceFiles(new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const src = await readFile(file, 'utf8')
  for (const m of src.matchAll(/\bt\(\s*'([\w.]+)'/g)) used.add(m[1])
}
for (const key of used) if (!keySets.es.has(key)) (problems++, console.log(`t('${key}') is used but not defined`))

console.log(problems ? `${problems} problem(s).` : `Translations OK (${keySets.es.size} keys, ${used.size} literal uses).`)
process.exit(problems ? 1 : 0)
