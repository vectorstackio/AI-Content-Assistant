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

interface ConversationPiece {
  question: string
  answer: string
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
): Promise<void> => {
  const response = await fetch(`${config.app.apiUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, userType, userId }),
  })

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
}

/**
 * @function getConversationHistory
 * Return a response object.
 *
 * @param  {string}     userId     The user ID.
 * @return {object}
 */
export const getConversationHistory = async (userId: string): Promise<ConversationHistory> => {
  try {
    const response = await fetch(`${config.app.apiUrl}/api/query/${userId}`)
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
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { success: true, pieces: [] }
  }
  const obj: { [queryId: string]: ConversationPiece } = {}
  for (const message of messages) {
    if (message.queryId) obj[message.queryId] = obj[message.queryId] || {}
    if (message.role === 'user') obj[message.queryId].question = message.content
    if (message.role === 'assistant') obj[message.queryId].answer = message.content
  }
  return { success: true, pieces: Object.values(obj) }
}