// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ingestUrl } from '@/lib/ingest'
import { ValidationError } from '@/lib/common/error'
import type { FetchResponse, ValidationInput } from '@/types'

vi.mock('@/lib/common/config', () => ({
  default: { app: { apiUrl: 'https://api.example.test' } },
}))

const fetchMock = vi.fn<typeof fetch>()
const validInput: ValidationInput = { url: 'https://example.com/article', userType: 'pupil' }

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('INGEST_API_KEY', 'server-only-test-secret')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('ingestUrl requests and responses', () => {
  it('keeps the server API key out of browser requests', async () => {
    fetchMock.mockResolvedValue(Response.json({ success: true }))
    await ingestUrl(validInput.url, validInput.userType)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/ingest')
    expect(new Headers(options?.headers).has('x-api-key')).toBe(false)
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('server-only-test-secret')
  })

  it.each(['pupil', 'teacher', 'tutor'])('posts the URL and supported %s user type and returns parsed JSON', async (userType) => {
    const data: FetchResponse = { success: true, message: 'Content added' }
    fetchMock.mockResolvedValue(Response.json(data))

    await expect(ingestUrl(validInput.url, userType)).resolves.toEqual(data)
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: validInput.url, userType }),
    })
  })

  it('returns unsuccessful API responses without throwing', async () => {
    const data: FetchResponse = { success: false, error: 'Content could not be ingested' }
    fetchMock.mockResolvedValue(Response.json(data))
    await expect(ingestUrl(validInput.url, validInput.userType)).resolves.toEqual(data)
  })

  it('preserves optional response fields', async () => {
    const data: FetchResponse = { success: true, message: 'Added', answer: 'Summary' }
    fetchMock.mockResolvedValue(Response.json(data, { status: 201 }))
    await expect(ingestUrl(validInput.url, validInput.userType)).resolves.toEqual(data)
  })

  // Characterisation: HTTP status is not inspected; only JSON parsing determines the result.
  it.each([400, 404, 500])('currently returns a JSON error body for HTTP %i without throwing', async (status) => {
    const data: FetchResponse = { success: false, error: `HTTP ${status}` }
    fetchMock.mockResolvedValue(Response.json(data, { status }))
    await expect(ingestUrl(validInput.url, validInput.userType)).resolves.toEqual(data)
  })

  it('currently accepts a success payload even when HTTP status is 500', async () => {
    const data: FetchResponse = { success: true, message: 'Reported as successful' }
    fetchMock.mockResolvedValue(Response.json(data, { status: 500 }))
    await expect(ingestUrl(validInput.url, validInput.userType)).resolves.toEqual(data)
  })

  it('propagates network failures', async () => {
    const error = new TypeError('Failed to fetch')
    fetchMock.mockRejectedValue(error)
    await expect(ingestUrl(validInput.url, validInput.userType)).rejects.toBe(error)
  })

  it('propagates an unexpected synchronous HTTP-client exception', async () => {
    const error = new Error('Unexpected client failure')
    fetchMock.mockImplementation(() => { throw error })
    await expect(ingestUrl(validInput.url, validInput.userType)).rejects.toBe(error)
  })

  it.each([200, 500])('rejects malformed JSON for HTTP %i', async (status) => {
    fetchMock.mockResolvedValue(new Response('<html>Not JSON</html>', { status }))
    await expect(ingestUrl(validInput.url, validInput.userType)).rejects.toBeInstanceOf(SyntaxError)
  })

  it('rejects an empty response body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(ingestUrl(validInput.url, validInput.userType)).rejects.toBeInstanceOf(SyntaxError)
  })

  it('propagates errors while reading the response body', async () => {
    const error = new Error('Response interrupted')
    fetchMock.mockResolvedValue(new Response(new ReadableStream({
      start(controller) { controller.error(error) },
    })))
    await expect(ingestUrl(validInput.url, validInput.userType)).rejects.toBe(error)
  })

  // TypeScript's FetchResponse annotation does not validate JSON at runtime.
  it.each([null, {}, [], 'unexpected', 42, { success: 'yes', extra: 'kept' }])('currently passes unexpected JSON through unchanged: %j', async (data) => {
    fetchMock.mockResolvedValue(Response.json(data))
    await expect(ingestUrl(validInput.url, validInput.userType)).resolves.toEqual(data)
  })
})

describe('ingestUrl input validation', () => {
  it.each([
    { url: '', userType: 'pupil', error: 'URL is required' },
    { url: '', userType: '', error: 'URL is required' },
    // Known bug: the first condition also checks userType, masking its specific error.
    { url: 'https://example.com', userType: '', error: 'URL is required' },
    { url: 'https://example.com', userType: 'admin', error: 'Please select a valid user type' },
    { url: 'https://example.com', userType: 'Pupil', error: 'Please select a valid user type' },
    { url: 'https://example.com', userType: ' pupil ', error: 'Please select a valid user type' },
    { url: '   ', userType: 'pupil', error: 'Please enter a valid URL' },
    { url: 'not-a-url', userType: 'pupil', error: 'Please enter a valid URL' },
    { url: 'example.com', userType: 'pupil', error: 'Please enter a valid URL' },
    { url: 'https://', userType: 'pupil', error: 'Please enter a valid URL' },
    { url: 'ftp://example.com', userType: 'pupil', error: 'Please enter a valid URL' },
  ])('rejects URL "$url" and user type "$userType" before making a request', async ({ url, userType, error }) => {
    await expect(ingestUrl(url, userType)).rejects.toMatchObject({
      name: 'ValidationError', message: error,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws an instance of the shared ValidationError class', async () => {
    await expect(ingestUrl('', 'pupil')).rejects.toBeInstanceOf(ValidationError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('checks user type before URL format', async () => {
    await expect(ingestUrl('malformed', 'admin')).rejects.toThrow('Please select a valid user type')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    'http://example.com',
    'https://www.example.com/article?topic=science#details',
    'www.example.com',
    'HTTPS://EXAMPLE.COM/Article',
    'https://a.co',
    'www.a.co',
  ])('accepts the supported URL form %s and sends it unchanged', async (url) => {
    fetchMock.mockResolvedValue(Response.json({ success: true }))
    await expect(ingestUrl(url, 'pupil')).resolves.toEqual({ success: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/ingest', expect.objectContaining({
      body: JSON.stringify({ url, userType: 'pupil' }),
    }))
  })

  it.each(['  https://example.com  ', 'prefix https://example.com suffix'])('currently matches URLs within surrounding text and sends the whole input: %s', async (url) => {
    fetchMock.mockResolvedValue(Response.json({ success: true }))
    await expect(ingestUrl(url, 'pupil')).resolves.toEqual({ success: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/ingest', expect.objectContaining({
      body: JSON.stringify({ url, userType: 'pupil' }),
    }))
  })

  it('validates repeated requests independently despite the regex global flag', async () => {
    fetchMock.mockImplementation(async () => Response.json({ success: true }))
    await expect(ingestUrl(validInput.url, validInput.userType)).resolves.toEqual({ success: true })
    await expect(ingestUrl(validInput.url, validInput.userType)).resolves.toEqual({ success: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
