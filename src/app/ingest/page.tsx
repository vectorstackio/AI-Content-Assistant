// src/app/ingest/page.tsx

'use client'

import { useState } from 'react'

import { ingestUrl } from '@/lib/ingest'

export default function IngestPage() {
  const [url, setUrl] = useState('')
  const [userType, setUserType] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('Test message')
  const [messageClasses, setMessageClasses] = useState('text-green-500')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const response = await ingestUrl(url, userType)
    const msg = response.success
      ? response.message
      : response.error

    setMessage(msg || '')
    setMessageClasses(response.success ? 'text-green-500' : 'text-red-500')

    setLoading(false)
    setUrl('')
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
            placeholder="https://example.com"
            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />

          <select
            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={userType}
            onChange={(e) => setUserType(e.target.value)}
          >
            <option value=""> - Select user type - </option>
            <option value="pupil">Student</option>
            <option value="teacher">Teacher</option>
            <option value="tutor">Tutor</option>
          </select>

          <div className={messageClasses}>{message}</div>

          <button
            disabled={loading}
            type="submit"
            className="bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          >
            {loading ? 'Ingesting...' : 'Add Content'}
          </button>
        </form>
      </div>
    </main>
  )
}