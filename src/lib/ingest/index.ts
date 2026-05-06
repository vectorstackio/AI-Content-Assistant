// lib/ingest/index.js

import config from '../config'

interface FetchResponse {
  success: boolean
  message?: string
  error?: string
}

export async function ingestUrl(url: string, userType: string): Promise<FetchResponse> {
  const response = await fetch(`${config.app.apiUrl}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, userType }),
  })

  const data: FetchResponse = await response.json()
  return data
}