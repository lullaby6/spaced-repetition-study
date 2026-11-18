// Extracts the text of a PDF as a list of lines in reading order.
// Takes the pdf.js module as an argument so it works both in the browser and in Node.

const PAGE_NUMBER_RE = /^p[áa]g(ina|\.)?\s*\d+(\s*(de|of|\/)\s*\d+)?$/i
const MARKER_RE = /^(###|-\s|•|TEMA:|PREGUNTA:|RESPUESTA:|PUNTOS CLAVE:|COMPLETAR:|PISTAS:)/i

export async function extractPdfLines(pdfjs, data) {
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise
  const pages = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    pages.push(buildLines(content.items))
    page.cleanup()
  }
  await doc.destroy()
  return removeHeadersAndFooters(pages).flat()
}

// Groups text fragments by vertical position, then sorts them top-to-bottom, left-to-right.
function buildLines(items) {
  const lines = []
  for (const it of items) {
    if (typeof it.str !== 'string' || it.str === '') continue
    const x = it.transform[4]
    const y = it.transform[5]
    const height = Math.abs(it.transform[3]) || it.height || 10
    let line = lines.find((l) => Math.abs(l.y - y) < Math.max(2, height * 0.45))
    if (!line) {
      line = { y, height, items: [] }
      lines.push(line)
    }
    line.items.push({ x, width: it.width || 0, str: it.str })
  }
  lines.sort((a, b) => b.y - a.y)
  return lines
    .map((line) => {
      line.items.sort((a, b) => a.x - b.x)
      let text = ''
      let end = null
      for (const it of line.items) {
        if (text && end !== null) {
          const gap = it.x - end
          if (gap > line.height * 0.15 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' '
        }
        text += it.str
        end = it.x + it.width
      }
      return text.replace(/\s+/g, ' ').trim()
    })
    .filter(Boolean)
}

// Drops page numbers and lines repeated at the top or bottom of many pages (running titles, etc.).
function removeHeadersAndFooters(pages) {
  const keyOf = (s) => s.toLowerCase().replace(/\d+/g, '#')
  const repeated = new Set()
  if (pages.length >= 3) {
    const counts = new Map()
    for (const lines of pages) {
      const edges = new Set([...lines.slice(0, 2), ...lines.slice(-2)].map(keyOf))
      for (const k of edges) counts.set(k, (counts.get(k) || 0) + 1)
    }
    for (const [k, n] of counts) if (n >= pages.length * 0.5) repeated.add(k)
  }
  return pages.map((lines) =>
    lines.filter((line, i) => {
      if (PAGE_NUMBER_RE.test(line)) return false
      const atEdge = i < 2 || i >= lines.length - 2
      return !(atEdge && !MARKER_RE.test(line) && repeated.has(keyOf(line)))
    }),
  )
}
