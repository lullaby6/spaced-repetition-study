import { useState } from 'react'
import CopyStage from './stages/CopyStage.jsx'
import ClozeStage from './stages/ClozeStage.jsx'
import RecallStage from './stages/RecallStage.jsx'

// Runs the exercise for one stage and handles "try again" after a failure.
// Only the first attempt counts: retries are practice and report that first record.
// A record is { result, ratio?, response } where `response` is what the user answered.
export default function Exercise({ question, stage, outcomeFor, onDone }) {
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

  if (stage === 1) return <CopyStage key={attempt} {...props} />
  if (stage === 2) return <ClozeStage key={attempt} {...props} />
  return <RecallStage key={attempt} {...props} withHints={stage === 3} />
}
