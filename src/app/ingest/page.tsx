// src/app/ingest/page.tsx

'use client'

import { useState } from 'react'

import { ingestUrl } from '@/lib/ingest'
import { ValidationError } from '@/lib/error'

export default function IngestPage() {
  const [url, setUrl] = useState('')
  const [userType, setUserType] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageClasses, setMessageClasses] = useState('text-green-500')
  const buttonDisabled = !url || !userType

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    if (name === 'url') setUrl(value)
    if (name === 'userType') setUserType(value)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      setLoading(true)
      const response = await ingestUrl(url, userType)
      const msg = response.success
        ? response.message
        : response.error

      setMessage(msg || '')
      setMessageClasses(response.success ? 'text-green-500' : 'text-red-500')
      setLoading(false)
      setUrl('')
      setUserType('')
    } catch(err) {
      if (err instanceof ValidationError) {
        setMessage(err.message)
        setMessageClasses('text-red-500')
      }
      else {
        setMessage('An unexpected error occurred')
        setMessageClasses('text-red-500')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Submit a URL
        </h1>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <input
            type="text"
            name="url"
            placeholder="https://example.com"
            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={url}
            onChange={(e) => handleChange(e)}
          />

          <select
            name="userType"
            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={userType}
            onChange={(e) => handleChange(e)}
          >
            <option value=""> - Select user type - </option>
            <option value="pupil">Student</option>
            <option value="teacher">Teacher</option>
            <option value="tutor">Tutor</option>
          </select>

          {message && <div className={messageClasses}>{message}</div>}

          <button
            disabled={buttonDisabled || loading}
            type="submit"
            className={`bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition ${buttonDisabled || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Ingesting...' : 'Add Content'}
          </button>
        </form>
      </div>
    </main>
  )
}