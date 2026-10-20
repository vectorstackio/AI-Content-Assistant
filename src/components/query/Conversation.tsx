// components/query/Conversation.tsx

import type { Ref } from 'react'
import ConversationPiece, { type ConversationPieceProps } from './ConversationPiece'

interface ConversationProps {
  pieces: ConversationPieceProps[]
  bottomRef: Ref<HTMLDivElement>
}

export default function Conversation({ pieces, bottomRef }: ConversationProps) {
  if (pieces.length === 0) {
    return (
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Ask a Question
      </h1>
    )
  }

  return (
    <div className="h-[70vh] overflow-y-auto">
      {pieces.map((piece, i) => <ConversationPiece key={i} {...piece} />)}
      <div ref={bottomRef} />
    </div>
  )
}
