import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IngestPage from '@/app/ingest/page'
import { ingestUrl } from '@/lib/ingest'
import { ValidationError } from '@/lib/common/error'

vi.mock('@/lib/ingest', () => ({ ingestUrl: vi.fn() }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function fillForm(user: ReturnType<typeof userEvent.setup>, url = 'https://example.com', userType = 'pupil') {
  await user.type(screen.getByRole('textbox', { name: 'URL' }), url)
  await user.selectOptions(screen.getByRole('combobox', { name: 'User type' }), userType)
}

beforeEach(() => {
  vi.mocked(ingestUrl).mockReset()
  vi.mocked(ingestUrl).mockResolvedValue({ success: true, message: 'Content added' })
})

describe('IngestPage', () => {
  it('shows success, trims the submitted URL, clears both fields, and allows another ingestion', async () => {
    const user = userEvent.setup()
    render(<IngestPage />)
    await fillForm(user, '  https://example.com/article  ')
    await user.click(screen.getByRole('button', { name: 'Add Content' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Content added')
    expect(ingestUrl).toHaveBeenCalledWith('https://example.com/article', 'pupil')
    expect(screen.getByLabelText('URL')).toHaveValue('')
    expect(screen.getByLabelText('User type')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Add Content' })).toBeDisabled()
    await fillForm(user, 'https://example.com/next', 'teacher')
    await user.click(screen.getByRole('button', { name: 'Add Content' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Content added')
    expect(ingestUrl).toHaveBeenCalledTimes(2)
  })

  it.each(['pupil', 'teacher', 'tutor'])('passes the selected %s user type', async (userType) => {
    const user = userEvent.setup()
    render(<IngestPage />)
    await fillForm(user, 'https://example.com', userType)
    await user.click(screen.getByRole('button', { name: 'Add Content' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Content added')
    expect(ingestUrl).toHaveBeenCalledExactlyOnceWith('https://example.com', userType)
  })

  it('shows an unsuccessful response, preserves fields, and allows retry', async () => {
    vi.mocked(ingestUrl).mockResolvedValueOnce({ success: false, error: 'Unable to ingest content' })
    const user = userEvent.setup()
    render(<IngestPage />)
    await fillForm(user, 'https://example.com', 'teacher')
    await user.click(screen.getByRole('button', { name: 'Add Content' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to ingest content')
    expect(screen.getByLabelText('URL')).toHaveValue('https://example.com')
    expect(screen.getByLabelText('User type')).toHaveValue('teacher')
    expect(screen.getByRole('button', { name: 'Add Content' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Add Content' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Content added')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('URL')).toHaveValue('')
  })

  it.each([
    { error: new ValidationError('This URL is not supported'), message: 'This URL is not supported' },
    { error: new TypeError('Network failed'), message: 'An unexpected error occurred' },
  ])('restores the form after an exception: $message', async ({ error, message }) => {
    vi.mocked(ingestUrl).mockRejectedValueOnce(error)
    const user = userEvent.setup()
    render(<IngestPage />)
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Add Content' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText('URL')).toHaveValue('https://example.com')
    expect(screen.getByLabelText('User type')).toHaveValue('pupil')
    expect(screen.getByRole('button', { name: 'Add Content' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Add Content' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Content added')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows pending feedback, blocks duplicate submissions, and clears stale errors', async () => {
    const pending = deferred<Awaited<ReturnType<typeof ingestUrl>>>()
    vi.mocked(ingestUrl)
      .mockResolvedValueOnce({ success: false, error: 'Previous error' })
      .mockReturnValueOnce(pending.promise)
    const user = userEvent.setup()
    render(<IngestPage />)
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Add Content' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Previous error')
    await user.click(screen.getByRole('button', { name: 'Add Content' }))
    expect(screen.getByRole('button', { name: 'Ingesting...' })).toBeDisabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ingesting...' }))
    await user.click(screen.getByLabelText('URL'))
    await user.keyboard('{Enter}{Enter}')
    // Also exercise the handler guard against programmatic submissions that bypass the disabled button.
    fireEvent.submit(screen.getByLabelText('URL').closest('form')!)
    expect(ingestUrl).toHaveBeenCalledTimes(2)
    await act(async () => pending.resolve({ success: true, message: 'Retry complete' }))
    expect(screen.getByRole('status')).toHaveTextContent('Retry complete')
    expect(screen.queryByRole('button', { name: 'Ingesting...' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('URL')).toHaveValue('')
  })

  it('restores the form after a pending request rejects', async () => {
    const pending = deferred<Awaited<ReturnType<typeof ingestUrl>>>()
    vi.mocked(ingestUrl).mockReturnValueOnce(pending.promise)
    const user = userEvent.setup()
    render(<IngestPage />)
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Add Content' }))
    expect(screen.getByRole('button', { name: 'Ingesting...' })).toBeDisabled()
    await act(async () => pending.reject(new Error('Offline')))
    expect(screen.getByRole('alert')).toHaveTextContent('An unexpected error occurred')
    expect(screen.getByRole('button', { name: 'Add Content' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Add Content' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Content added')
  })

  it.each(['', '   '])('blocks empty URL %j and validates it if the form is submitted directly', async (url) => {
    const user = userEvent.setup()
    render(<IngestPage />)
    if (url) await user.type(screen.getByLabelText('URL'), url)
    await user.selectOptions(screen.getByLabelText('User type'), 'pupil')
    expect(screen.getByRole('button', { name: 'Add Content' })).toBeDisabled()
    // Native button submission is blocked; direct submission checks the page's defensive validation.
    fireEvent.submit(screen.getByLabelText('URL').closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('URL is required')
    expect(ingestUrl).not.toHaveBeenCalled()
  })

  it('validates a missing user type if submission bypasses the disabled button', async () => {
    const user = userEvent.setup()
    render(<IngestPage />)
    await user.type(screen.getByLabelText('URL'), 'https://example.com')
    expect(screen.getByRole('button', { name: 'Add Content' })).toBeDisabled()
    fireEvent.submit(screen.getByLabelText('URL').closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('User type is required')
    expect(ingestUrl).not.toHaveBeenCalled()
  })

  it.each(['not-a-url', 'example.com', 'ftp://example.com', 'https://example.com/a b'])('rejects an invalid or unsupported URL: %s', async (url) => {
    const user = userEvent.setup()
    render(<IngestPage />)
    await fillForm(user, url)
    await user.click(screen.getByRole('button', { name: 'Add Content' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid URL')
    expect(screen.getByLabelText('URL')).toHaveValue(url)
    expect(screen.getByRole('button', { name: 'Add Content' })).toBeEnabled()
    expect(ingestUrl).not.toHaveBeenCalled()
  })

  it.each(['http://example.com', 'https://example.com', 'www.example.com', 'WWW.example.com', 'https://example.com/a%20b'])('supports URL %s without rewriting it', async (url) => {
    const user = userEvent.setup()
    render(<IngestPage />)
    await fillForm(user, url)
    await user.click(screen.getByRole('button', { name: 'Add Content' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Content added')
    expect(ingestUrl).toHaveBeenCalledExactlyOnceWith(url, 'pupil')
  })

  it.each([true, false])('currently provides no feedback when a response with success=%s has no message', async (success) => {
    vi.mocked(ingestUrl).mockResolvedValue({ success })
    const user = userEvent.setup()
    render(<IngestPage />)
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Add Content' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('URL')).toHaveValue(success ? '' : 'https://example.com')
    expect(screen.getByRole('button', { name: 'Add Content' })).not.toHaveTextContent('Ingesting...')
  })
})
