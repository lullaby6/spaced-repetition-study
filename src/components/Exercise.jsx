import { useState } from 'react'
import CopyStage from './stages/CopyStage.jsx'
import ClozeStage from './stages/ClozeStage.jsx'
import RecallStage from './stages/RecallStage.jsx'

// Runs the exercise for one stage and handles "try again" after a failure.
// Only the first attempt counts: retries are practice and report that first record.
// A record is { result, ratio?, response } where `response` is what the user answered.
// Stage 4 can ask for step-by-step hints. In a study session (`outcomeFor` set) using them keeps the
// question from being mastered; in the mock exam they are only recorded.
// `readRate`: voice speed chosen for the session; `speech`: the session's voice, shared with stage 1's
// "Listen" button so it reflects what the automatic reading is doing.
export default function Exercise({ question, stage, outcomeFor, readRate, speech, onDone }) {
  const askHints = stage === 4
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
  // In study sessions stage 4 lets you read the answer first; the mock exam does not.
  const studying = !!outcomeFor
  return (
    <RecallStage
      key={attempt}
      {...props}
      withHints={stage === 3}
      askHints={askHints}
      hintsCapResult={askHints && studying}
      readFirst={stage === 4 && studying}
    />
  )
}
