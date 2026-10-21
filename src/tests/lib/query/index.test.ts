// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { askQuestion, getConversationHistory } from '@/lib/query'

vi.mock('@/lib/common/config', () => ({
  default: { app: { apiUrl: 'https://api.example.test' } },
}))

const encoder = new TextEncoder()
const fetchMock = vi.fn<typeof fetch>()

function streamResponse(chunks: Uint8Array[], aiStatus?: string) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
  return new Response(body, {
    headers: aiStatus === undefined ? {} : { 'X-AI-Status': aiStatus },
  })
}

function message(queryId: string, role: string, content: string) {
  return { userId: 'user-1', queryId, role, content, createdAt: new Date('2026-01-01T00:00:00Z') }
}

function historyResponse(data: unknown) {
  fetchMock.mockResolvedValue(Response.json({ data }))
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('askQuestion', () => {
  it('posts the question with default user details and delivers the response', async () => {
    fetchMock.mockResolvedValue(streamResponse([encoder.encode('An answer')], 'normal'))
    const onChunk = vi.fn()

    await expect(askQuestion('A question', onChunk)).resolves.toEqual({ status: 'normal' })

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://api.example.test/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'A question', userType: 'pupil', userId: '12345' }),
    })
    expect(onChunk).toHaveBeenCalledExactlyOnceWith('An answer')
  })

  it('uses explicitly supplied user details', async () => {
    fetchMock.mockResolvedValue(streamResponse([]))
    await askQuestion('Teacher question', vi.fn(), 'teacher', 'user-2')
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/query', expect.objectContaining({
      body: JSON.stringify({ question: 'Teacher question', userType: 'teacher', userId: 'user-2' }),
    }))
  })

  it('delivers each decoded chunk once in stream order', async () => {
    fetchMock.mockResolvedValue(streamResponse(['Hello', ' ', 'world!'].map((text) => encoder.encode(text))))
    const onChunk = vi.fn()
    await askQuestion('Hello?', onChunk)
    expect(onChunk.mock.calls).toEqual([['Hello'], [' '], ['world!']])
  })

  it('preserves UTF-8 characters split across byte chunks', async () => {
    const bytes = encoder.encode('A€🙂Z')
    fetchMock.mockResolvedValue(streamResponse([
      bytes.slice(0, 2), bytes.slice(2, 5), bytes.slice(5, 7), bytes.slice(7),
    ]))
    const onChunk = vi.fn()
    await askQuestion('Unicode?', onChunk)
    expect(onChunk.mock.calls.map(([chunk]) => chunk).join('')).toBe('A€🙂Z')
    expect(onChunk.mock.calls.flat().join('')).not.toContain('\uFFFD')
  })

  it.each(['normal', 'unknown', 'custom-status'])('returns the %s AI status unchanged', async (status) => {
    fetchMock.mockResolvedValue(streamResponse([encoder.encode('Answer')], status))
    await expect(askQuestion('Question', vi.fn())).resolves.toEqual({ status })
  })

  it('returns null when the AI status header is missing', async () => {
    fetchMock.mockResolvedValue(streamResponse([]))
    await expect(askQuestion('Question', vi.fn())).resolves.toEqual({ status: null })
  })

  it.each([400, 401, 429, 500])('rejects HTTP %i without delivering the error body', async (status) => {
    fetchMock.mockResolvedValue(new Response('Backend error', { status }))
    const onChunk = vi.fn()
    await expect(askQuestion('Question', onChunk)).rejects.toThrow(`Request failed: ${status}`)
    expect(onChunk).not.toHaveBeenCalled()
  })

  it('propagates network failures without delivering tokens', async () => {
    const error = new TypeError('Network unavailable')
    fetchMock.mockRejectedValue(error)
    const onChunk = vi.fn()
    await expect(askQuestion('Question', onChunk)).rejects.toBe(error)
    expect(onChunk).not.toHaveBeenCalled()
  })

  it('rejects a successful response with no body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const onChunk = vi.fn()
    await expect(askQuestion('Question', onChunk)).rejects.toThrow('No response body')
    expect(onChunk).not.toHaveBeenCalled()
  })

  it('accepts a closed empty stream without invoking the callback', async () => {
    fetchMock.mockResolvedValue(streamResponse([], 'unknown'))
    const onChunk = vi.fn()
    await expect(askQuestion('Question', onChunk)).resolves.toEqual({ status: 'unknown' })
    expect(onChunk).not.toHaveBeenCalled()
  })

  it('rejects a stream that fails before its first chunk', async () => {
    const error = new Error('Stream unavailable')
    fetchMock.mockResolvedValue(new Response(new ReadableStream({
      start(controller) { controller.error(error) },
    })))
    const onChunk = vi.fn()
    await expect(askQuestion('Question', onChunk)).rejects.toBe(error)
    expect(onChunk).not.toHaveBeenCalled()
  })

  it('delivers earlier tokens before propagating an interrupted stream error', async () => {
    const error = new Error('Connection interrupted')
    let sent = false
    fetchMock.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!sent) {
          sent = true
          controller.enqueue(encoder.encode('Partial answer'))
        } else {
          controller.error(error)
        }
      },
    })))
    const onChunk = vi.fn()
    await expect(askQuestion('Question', onChunk)).rejects.toBe(error)
    expect(onChunk).toHaveBeenCalledExactlyOnceWith('Partial answer')
  })

  it('propagates errors thrown by the token callback', async () => {
    fetchMock.mockResolvedValue(streamResponse([encoder.encode('First'), encoder.encode('Second')]))
    const error = new Error('Consumer failed')
    const onChunk = vi.fn(() => { throw error })
    await expect(askQuestion('Question', onChunk)).rejects.toBe(error)
    expect(onChunk).toHaveBeenCalledExactlyOnceWith('First')
  })

  // Characterisation: the decoder is not flushed when the stream closes.
  it('currently drops an incomplete UTF-8 suffix at end of stream', async () => {
    const bytes = encoder.encode('Answer€')
    fetchMock.mockResolvedValue(streamResponse([bytes.slice(0, -1)]))
    const onChunk = vi.fn()
    await askQuestion('Question', onChunk)
    expect(onChunk.mock.calls.map(([chunk]) => chunk).join('')).toBe('Answer')
  })
})

