import { useState, type ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import IngestForm from '@/components/ingest/IngestForm'

const defaultProps: ComponentProps<typeof IngestForm> = {
  url: 'https://example.com',
  userType: 'pupil',
  loading: false,
  feedback: null,
  onChange: () => {},
  onSubmit: () => {},
}

function ControlledForm() {
  const [url, setUrl] = useState('')
  const [userType, setUserType] = useState('')
  return (
    <IngestForm
      {...defaultProps}
      url={url}
      userType={userType}
      onChange={({ target }) => {
        if (target.name === 'url') setUrl(target.value)
        if (target.name === 'userType') setUserType(target.value)
      }}
    />
  )
}

describe('IngestForm', () => {
  it('associates accessible labels with the URL and user type fields', async () => {
    const user = userEvent.setup()
    render(<IngestForm {...defaultProps} />)
    expect(screen.getByLabelText('URL')).toBe(screen.getByRole('textbox', { name: 'URL' }))
    expect(screen.getByLabelText('User type')).toBe(screen.getByRole('combobox', { name: 'User type' }))
    expect(screen.getByRole('option', { name: 'Student' })).toHaveValue('pupil')
    expect(screen.getByRole('option', { name: 'Teacher' })).toHaveValue('teacher')
    expect(screen.getByRole('option', { name: 'Tutor' })).toHaveValue('tutor')
    await user.tab()
    expect(screen.getByLabelText('URL')).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText('User type')).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Add Content' })).toHaveFocus()
  })

  it('lets a parent update the URL and selected user type', async () => {
    const user = userEvent.setup()
    render(<ControlledForm />)
    await user.type(screen.getByRole('textbox', { name: 'URL' }), 'https://example.com/article')
    await user.selectOptions(screen.getByRole('combobox', { name: 'User type' }), 'teacher')
    expect(screen.getByLabelText('URL')).toHaveValue('https://example.com/article')
    expect(screen.getByLabelText('User type')).toHaveValue('teacher')
    expect(screen.getByRole('button', { name: 'Add Content' })).toBeEnabled()
  })

  it.each([
    { url: '', userType: '' },
    { url: '', userType: 'pupil' },
    { url: '   ', userType: 'pupil' },
    { url: 'https://example.com', userType: '' },
  ])('disables submission with URL "$url" and user type "$userType"', async (fields) => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<IngestForm {...defaultProps} {...fields} onSubmit={onSubmit} />)
    const button = screen.getByRole('button', { name: 'Add Content' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('enables submission when both fields are populated', () => {
    render(<IngestForm {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Add Content' })).toBeEnabled()
  })

  it('shows loading and prevents button submission until loading ends', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const { rerender } = render(<IngestForm {...defaultProps} loading onSubmit={onSubmit} />)
    const button = screen.getByRole('button', { name: 'Ingesting...' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onSubmit).not.toHaveBeenCalled()
    rerender(<IngestForm {...defaultProps} onSubmit={onSubmit} />)
    expect(screen.getByRole('button', { name: 'Add Content' })).toBeEnabled()
  })

  it('announces success feedback as a status', () => {
    render(<IngestForm {...defaultProps} feedback={{ type: 'success', message: 'Content added' }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Content added')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('announces error feedback as an alert', () => {
    render(<IngestForm {...defaultProps} feedback={{ type: 'error', message: 'Ingestion failed' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Ingestion failed')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each([null, { type: 'success' as const, message: '' }])('does not render empty feedback: %j', (feedback) => {
    render(<IngestForm {...defaultProps} feedback={feedback} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('submits through the supplied callback', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(<IngestForm {...defaultProps} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Add Content' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
