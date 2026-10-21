// app/api/query/history/route.ts

import { NextResponse } from 'next/server'

import config from '@/lib/common/config'

export const runtime = 'nodejs'

export async function GET() {
  const apiKey = process.env.INGEST_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'Server configuration error' },
      { status: 500 }
    )
  }

  try {
    const response = await fetch(
      `${config.app.apiUrl}/api/query/12345`,
      {
        headers: {
          'x-api-key': apiKey,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      }
    )

    const data = await response.json()

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('History proxy error:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to retrieve history' },
      { status: 502 }
    )
  }
}
