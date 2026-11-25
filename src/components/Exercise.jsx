import { useState } from 'react'
import CopyStage from './stages/CopyStage.jsx'
import ClozeStage from './stages/ClozeStage.jsx'
import RecallStage from './stages/RecallStage.jsx'

// Runs the exercise for one stage and handles "try again" after a failure.
// Only the first attempt counts: retries are practice and report that first record.
// A record is { result, ratio?, response } where `response` is what the user answered.
// `stage` is 1-3 in study sessions, or 'exam' for the written mock exam (recall with nothing shown
// first, hints only on request; `outcomeFor` is null there).
// `readRate`: voice speed chosen for the session; `speech`: the session's voice, shared with stage 1's
// "Listen" button so it reflects what the automatic reading is doing.
// `readFirst`: stage 3 shows the answer until "I'm ready" (a session setting, on by default).
export default function Exercise({ question, stage, outcomeFor, readRate, speech, readFirst = true, onDone }) {
  const [attempt, setAttempt] = useState(0)
  const [first, setFirst] = useState(null)

  const props = {
    question,
    practice: !!first,
    outcomeFor: outcomeFor && (first ? () => outcomeFor(first.result) : outcomeFor),
    onDone: (record) => onDone(first || record),
    onRetry: (record) => {
      setFirst((f) => f || record)
      setAttempt((a) => a + 1)
    },
  }

  if (stage === 1) return <CopyStage key={attempt} {...props} readRate={readRate} speech={speech} />
  if (stage === 2) return <ClozeStage key={attempt} {...props} />
  if (stage === 'exam') return <RecallStage key={attempt} {...props} withHints={false} askHints />
  // Stage 3: read the answer first (if enabled); when ready it is hidden and you write it from memory, hints in view.
  return <RecallStage key={attempt} {...props} withHints readFirst={readFirst} />
}
