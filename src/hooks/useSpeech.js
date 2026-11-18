import { useCallback, useEffect, useRef, useState } from 'react'

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined

// Sentences of `text` from `offset` on, keeping where each one starts in the full text.
function sentencesFrom(text, offset) {
  const parts = []
  for (const m of text.matchAll(/[^.!?;:]+[.!?;:]*/g)) {
    const end = m.index + m[0].length
    if (end <= offset) continue
    const start = Math.max(m.index, offset)
    const piece = text.slice(start, end)
    if (piece.trim()) parts.push({ text: piece, start })
  }
  return parts
}

// Length of the word starting at `index` (used when the browser reports no charLength).
function wordLength(text, index) {
  const match = /^[\p{L}\p{N}'’-]+/u.exec(text.slice(index))
  return match ? match[0].length : 0
}

// Reads text aloud with the browser's speech synthesis.
// status: 'idle' | 'speaking' | 'paused'. `sentence` and `word` are [start, end] ranges of what is
// being said (not every voice reports words, so `sentence` is the fallback indicator).
// Pausing cancels and remembers the position; resuming speaks again from that word. That works the
// same in every browser, unlike speechSynthesis.pause(), which several voices ignore.
// `rate`: voice speed (1 = normal); a change applies from the next sentence.
export function useSpeech({ rate = 0.95 } = {}) {
  const rateRef = useRef(rate)
  rateRef.current = rate
  const [status, setStatus] = useState('idle')
  const [sentence, setSentence] = useState(null)
  const [word, setWord] = useState(null)
  const run = useRef(0) // ignores events from cancelled utterances
  const resumeAt = useRef(0)
  const current = useRef({ text: '', lang: '' })
  const utterances = useRef([])

  const clear = () => {
    setStatus('idle')
    setSentence(null)
    setWord(null)
    resumeAt.current = 0
  }

  // Stop talking when the exercise goes away.
  useEffect(
    () => () => {
      run.current++
      synth?.cancel()
    },
    [],
  )

  const speakFrom = useCallback((offset) => {
    if (!synth) return
    const { text, lang } = current.current
    const id = ++run.current
    synth.cancel()
    const parts = sentencesFrom(text, offset)
    if (!parts.length) return clear()
    // Prefer an installed voice for that language; otherwise the browser picks one from `lang`.
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang))
    // One utterance per sentence: some browsers cut long utterances off after a few seconds. They are
    // kept in a ref so Chrome can't garbage-collect them mid-speech (it then never fires their events).
    utterances.current = parts.map((part, i) => {
      const utterance = new SpeechSynthesisUtterance(part.text)
      utterance.lang = lang
      utterance.rate = rateRef.current
      if (voice) utterance.voice = voice
      utterance.onstart = () => {
        if (run.current !== id) return
        resumeAt.current = part.start
        setSentence([part.start, part.start + part.text.length])
        setWord(null)
      }
      utterance.onboundary = (e) => {
        if (run.current !== id || e.name !== 'word') return
        const start = part.start + e.charIndex
        const length = e.charLength || wordLength(text, start)
        resumeAt.current = start
        if (length) setWord([start, start + length])
      }
      utterance.onerror = () => run.current === id && clear()
      if (i === parts.length - 1) utterance.onend = () => run.current === id && clear()
      synth.speak(utterance)
      return utterance
    })
    setStatus('speaking')
  }, [])

  // Starts reading `text` from the beginning.
  const play = useCallback(
    (text, lang) => {
      current.current = { text, lang }
      speakFrom(0)
    },
    [speakFrom],
  )

  const pause = useCallback(() => {
    run.current++
    synth?.cancel()
    setStatus('paused') // keeps the highlight where it stopped
  }, [])

  const resume = useCallback(() => speakFrom(resumeAt.current), [speakFrom])

  const restart = useCallback(() => speakFrom(0), [speakFrom])

  const stop = useCallback(() => {
    run.current++
    synth?.cancel()
    clear()
  }, [])

  // One key for everything: start, pause or continue.
  const toggle = useCallback(
    (text, lang) => {
      if (status === 'speaking') pause()
      else if (status === 'paused' && current.current.text === text) resume()
      else play(text, lang)
    },
    [status, pause, resume, play],
  )

  return { supported: !!synth, status, sentence, word, play, pause, resume, restart, stop, toggle }
}
