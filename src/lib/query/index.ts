// lib/query/index.ts

import config from '@/lib/common/config'
//import { FetchResponse } from '@/types'

interface Message {
  userId: string
  content: string
  role: string
  queryId: string
  createdAt: Date
}

// interface ConversationPiece {
//   question: string
//   answer: string
// }

type ConversationPiece = {
  question?: string
  answer?: string
}

interface ConversationHistory {
  success: boolean
  pieces: ConversationPiece[]
  error?: string
}

/**
 * @function ingestUrl
 * Return a response object.
 *
 * @param  {string}     question     The question to ask.
 * @param  {string}     userType     The type of user.
 * @return {object}
 */
export const askQuestion = async (
  question: string,
  onChunk: (chunk: string) => void,
  userType: string = 'pupil',
  userId: string = '12345'
): Promise<{ status: string | null }> => {

  const response = await fetch(
    `${config.app.apiUrl}/api/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        userType,
        userId,
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  // ✅ MUST read BEFORE consuming body
  const status = response.headers.get('X-AI-Status')

  if (!response.body) {
    throw new Error('No response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { value, done } = await reader.read()

    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    onChunk(chunk)
  }

  return {
    status,
  }
}

/**
 * @function isGibberish
 * Return true if text is gibberish.
 *
 * @param  {string}     text     The text to check.
 * @return {boolean}
 */
export const isGibberish = (text: string) => {
  const words = text.trim().split(/\s+/)

  const lowVocab = words.filter(
    w => w.length < 3
  ).length

  return lowVocab / words.length > 0.4
}

/**
 * @function getConversationHistory
 * Return a response object.
 *
 * @param  {string}     userId     The user ID.
 * @return {object}
 */
export const getConversationHistory = async (_userId: string): Promise<ConversationHistory> => {
  try {
    const response = await fetch('/api/query/history')
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const result = await response.json()

    return getPiecesFromMessages(result.data)
  } catch (err: unknown) {
    return {
      success: false,
      pieces: [],
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

const getPiecesFromMessages = (messages: Message[]): ConversationHistory => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { success: true, pieces: [] }
  }

  const pieces = new Map<string, ConversationPiece>()

  for (const message of messages) {
    const { queryId, role, content } = message
    if (!queryId) continue
    if (role !== 'user' && role !== 'assistant') continue
    const piece = pieces.get(queryId) ?? {}

    if (role === 'user') {
      piece.question = content
    } else {
      piece.answer = content
    }

    pieces.set(queryId, piece)
  }

  return {
    success: true,
    pieces: Array.from(pieces.values()),
  }
}