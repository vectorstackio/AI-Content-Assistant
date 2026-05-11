// app/page.tsx

'use client'

import { useState, useEffect, useRef } from 'react'

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
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const buttonDisabled = !currentQuestion
  const placeholder = 'Ask anything...'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversationPieces])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { value } = e.target
    setCurrentQuestion(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await askQuestion(currentQuestion)
      if (response.success) {
        const current: ConversationPiece  = {
          question: currentQuestion,
          answer: response.answer ?? ''
        }
        setConversationPieces([ ...conversationPieces, current])
        setCurrentQuestion('')
      } else {
        setMessage(response.message ?? '')
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        setMessage(err.message)
        setMessageClasses('text-red-500')
      }
      else {
        setMessage('An unexpected error occurred')
        setMessageClasses('text-red-500')
      }
    } finally {
      setLoading(false)
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
                  <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-2xl rounded-bl-sm max-w-[100%]">{cp.answer}</div>
                </div>
              </div>)
            )}
          </div>
        }

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="text"
            name="url"
            placeholder={placeholder}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={currentQuestion}
            onChange={(e) => handleChange(e)}
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
        <div ref={bottomRef} />
      </div>
    </main>
  )
}
