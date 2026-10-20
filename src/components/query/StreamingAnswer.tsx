// components/query/StreamingAnswer.tsx

import ConversationPiece from './ConversationPiece'

interface StreamingAnswerProps {
  question: string
  answer: string
}

export default function StreamingAnswer({ question, answer }: StreamingAnswerProps) {
  return <ConversationPiece question={question} answer={answer} isStreaming />
}
