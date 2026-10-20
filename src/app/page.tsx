// app/page.tsx

'use client'

import { useState, useEffect, useRef } from 'react'
import Conversation from '@/components/query/Conversation'
import QuestionForm from '@/components/query/QuestionForm'
import StreamingAnswer from '@/components/query/StreamingAnswer'

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

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentQuestion(e.target.value)
    const textarea = textareaRef.current

    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || isStreaming) return
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

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white shadow-lg rounded-2xl p-4 sm:p-8 w-full md:w-1/2 mx-auto">
        <Conversation pieces={conversationPieces} bottomRef={bottomRef} />
        {isStreaming && (
          <StreamingAnswer question={currentQuestion} answer={streamingAnswer} />
        )}
        <QuestionForm
          currentQuestion={currentQuestion}
          placeholder={placeholder}
          message={message}
          messageClasses={messageClasses}
          buttonDisabled={buttonDisabled}
          loading={loading}
          isStreaming={isStreaming}
          textareaRef={textareaRef}
          onSubmit={handleSubmit}
          onChange={handleTextareaChange}
          onKeyDown={handleTextareaKeyDown}
        />
      </div>
    </main>
  )
}
