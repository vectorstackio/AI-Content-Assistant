// app/page.tsx

'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, Bot } from 'lucide-react'

import { askQuestion, getConversationHistory/*, isGibberish */ } from '@/lib/query'
import { ValidationError } from '@/lib/common/error'

interface ConversationPiece {
  question?: string
  answer?: string
  type?: 'normal' | 'escalation'
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
    const loadConversationHistory = async () => {
      try {
        const existingConversation = await getConversationHistory('12345')
        setConversationPieces(existingConversation.pieces)
      } catch {
        setMessage('Unable to load conversation history')
        setMessageClasses('text-red-500')
      }
    }

    void loadConversationHistory()
  }, [])

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

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault()

    const question = currentQuestion.trim()

    if (!question) {
      setMessage('Please enter a question')
      setMessageClasses('text-red-500')
      return
    }

    if (question.length > 500) {
      setMessage('Question is too long')
      setMessageClasses('text-red-500')
      return
    }

    setLoading(true)
    setMessage('')
    setStreamingAnswer('')
    setIsStreaming(true)

    try {
      let fullAnswer = ''

      const { status } =
        await askQuestion(
          question,
          (token) => {
            fullAnswer += token
            setStreamingAnswer(fullAnswer)
          },
          'pupil',
          '12345'
        )

      const current: ConversationPiece = {
        question,
        answer: fullAnswer,
        type: 'normal',
      }

      // 🟡 ESCALATION CASE
      if (status === 'unknown') {
        setConversationPieces((prev) => [
          ...prev,
          {
            question,
            answer:
              'I couldn\'t find a confident answer. If you\'d like, you can email our support team and we\'ll get back to you.',
            type: 'escalation',
          },
        ])
      }
      else {
        setConversationPieces((prev) => [
          ...prev,
          current,
        ])
      }

      setCurrentQuestion('')
      setStreamingAnswer('')

    } catch (err) {
      if (err instanceof ValidationError) {
        setMessage(err.message)
        setMessageClasses('text-red-500')
      } else {
        setMessage(
          'An unexpected error occurred'
        )
        setMessageClasses('text-red-500')
      }
    } finally {
      setLoading(false)
      setIsStreaming(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white shadow-lg rounded-2xl p-4 sm:p-8 w-full md:w-1/2 mx-auto">
        {conversationPieces.length === 0 && <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Ask a Question
        </h1>}

        {
          conversationPieces.length > 0 &&
          <div className="h-[70vh] overflow-y-auto">
            {conversationPieces.map((cp, i) => (
              <div className="flex flex-col gap-3 mb-6 animate-fade-in-up" key={i}>
                {/* USER MESSAGE */}
                <div className="flex justify-end">
                  <div className="flex items-end gap-3 max-w-[80%]">

                    <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-br-sm">
                      {cp.question}
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
                      className={`bg-white border border-gray-200 text-gray-900 px-4 py-3 rounded-2xl rounded-bl-sm prose prose-sm max-w-none shadow-sm ${cp.type === 'escalation' ? 'bg-yellow-100' : ''}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {cp.answer}
                      </ReactMarkdown>
                    </div>

                  </div>
                </div>
              </div>)
            )}
            <div ref={bottomRef} />
          </div>
        }

        {isStreaming && (
          <div className="flex flex-col gap-3 mb-6 animate-fade-in-up">
            {/* USER */}
            <div className="flex justify-end">
              <div className="flex items-end gap-3 max-w-[80%]">

                <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-br-sm">
                  {currentQuestion}
                </div>

                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <User size={20} />
                </div>

              </div>
            </div>

            {/* STREAMING ASSISTANT */}
            <div className="flex justify-start">
              <div className="flex items-end gap-3 max-w-[80%]">

                <div className="w-10 h-10 rounded-full bg-gray-700 text-white flex items-center justify-center shrink-0">
                  <Bot size={20} />
                </div>

                <div className="bg-white border border-gray-200 text-gray-900 px-4 py-3 rounded-2xl rounded-bl-sm prose prose-sm max-w-none shadow-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {streamingAnswer}
                  </ReactMarkdown>

                  <span className="animate-pulse">▋</span>
                </div>

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
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
              // onKeyDown={(e) => {
              //   if (e.key === 'Enter' && !e.shiftKey) {
              //     e.preventDefault()
              //     handleSubmit(e as unknown as React.FormEvent)
              //   }
              // }}
            />

            {message && <div className={messageClasses}>{message}</div>}

            <button
              disabled={buttonDisabled || loading || isStreaming}
              type="submit"
              className={`bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition ${buttonDisabled || loading || isStreaming ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Thinking...' : 'Ask'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
