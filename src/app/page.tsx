// app/page.tsx

'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { askQuestion } from '@/lib/query'
import { ValidationError } from '@/lib/common/error'

interface ConversationPiece {
  question: string
  answer: string
}

export default function Home() {
  const [loading, setLoading] = useState<boolean>(false)
  const [currentQuestion, setCurrentQuestion] = useState<string>('')
  const [conversationPieces, setConversationPieces] = useState<ConversationPiece[]>([])
  const [message, setMessage] = useState<string>('')
  const [messageClasses, setMessageClasses] = useState<string>('text-green-500')
  const [streamingAnswer, setStreamingAnswer] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const buttonDisabled = !currentQuestion
  const placeholder = 'Ask anything...'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversationPieces])

  const handleTextareaChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setCurrentQuestion(e.target.value)

    const textarea = textareaRef.current

    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    setMessage('')
    setStreamingAnswer('')
    setIsStreaming(true)

    const question = currentQuestion

    try {
      let fullAnswer = ''

      await askQuestion(question, (token) => {
        fullAnswer += token
        setStreamingAnswer(fullAnswer)
      })

      const current: ConversationPiece = {
        question,
        answer: fullAnswer,
      }

      setConversationPieces(prev => [...prev, current])
      setCurrentQuestion('')
      setStreamingAnswer('')
    } catch (err) {
      if (err instanceof ValidationError) {
        setMessage(err.message)
        setMessageClasses('text-red-500')
      } else {
        setMessage('An unexpected error occurred')
        setMessageClasses('text-red-500')
      }
    } finally {
      setLoading(false)
      setIsStreaming(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-1/2 mx-auto">
        {conversationPieces.length === 0 && <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Ask a Question
        </h1>}

        {
          conversationPieces.length > 0 &&
          <div>
            {conversationPieces.map((cp, i) => (
              <div className="flex flex-col gap-3 mb-6" key={i}>
                <div className="flex justify-end">
                  <div className="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-br-sm max-w-[75%]">{cp.question}:</div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-2xl rounded-bl-sm max-w-[100%]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{cp.answer}</ReactMarkdown>
                  </div>
                </div>
              </div>)
            )}
          </div>
        }

        {isStreaming && (
          <div className="flex flex-col gap-3 mb-6">
            <div className="flex justify-end">
              <div className="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-br-sm max-w-[75%]">
                {currentQuestion}
              </div>
            </div>

            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-2xl rounded-bl-sm max-w-[100%]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingAnswer}</ReactMarkdown>
                <span className="animate-pulse">▋</span>
              </div>
            </div>
          </div>
        )}

        <div className="border border-gray-300 rounded-3xl p-3 shadow-sm bg-white">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              name="question"
              placeholder={placeholder}
              rows={1}
              value={currentQuestion}
              onChange={handleTextareaChange}
              className="w-full resize-none overflow-hidden border border-gray-300 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e as unknown as React.FormEvent)
                }
              }}
            />

            {message && <div className={messageClasses}>{message}</div>}

            <button
              disabled={buttonDisabled || loading}
              type="submit"
              className={`bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition ${buttonDisabled || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Thinking...' : 'Ask'}
            </button>
          </form>
        </div>
        <div ref={bottomRef} />
      </div>
    </main>
  )
}
