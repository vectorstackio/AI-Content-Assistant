import { useState, type ComponentProps } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QuestionForm from '@/components/query/QuestionForm'
import Home from '@/app/page'
import { askQuestion, getConversationHistory } from '@/lib/query'

vi.mock('@/lib/query', () => ({
  askQuestion: vi.fn(),
  getConversationHistory: vi.fn(),
}))

const defaultProps: ComponentProps<typeof QuestionForm> = {
  currentQuestion: 'What is gravity?',
  placeholder: 'Ask anything...',
  message: '',
  messageClasses: 'text-red-500',
  buttonDisabled: false,
  loading: false,
  isStreaming: false,
  textareaRef: null,
  onSubmit: () => {},
  onChange: () => {},
  onKeyDown: () => {},
}

function ControlledForm() {
  const [question, setQuestion] = useState('')
  return (
    <QuestionForm
      {...defaultProps}
      currentQuestion={question}
      onChange={(event) => setQuestion(event.target.value)}
    />
  )
}

describe('QuestionForm', () => {
  it('displays the supplied question and placeholder', () => {
    render(<QuestionForm {...defaultProps} />)
    expect(screen.getByRole('textbox')).toHaveValue('What is gravity?')
    expect(screen.getByPlaceholderText('Ask anything...')).toBeInTheDocument()
  })

  it('allows the parent to update the question as the user types', async () => {
    const user = userEvent.setup()
    render(<ControlledForm />)
    await user.type(screen.getByRole('textbox'), 'Why is the sky blue?')
    expect(screen.getByRole('textbox')).toHaveValue('Why is the sky blue?')
  })

  it('submits through the supplied handler when Ask is clicked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(<QuestionForm {...defaultProps} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it.each([
    { buttonDisabled: true, loading: false, isStreaming: false, label: 'Ask' },
    { buttonDisabled: false, loading: true, isStreaming: false, label: 'Thinking...' },
    { buttonDisabled: false, loading: false, isStreaming: true, label: 'Ask' },
  ])('disables submission for $label with flags $buttonDisabled/$loading/$isStreaming', async (flags) => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<QuestionForm {...defaultProps} {...flags} onSubmit={onSubmit} />)
    const button = screen.getByRole('button', { name: flags.label })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows a supplied validation message and removes it when cleared', () => {
    const { rerender } = render(<QuestionForm {...defaultProps} message="Please enter a question" />)
    expect(screen.getByText('Please enter a question')).toBeInTheDocument()
    rerender(<QuestionForm {...defaultProps} message="" />)
    expect(screen.queryByText('Please enter a question')).not.toBeInTheDocument()
  })
})

// Keyboard submission and validation belong to Home, not the presentational form.
describe('QuestionForm with the real page handlers', () => {
  beforeEach(() => {
    vi.mocked(getConversationHistory).mockReset()
    vi.mocked(getConversationHistory).mockResolvedValue({ success: true, pieces: [] })
    vi.mocked(askQuestion).mockReset()
    vi.mocked(askQuestion).mockRejectedValue(new Error('Service unavailable'))
  })

  it('submits on Enter without inserting a newline', async () => {
    const user = userEvent.setup()
    render(<Home />)
    const input = screen.getByRole('textbox')
    await user.type(input, 'What is gravity?{Enter}')
    await waitFor(() => expect(askQuestion).toHaveBeenCalledTimes(1))
    expect(askQuestion).toHaveBeenCalledWith('What is gravity?', expect.any(Function), 'pupil', '12345')
    expect(input).toHaveValue('What is gravity?')
    expect(await screen.findByText('An unexpected error occurred')).toBeInTheDocument()
  })

  it('inserts a newline with Shift+Enter without submitting', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.type(screen.getByRole('textbox'), 'First line')
    await user.keyboard('{Shift>}{Enter}{/Shift}Second line')
    expect(screen.getByRole('textbox')).toHaveValue('First line\nSecond line')
    expect(askQuestion).not.toHaveBeenCalled()
  })

  it('rejects whitespace-only questions without calling the API', async () => {
    const user = userEvent.setup()
    render(<Home />)
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled()
    await user.type(screen.getByRole('textbox'), '   ')
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(screen.getByText('Please enter a question')).toBeInTheDocument()
    expect(askQuestion).not.toHaveBeenCalled()
  })

  it('rejects questions longer than 500 characters', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.click(screen.getByRole('textbox'))
    await user.paste('a'.repeat(501))
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(screen.getByText('Question is too long')).toBeInTheDocument()
    expect(askQuestion).not.toHaveBeenCalled()
  })

  it('accepts a question of exactly 500 characters', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.click(screen.getByRole('textbox'))
    await user.paste('a'.repeat(500))
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(askQuestion).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Question is too long')).not.toBeInTheDocument()
    expect(await screen.findByText('An unexpected error occurred')).toBeInTheDocument()
  })
})
