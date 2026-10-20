import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Home from '@/app/page'
import { askQuestion, getConversationHistory } from '@/lib/query'
import { ValidationError } from '@/lib/common/error'

vi.mock('@/lib/query', () => ({
  askQuestion: vi.fn(),
  getConversationHistory: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')

beforeAll(() => {
  // jsdom has no layout or scrolling implementation.
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})

afterAll(() => {
  if (scrollDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollDescriptor)
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  }
})

beforeEach(() => {
  vi.mocked(getConversationHistory).mockReset()
  vi.mocked(getConversationHistory).mockResolvedValue({ success: true, pieces: [] })
  vi.mocked(askQuestion).mockReset()
  vi.mocked(askQuestion).mockImplementation(async (_question, onChunk) => {
    onChunk('A completed answer')
    return { status: 'normal' }
  })
})

describe('Home application logic', () => {
  it('loads existing history and appends a new exchange without losing earlier messages', async () => {
    vi.mocked(getConversationHistory).mockResolvedValue({
      success: true, pieces: [{ question: 'Earlier question', answer: 'Earlier answer' }],
    })
    const user = userEvent.setup()
    render(<Home />)
    expect(await screen.findByText('Earlier answer')).toBeInTheDocument()
    expect(screen.getByText('Earlier question')).toBeInTheDocument()
    expect(getConversationHistory).toHaveBeenCalledWith('12345')
    await user.type(screen.getByRole('textbox'), 'Next question')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText('A completed answer')).toBeInTheDocument()
    expect(screen.getByText('Earlier answer')).toBeInTheDocument()
    expect(screen.getByText('Next question')).toBeInTheDocument()
  })

  it('shows a history loading error and still allows a new question', async () => {
    vi.mocked(getConversationHistory).mockRejectedValue(new Error('History unavailable'))
    const user = userEvent.setup()
    render(<Home />)
    expect(await screen.findByText('Unable to load conversation history')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox'), 'New question')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText('A completed answer')).toBeInTheDocument()
    expect(screen.queryByText('Unable to load conversation history')).not.toBeInTheDocument()
  })

  it('trims a successful question, clears the input, and permits another question', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.type(screen.getByRole('textbox'), '  What is gravity?  ')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText('A completed answer')).toBeInTheDocument()
    expect(askQuestion).toHaveBeenCalledWith('What is gravity?', expect.any(Function), 'pupil', '12345')
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled()
    expect(screen.queryByText('▋')).not.toBeInTheDocument()
    await user.type(screen.getByRole('textbox'), 'Another question')
    expect(screen.getByRole('button', { name: 'Ask' })).toBeEnabled()
  })

  it('shows incremental streamed text and replaces it with one completed exchange', async () => {
    const pending = deferred<Awaited<ReturnType<typeof askQuestion>>>()
    let deliverChunk!: (chunk: string) => void
    vi.mocked(askQuestion).mockImplementation((_question, onChunk) => {
      deliverChunk = onChunk
      return pending.promise
    })
    const user = userEvent.setup()
    render(<Home />)
    await user.type(screen.getByRole('textbox'), 'Explain gravity')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(screen.getByRole('button', { name: 'Thinking...' })).toBeDisabled()
    expect(screen.getByText('Explain gravity', { selector: 'div' })).toBeInTheDocument()
    expect(screen.getByText('▋')).toBeInTheDocument()
    act(() => deliverChunk('Gravity is'))
    expect(screen.getByText('Gravity is')).toBeInTheDocument()
    act(() => deliverChunk(' an attraction.'))
    expect(screen.getByText('Gravity is an attraction.')).toBeInTheDocument()
    await act(async () => pending.resolve({ status: 'normal' }))
    expect(screen.getAllByText('Gravity is an attraction.')).toHaveLength(1)
    expect(screen.getAllByText('Explain gravity')).toHaveLength(1)
    expect(screen.queryByText('▋')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('replaces an unknown answer with the escalation message', async () => {
    vi.mocked(askQuestion).mockImplementation(async (_question, onChunk) => {
      onChunk('Uncertain draft')
      return { status: 'unknown' }
    })
    const user = userEvent.setup()
    render(<Home />)
    await user.type(screen.getByRole('textbox'), 'Difficult question')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText(/I couldn't find a confident answer/)).toBeInTheDocument()
    expect(screen.queryByText('Uncertain draft')).not.toBeInTheDocument()
    expect(screen.getAllByText('Difficult question')).toHaveLength(1)
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.queryByText('▋')).not.toBeInTheDocument()
  })

  it('treats a missing AI status as a normal answer', async () => {
    vi.mocked(askQuestion).mockImplementation(async (_question, onChunk) => {
      onChunk('Answer without a status')
      return { status: null }
    })
    const user = userEvent.setup()
    render(<Home />)
    await user.type(screen.getByRole('textbox'), 'Question{Enter}')
    expect(await screen.findByText('Answer without a status')).toBeInTheDocument()
    expect(screen.queryByText(/confident answer/)).not.toBeInTheDocument()
  })

  it.each(['', '   '])('rejects an empty or whitespace-only question %j on Enter', async (question) => {
    const user = userEvent.setup()
    render(<Home />)
    await user.click(screen.getByRole('textbox'))
    if (question) await user.type(screen.getByRole('textbox'), question)
    await user.keyboard('{Enter}')
    expect(screen.getByText('Please enter a question')).toBeInTheDocument()
    expect(askQuestion).not.toHaveBeenCalled()
    expect(screen.queryByText('▋')).not.toBeInTheDocument()
  })

  it('allows the user to correct an overlength question and submit successfully', async () => {
    const user = userEvent.setup()
    render(<Home />)
    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.paste('a'.repeat(501))
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(screen.getByText('Question is too long')).toBeInTheDocument()
    expect(askQuestion).not.toHaveBeenCalled()
    await user.clear(input)
    await user.type(input, 'A shorter question')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText('A completed answer')).toBeInTheDocument()
    expect(screen.queryByText('Question is too long')).not.toBeInTheDocument()
  })

  it.each([
    { name: 'HTTP failure', error: new Error('Request failed: 500'), visible: 'An unexpected error occurred' },
    { name: 'network failure', error: new TypeError('Failed to fetch'), visible: 'An unexpected error occurred' },
    { name: 'validation failure', error: new ValidationError('Question is not allowed'), visible: 'Question is not allowed' },
  ])('restores the form after a $name and supports retry', async ({ error, visible }) => {
    vi.mocked(askQuestion).mockRejectedValueOnce(error)
    const user = userEvent.setup()
    render(<Home />)
    await user.type(screen.getByRole('textbox'), 'Retry this question')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText(visible)).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('Retry this question')
    expect(screen.getByRole('button', { name: 'Ask' })).toBeEnabled()
    expect(screen.queryByText('▋')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText('A completed answer')).toBeInTheDocument()
    expect(screen.queryByText(visible)).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('removes an interrupted partial answer and starts the retry with fresh streamed content', async () => {
    const pending = deferred<Awaited<ReturnType<typeof askQuestion>>>()
    let deliverChunk!: (chunk: string) => void
    vi.mocked(askQuestion).mockImplementationOnce((_question, onChunk) => {
      deliverChunk = onChunk
      return pending.promise
    })
    const user = userEvent.setup()
    render(<Home />)
    await user.type(screen.getByRole('textbox'), 'Explain')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    act(() => deliverChunk('Interrupted draft'))
    expect(screen.getByText('Interrupted draft')).toBeInTheDocument()
    await act(async () => pending.reject(new TypeError('Connection lost')))
    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
    expect(screen.queryByText('Interrupted draft')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText('A completed answer')).toBeInTheDocument()
    expect(screen.queryByText(/Interrupted draft/)).not.toBeInTheDocument()
  })

  it('prevents button and repeated Enter submissions while a request is pending', async () => {
    const pending = deferred<Awaited<ReturnType<typeof askQuestion>>>()
    vi.mocked(askQuestion).mockReturnValue(pending.promise)
    const user = userEvent.setup()
    render(<Home />)
    await user.type(screen.getByRole('textbox'), 'One question{Enter}')
    const button = screen.getByRole('button', { name: 'Thinking...' })
    expect(button).toBeDisabled()
    await user.click(button)
    await user.click(screen.getByRole('textbox'))
    await user.keyboard('{Enter}{Enter}')
    expect(askQuestion).toHaveBeenCalledTimes(1)
    await act(async () => pending.resolve({ status: 'normal' }))
    expect(screen.getAllByText('One question')).toHaveLength(1)
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('does not submit Enter while an input method is composing text', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.type(screen.getByRole('textbox'), 'Composing question')
    // userEvent does not model an IME session's isComposing flag.
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', isComposing: true })
    expect(askQuestion).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveValue('Composing question')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''))
  })
})
