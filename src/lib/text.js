// Text comparison helpers: normalization, Levenshtein, copy similarity and key point suggestions.

export function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Lowercase, no accents, no punctuation, single spaces.
export function normalize(s) {
  return stripAccents(String(s ?? ''))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function words(s) {
  const n = normalize(s)
  return n ? n.split(' ') : []
}

export function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

// Stage 2: ignores case and accents, allows one typo in words of 6+ letters,
// and accepts numbers with or without an apostrophe ('70 / 70).
export function isBlankCorrect(typed, expected) {
  const a = normalize(typed)
  const b = normalize(expected)
  if (!a) return false
  if (a === b) return true
  if (/^\d+$/.test(b)) return false
  return b.replace(/\s/g, '').length >= 6 && levenshtein(a, b) <= 1
}

function similarWords(a, b) {
  if (a === b) return true
  if (a.length >= 6 && b.length >= 6 && !/\d/.test(a + b)) return levenshtein(a, b) <= 1
  return false
}

// Stage 1: compares the copy with the answer word by word (longest common subsequence).
// Returns the similarity (0-1) and, for each chunk of the original answer, whether it was covered.
export function compareCopy(answer, typed) {
  const chunks = answer.split(/(\s+)/)
  const target = [] // { word, chunk }
  chunks.forEach((c, i) => {
    for (const w of words(c)) target.push({ word: w, chunk: i })
  })
  const user = words(typed)
  const n = target.length
  const m = user.length
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = similarWords(target[i].word, user[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const matched = new Array(n).fill(false)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (similarWords(target[i].word, user[j]) && dp[i][j] === dp[i + 1][j + 1] + 1) {
      matched[i] = true
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  const similarity = n + m === 0 ? 1 : (2 * dp[0][0]) / (n + m)
  const chunkOk = chunks.map(() => true)
  target.forEach((t, k) => {
    if (!matched[k]) chunkOk[t.chunk] = false
  })
  return { similarity, parts: chunks.map((text, k) => ({ text, ok: chunkOk[k] })) }
}

// Spanish filler words that should not count as "important" when matching key points.
const STOPWORDS = new Set(
  'para como pero sobre entre cada este esta estos estas todo todos toda todas desde hasta tiene tienen hacer solo tambien otros otras otro otra ante cual cuales donde cuando porque aunque mismo misma sino segun dentro hace sean eran sido unos unas'.split(
    ' ',
  ),
)

function importantWords(text) {
  return [...new Set(words(text).filter((w) => (w.length >= 4 && !STOPWORDS.has(w)) || /^\d+$/.test(w)))]
}

function appearsIn(keyword, wordSet) {
  for (const w of wordSet) {
    if (w === keyword) return true
    if (/^\d+$/.test(keyword) || /^\d+$/.test(w)) continue
    const prefix = Math.min(5, keyword.length)
    if (w.length >= prefix && w.slice(0, prefix) === keyword.slice(0, prefix)) return true
    if (keyword.length >= 5 && levenshtein(w, keyword) <= 1) return true
  }
  return false
}

// Stages 3 and 4: suggests which key points show up in the typed text (the user has the final say).
export function suggestKeyPoints(keyPoints, typed) {
  const wordSet = new Set(words(typed))
  return keyPoints.map((point) => {
    const keys = importantWords(point)
    if (!keys.length || !wordSet.size) return false
    return keys.filter((k) => appearsIn(k, wordSet)).length / keys.length >= 0.5
  })
}

const ES_MARKERS = new Set('el la los las de del que y en un una por con para es se al lo como mas pero su sus'.split(' '))
const EN_MARKERS = new Set('the of and to in a is that for it as with by on are this from be or an'.split(' '))

// Rough guess of the text language ('es' or 'en') from common function words; used to pick a voice.
export function guessLanguage(text, fallback = 'es') {
  const raw = String(text ?? '').toLowerCase()
  if (/[ñ¿¡]/.test(raw)) return 'es'
  let es = 0
  let en = 0
  for (const w of words(raw)) {
    if (ES_MARKERS.has(w)) es++
    if (EN_MARKERS.has(w)) en++
  }
  if (es === en) return fallback
  return es > en ? 'es' : 'en'
}

// Same length as the input: each character lowercased and without its accent, so indexes line up.
function foldChars(s) {
  return Array.from(s, (c) => stripAccents(c).toLowerCase().charAt(0) || c).join('')
}

const WORD_CHAR = /[\p{L}\p{N}]/u

// Where the given key words (e.g. the cloze blanks) appear in `text`, as merged [start, end] ranges.
// Matching ignores case and accents and only counts whole words.
export function keywordRanges(text, keywords) {
  const folded = foldChars(text)
  const ranges = []
  for (const keyword of new Set(keywords.map((k) => k.trim()).filter(Boolean))) {
    const needle = foldChars(keyword)
    for (let from = 0; ; ) {
      const at = folded.indexOf(needle, from)
      if (at < 0) break
      const end = at + needle.length
      if (!WORD_CHAR.test(text[at - 1] ?? '') && !WORD_CHAR.test(text[end] ?? '')) ranges.push([at, end])
      from = at + 1
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([...r])
  }
  return merged
}

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
