// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST, runtime } from '@/app/api/ingest/route'

vi.mock('@/lib/common/config', () => ({
  default: { app: { apiUrl: 'https://backend.example.test' } },
}))

const fetchMock = vi.fn<typeof fetch>()
const payload = { url: 'https://example.com/article?x=1', userType: 'pupil' }
const authorization = `Basic ${Buffer.from('admin:test-password').toString('base64')}`

function request(body: unknown = payload, auth: string | null = authorization) {
  return new NextRequest('http://localhost/api/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth === null ? {} : { authorization: auth }),
      'x-api-key': 'untrusted-client-key',
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('INGEST_ADMIN_USER', 'admin')
  vi.stubEnv('INGEST_ADMIN_PASSWORD', 'test-password')
  vi.stubEnv('INGEST_API_KEY', 'server-only-test-key')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('POST /api/ingest', () => {
  it.each(['pupil', 'teacher', 'tutor'])('forwards an authenticated %s request with the server key', async (userType) => {
    const data = { success: true, message: 'Content added', extra: { id: 42 } }
    fetchMock.mockResolvedValue(Response.json(data, { status: 201 }))
    const timeout = vi.spyOn(AbortSignal, 'timeout')

    const response = await POST(request({ ...payload, userType, ignored: 'not forwarded' }))

    expect(runtime).toBe('nodejs')
    expect(timeout).toHaveBeenCalledExactlyOnceWith(30000)
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://backend.example.test/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'server-only-test-key' },
      body: JSON.stringify({ ...payload, userType }),
      cache: 'no-store',
      signal: timeout.mock.results[0].value,
    })
    expect(response.status).toBe(201)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual(data)
  })

  it.each([200, 202, 400, 401, 403, 422, 429, 500, 503])('preserves backend JSON body and HTTP %i', async (status) => {
    const data = { success: status < 400, error: 'Backend detail', details: ['retained'] }
    fetchMock.mockResolvedValue(Response.json(data, { status }))
    const response = await POST(request())
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual(data)
  })

  it.each(['INGEST_API_KEY', 'INGEST_ADMIN_USER', 'INGEST_ADMIN_PASSWORD'])('rejects missing %s without contacting the backend', async (name) => {
    vi.stubEnv(name, undefined)
    const response = await POST(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ success: false, error: 'Server configuration error' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    null, 'Bearer token', 'Basic !!!',
    `Basic ${Buffer.from('missing-separator').toString('base64')}`,
    `Basic ${Buffer.from('wrong:test-password').toString('base64')}`,
    `Basic ${Buffer.from('admin:wrong').toString('base64')}`,
    `Basic ${Buffer.from('other:test-password').toString('base64')}`,
  ])('rejects missing or invalid Basic authentication: %s', async (auth) => {
    const response = await POST(request(payload, auth))
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Authentication required')
    expect(response.headers.get('WWW-Authenticate')).toBe('Basic realm="Ingestion Admin"')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns the existing error contract for a backend network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network unavailable'))
    const response = await POST(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ success: false, error: 'Failed to ingest URL' })
  })

  it('aborts the backend request when its timeout signal expires', async () => {
    const controller = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true })
    }))
    const pending = POST(request())
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    controller.abort(new DOMException('Timed out', 'TimeoutError'))
    const response = await pending
    expect(timeout).toHaveBeenCalledWith(30000)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ success: false, error: 'Failed to ingest URL' })
  })

  it('returns the existing error contract when the backend sends invalid JSON', async () => {
    fetchMock.mockResolvedValue(new Response('not JSON', { status: 502 }))
    const response = await POST(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ success: false, error: 'Failed to ingest URL' })
  })
})
