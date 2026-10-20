import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ConversationPiece from '@/components/query/ConversationPiece'

describe('ConversationPiece', () => {
  it('renders the question as plain text and the answer as Markdown', () => {
    render(<ConversationPiece question="**Why?**" answer="This is **important** and *useful*." />)
    expect(screen.getByText('**Why?**')).toBeInTheDocument()
    expect(screen.getByText('important').tagName).toBe('STRONG')
    expect(screen.getByText('useful').tagName).toBe('EM')
  })

  it('renders Markdown links and lists', () => {
    render(<ConversationPiece answer={'[Read more](https://example.com)\n\n- First point\n- Second point'} />)
    expect(screen.getByRole('link', { name: 'Read more' })).toHaveAttribute('href', 'https://example.com')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('First point')).toBeInTheDocument()
    expect(screen.getByText('Second point')).toBeInTheDocument()
  })

  it('supports GitHub-flavoured Markdown tables', () => {
    render(<ConversationPiece answer={'| Topic | Answer |\n| --- | --- |\n| Gravity | Attraction |'} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Topic' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Attraction' })).toBeInTheDocument()
  })

  it('renders the supplied escalation message', () => {
    render(<ConversationPiece question="Can you help?" answer="Please email our support team." type="escalation" />)
    expect(screen.getByText('Can you help?')).toBeInTheDocument()
    expect(screen.getByText('Please email our support team.')).toBeInTheDocument()
  })

  it('renders an answer without a question', () => {
    render(<ConversationPiece answer="Answer only" />)
    expect(screen.getByText('Answer only')).toBeInTheDocument()
    expect(screen.queryByText(/undefined|null/)).not.toBeInTheDocument()
  })

  it('renders a question without an answer', () => {
    render(<ConversationPiece question="Question only" />)
    expect(screen.getByText('Question only')).toBeInTheDocument()
    expect(screen.queryByText('▋')).not.toBeInTheDocument()
  })

  it('renders missing content without placeholder text or a streaming cursor', () => {
    const { container } = render(<ConversationPiece />)
    expect(container.textContent).toBe('')
    expect(screen.queryByText('▋')).not.toBeInTheDocument()
  })

  it('shows the streaming cursor only while streaming', () => {
    const { rerender } = render(<ConversationPiece answer="Partial answer" isStreaming />)
    expect(screen.getByText('▋')).toBeInTheDocument()
    rerender(<ConversationPiece answer="Complete answer" />)
    expect(screen.getByText('Complete answer')).toBeInTheDocument()
    expect(screen.queryByText('▋')).not.toBeInTheDocument()
  })
})
