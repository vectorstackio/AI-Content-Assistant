// components/ingest/IngestForm.tsx

import type { ChangeEventHandler, FormEventHandler } from 'react'

export interface IngestFeedback {
  type: 'success' | 'error'
  message: string
}

interface IngestFormProps {
  url: string
  userType: string
  loading: boolean
  feedback: IngestFeedback | null
  onChange: ChangeEventHandler<HTMLInputElement | HTMLSelectElement>
  onSubmit: FormEventHandler<HTMLFormElement>
}

export default function IngestForm({
  url,
  userType,
  loading,
  feedback,
  onChange,
  onSubmit,
}: IngestFormProps) {
  const buttonDisabled = !url.trim() || !userType || loading

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <label htmlFor="ingest-url" className="sr-only">URL</label>
      <input
        id="ingest-url"
        type="text"
        name="url"
        placeholder="https://example.com"
        className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={url}
        onChange={onChange}
      />

      <label htmlFor="ingest-user-type" className="sr-only">User type</label>
      <select
        id="ingest-user-type"
        name="userType"
        className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={userType}
        onChange={onChange}
      >
        <option value=""> - Select user type - </option>
        <option value="pupil">Student</option>
        <option value="teacher">Teacher</option>
        <option value="tutor">Tutor</option>
      </select>

      {feedback?.message && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={feedback.type === 'success' ? 'text-green-500' : 'text-red-500'}
        >
          {feedback.message}
        </div>
      )}

      <button
        disabled={buttonDisabled}
        type="submit"
        className={`bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition ${buttonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {loading ? 'Ingesting...' : 'Add Content'}
      </button>
    </form>
  )
}