describe('getConversationHistory and message grouping', () => {
  it('requests history through the local proxy and accepts an empty history', async () => {
    historyResponse([])
    await expect(getConversationHistory('user-1')).resolves.toEqual({ success: true, pieces: [] })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/query/history')
  })

  it.each([undefined, null, {}, 'invalid'])('currently treats non-array data %j as empty history', async (data) => {
    historyResponse(data)
    await expect(getConversationHistory('user-1')).resolves.toEqual({ success: true, pieces: [] })
  })

  it('matches interleaved messages by queryId and preserves first-seen query order', async () => {
    historyResponse([
      message('q2', 'assistant', 'Second answer'),
      message('q1', 'user', 'First question'),
      message('q2', 'user', 'Second question'),
      message('q1', 'assistant', 'First answer'),
    ])
    await expect(getConversationHistory('user-1')).resolves.toEqual({
      success: true,
      pieces: [
        { question: 'Second question', answer: 'Second answer' },
        { question: 'First question', answer: 'First answer' },
      ],
    })
  })

  it.each([undefined, null, '', 0, false])('skips messages with a falsy queryId: %j', async (queryId) => {
    historyResponse([
      { ...message('unused', 'user', 'Ignored question'), queryId },
      { ...message('unused', 'assistant', 'Ignored answer'), queryId },
      message('valid', 'user', 'Kept question'),
    ])
    await expect(getConversationHistory('user-1')).resolves.toEqual({
      success: true, pieces: [{ question: 'Kept question' }],
    })
  })

  // Characterisation: truthiness is checked, but the queryId type is not validated.
  it('currently accepts numeric query IDs and distinguishes them from strings', async () => {
    historyResponse([
      { ...message('unused', 'user', 'Numeric question'), queryId: 7 },
      { ...message('unused', 'assistant', 'Numeric answer'), queryId: 7 },
      message('7', 'user', 'String question'),
    ])
    await expect(getConversationHistory('user-1')).resolves.toEqual({
      success: true,
      pieces: [
        { question: 'Numeric question', answer: 'Numeric answer' },
        { question: 'String question' },
      ],
    })
  })

  it('currently accepts whitespace-only query IDs', async () => {
    historyResponse([message('   ', 'user', 'Question')])
    await expect(getConversationHistory('user-1')).resolves.toEqual({
      success: true, pieces: [{ question: 'Question' }],
    })
  })

  it('preserves unmatched questions and answers as separate partial pieces', async () => {
    historyResponse([message('q1', 'user', 'Question only'), message('q2', 'assistant', 'Answer only')])
    await expect(getConversationHistory('user-1')).resolves.toEqual({
      success: true, pieces: [{ question: 'Question only' }, { answer: 'Answer only' }],
    })
  })

  it('does not duplicate a piece for repeated identical messages', async () => {
    const question = message('q1', 'user', 'Question')
    const answer = message('q1', 'assistant', 'Answer')
    historyResponse([question, question, answer, answer])
    await expect(getConversationHistory('user-1')).resolves.toEqual({
      success: true, pieces: [{ question: 'Question', answer: 'Answer' }],
    })
  })

  it('uses the last message encountered for each role, rather than sorting timestamps', async () => {
    historyResponse([
      { ...message('q1', 'user', 'Original question'), createdAt: new Date('2026-02-01') },
      message('q1', 'assistant', 'Original answer'),
      message('q1', 'user', 'Replacement question'),
      message('q1', 'assistant', 'Replacement answer'),
    ])
    await expect(getConversationHistory('user-1')).resolves.toEqual({
      success: true, pieces: [{ question: 'Replacement question', answer: 'Replacement answer' }],
    })
  })

  it('ignores unexpected roles without creating empty conversation pieces', async () => {
    historyResponse([
      message('ignored', 'system', 'Instructions'),
      message('q1', 'tool', 'Tool output'),
      message('q1', 'user', 'Question'),
      message('q1', 'assistant', 'Answer'),
      message('q1', 'developer', 'More instructions'),
    ])
    await expect(getConversationHistory('user-1')).resolves.toEqual({
      success: true, pieces: [{ question: 'Question', answer: 'Answer' }],
    })
  })

  it('handles query IDs that coincide with object property names', async () => {
    historyResponse([message('__proto__', 'user', 'Question'), message('__proto__', 'assistant', 'Answer')])
    await expect(getConversationHistory('user-1')).resolves.toEqual({
      success: true, pieces: [{ question: 'Question', answer: 'Answer' }],
    })
  })

  it.each([401, 404, 500, 503])('returns a failure for HTTP %i, including backend failures', async (status) => {
    fetchMock.mockResolvedValue(new Response('Database unavailable', { status }))
    await expect(getConversationHistory('user-1')).resolves.toEqual({
      success: false, pieces: [], error: `Request failed with status ${status}`,
    })
  })

  it('returns network errors without throwing', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network unavailable'))
    await expect(getConversationHistory('user-1')).resolves.toEqual({
      success: false, pieces: [], error: 'Network unavailable',
    })
  })

  it('uses a fallback message for non-Error rejections', async () => {
    fetchMock.mockRejectedValue('offline')
    await expect(getConversationHistory('user-1')).resolves.toEqual({
      success: false, pieces: [], error: 'Unknown error',
    })
  })

  it('returns a failure when the response body is not valid JSON', async () => {
    fetchMock.mockResolvedValue(new Response('not JSON'))
    const result = await getConversationHistory('user-1')
    expect(result).toEqual({ success: false, pieces: [], error: expect.any(String) })
    expect(result.error).not.toBe('')
  })

  it('currently converts a null message entry into a failed history request', async () => {
    historyResponse([message('q1', 'user', 'Valid question'), null])
    await expect(getConversationHistory('user-1')).resolves.toEqual({
      success: false, pieces: [], error: expect.any(String),
    })
  })

  it('currently treats a JSON API failure envelope without data as empty successful history', async () => {
    fetchMock.mockResolvedValue(Response.json({ success: false, error: 'Database unavailable' }))
    await expect(getConversationHistory('user-1')).resolves.toEqual({ success: true, pieces: [] })
  })
})
