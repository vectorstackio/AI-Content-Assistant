import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Conversation from '@/components/query/Conversation'

describe('Conversation', () => {
  it('shows the initial heading for an empty conversation', () => {
    render(<Conversation pieces={[]} bottomRef={null} />)
    expect(screen.getByRole('heading', { name: 'Ask a Question', level: 1 })).toBeInTheDocument()
  })

  it('renders multiple question-answer pairs in conversation order', () => {
    render(<Conversation pieces={[
      { question: 'First question', answer: 'First answer' },
      { question: 'Second question', answer: 'Second answer' },
    ]} bottomRef={null} />)
    expect(screen.queryByRole('heading', { name: 'Ask a Question' })).not.toBeInTheDocument()
    const messages = screen.getAllByText(/^(First|Second) (question|answer)$/)
    expect(messages.map((message) => message.textContent)).toEqual([
      'First question', 'First answer', 'Second question', 'Second answer',
    ])
  })

  it('updates from empty to populated history and back', () => {
    const { rerender } = render(<Conversation pieces={[]} bottomRef={null} />)
    rerender(<Conversation pieces={[{ question: 'Why?', answer: 'Because.' }]} bottomRef={null} />)
    expect(screen.getByText('Why?')).toBeInTheDocument()
    expect(screen.getByText('Because.')).toBeInTheDocument()
    rerender(<Conversation pieces={[]} bottomRef={null} />)
    expect(screen.queryByText('Because.')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ask a Question' })).toBeInTheDocument()
  })
})
