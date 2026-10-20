// components/query/ConversationPiece.tsx

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, Bot } from 'lucide-react'

export interface ConversationPieceProps {
  question?: string
  answer?: string
  type?: 'normal' | 'escalation'
  isStreaming?: boolean
}

export default function ConversationPiece({
  question,
  answer,
  type,
  isStreaming = false,
}: ConversationPieceProps) {
  return (
    <div className="flex flex-col gap-3 mb-6 animate-fade-in-up">
      {/* USER MESSAGE */}
      <div className="flex justify-end">
        <div className="flex items-end gap-3 max-w-[80%]">

          <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-br-sm">
            {question}
          </div>

          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
            <User size={20} />
          </div>

        </div>
      </div>
      {/* ASSISTANT MESSAGE */}
      <div className="flex justify-start">
        <div className="flex items-end gap-3 max-w-[80%]">

          <div className="w-10 h-10 rounded-full bg-gray-700 text-white flex items-center justify-center shrink-0">
            <Bot size={20} />
          </div>

          <div 
            className={`bg-white border border-gray-200 text-gray-900 px-4 py-3 rounded-2xl rounded-bl-sm prose prose-sm max-w-none shadow-sm ${type === 'escalation' ? 'bg-yellow-100' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {answer}
            </ReactMarkdown>
            {isStreaming && <span className="animate-pulse">▋</span>}
          </div>

        </div>
      </div>
    </div>
  )
}
