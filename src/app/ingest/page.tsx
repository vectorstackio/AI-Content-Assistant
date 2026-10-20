// src/app/ingest/page.tsx

'use client'

import { useRef, useState } from 'react'

import IngestForm, { type IngestFeedback } from '@/components/ingest/IngestForm'
import { ingestUrl } from '@/lib/ingest'
import { ValidationError } from '@/lib/common/error'

export default function IngestPage() {
  const [url, setUrl] = useState('')
  const [userType, setUserType] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<IngestFeedback | null>(null)
  const submittingRef = useRef(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    if (name === 'url') setUrl(value)
    if (name === 'userType') setUserType(value)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submittingRef.current) return
    const trimmedUrl = url.trim()
    setFeedback(null)

    try {
      if (!trimmedUrl) throw new ValidationError('URL is required')
      // Preserve support for www URLs; only the trimmed input is sent to the API.
      let parsedUrl: URL

      try {
        parsedUrl = new URL(/^www\./i.test(trimmedUrl) ? `https://${trimmedUrl}` : trimmedUrl)
      } catch {
        throw new ValidationError('Please enter a valid URL')
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol) || /\s/.test(trimmedUrl)) {
        throw new ValidationError('Please enter a valid URL')
      }

      if (!userType) throw new ValidationError('User type is required')
      submittingRef.current = true
      setLoading(true)
      const response = await ingestUrl(trimmedUrl, userType)

      setFeedback({
        type: response.success ? 'success' : 'error',
        message: (response.success ? response.message : response.error) || '',
      })

      if (response.success) {
        setUrl('')
        setUserType('')
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof ValidationError ? err.message : 'An unexpected error occurred',
      })
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Submit a URL
        </h1>

        <IngestForm
          url={url}
          userType={userType}
          loading={loading}
          feedback={feedback}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
      </div>
    </main>
  )
}
