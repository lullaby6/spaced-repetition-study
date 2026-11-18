import { useMemo } from 'react'
import { keywordRanges } from '../lib/text.js'

const inside = (pos, ranges) => ranges.some(([s, e]) => pos >= s && pos < e)

// The part of `range` ([start, end] in a longer spoken text) that falls inside [from, to), shifted to
// start at 0 — to highlight one piece (e.g. the answer) of what is being read.
export function clipRange(range, from, to) {
  if (!range) return null
  const start = Math.max(range[0], from)
  const end = Math.min(range[1], to)
  return start < end ? [start - from, end - from] : null
}

// Text with its key words underlined and, while it is read aloud, the current sentence tinted and
// the current word highlighted. `sentence` and `word` are [start, end] ranges or null.
export default function MarkedText({ text, keywords = [], sentence = null, word = null }) {
  const marks = useMemo(() => keywordRanges(text, keywords), [text, keywords])

  const cuts = new Set([0, text.length])
  for (const [s, e] of [...marks, sentence, word].filter(Boolean)) {
    cuts.add(s)
    cuts.add(e)
  }
  const points = [...cuts].filter((p) => p >= 0 && p <= text.length).sort((a, b) => a - b)

  return points.slice(0, -1).map((start, i) => {
    const end = points[i + 1]
    const piece = text.slice(start, end)
    const isKey = inside(start, marks)
    const isWord = word && inside(start, [word])
    const isSentence = sentence && inside(start, [sentence])
    if (!isKey && !isWord && !isSentence) return piece
    const classes = [
      isKey && 'font-medium underline decoration-primary decoration-2 underline-offset-4',
      isWord ? 'rounded bg-primary text-primary-content' : isSentence && 'bg-primary/10',
    ]
      .filter(Boolean)
      .join(' ')
    const Tag = isWord ? 'mark' : 'span'
    return (
      <Tag key={start} className={classes}>
        {piece}
      </Tag>
    )
  })
}
