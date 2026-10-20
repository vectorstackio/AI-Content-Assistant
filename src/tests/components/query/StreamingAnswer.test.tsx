import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StreamingAnswer from '@/components/query/StreamingAnswer'

describe('StreamingAnswer', () => {
  it('displays the current question and partial answer with a cursor', () => {
    render(<StreamingAnswer question="What is gravity?" answer="Gravity is" />)
    expect(screen.getByText('What is gravity?')).toBeInTheDocument()
    expect(screen.getByText('Gravity is')).toBeInTheDocument()
    expect(screen.getByText('▋')).toBeInTheDocument()
  })

  it('displays updated streamed content without duplicating the question or answer', () => {
    const { rerender } = render(<StreamingAnswer question="Why?" answer="The" />)
    rerender(<StreamingAnswer question="Why?" answer="The **reason** is" />)
    expect(screen.getAllByText('Why?')).toHaveLength(1)
    expect(screen.queryByText('The', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByText('reason').tagName).toBe('STRONG')
    expect(screen.getByText('reason').closest('p')).toHaveTextContent('The reason is')
    expect(screen.getAllByText('▋')).toHaveLength(1)
  })

  it('shows the question and cursor while waiting for the first chunk', () => {
    const { container } = render(<StreamingAnswer question="Still thinking?" answer="" />)
    expect(screen.getByText('Still thinking?')).toBeInTheDocument()
    expect(screen.getByText('▋')).toBeInTheDocument()
    expect(container).not.toHaveTextContent(/undefined|null/)
  })
})
