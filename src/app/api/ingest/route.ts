// src/app/api/ingest/route.ts

import { timingSafeEqual } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import config from '@/lib/common/config'

export const runtime = 'nodejs'

const isValidCredential = (actual: string, expected: string) => {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  )
}

const unauthorized = () =>
  new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Ingestion Admin"',
      'Cache-Control': 'no-store',
    },
  })

export const POST = async (request: NextRequest) => {
  const username = process.env.INGEST_ADMIN_USER
  const password = process.env.INGEST_ADMIN_PASSWORD
  const apiKey = process.env.INGEST_API_KEY

  if (!username || !password || !apiKey) {
    // Keep server-side diagnostics for configuration and upstream failures.
    // eslint-disable-next-line no-console
    console.error('Ingestion authentication is not configured')

    return NextResponse.json(
      { success: false, error: 'Server configuration error' },
      { status: 500 }
    )
  }

  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Basic ')) {
    return unauthorized()
  }

  let credentials: string

  try {
    credentials = Buffer.from(
      authorization.slice(6),
      'base64'
    ).toString('utf8')
  } catch {
    return unauthorized()
  }

  const separator = credentials.indexOf(':')

  if (separator === -1) {
    return unauthorized()
  }

  const suppliedUsername = credentials.slice(0, separator)
  const suppliedPassword = credentials.slice(separator + 1)

  if (
    !isValidCredential(suppliedUsername, username) ||
    !isValidCredential(suppliedPassword, password)
  ) {
    return unauthorized()
  }

  try {
    const { url, userType } = await request.json()

    const response = await fetch(`${config.app.apiUrl}/api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ url, userType }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })

    const data = await response.json()

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    // Keep server-side diagnostics for configuration and upstream failures.
    // eslint-disable-next-line no-console
    console.error('Ingestion proxy error:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to ingest URL' },
      { status: 500 }
    )
  }
}

// // app/api/ingest/route.ts

// import { NextRequest, NextResponse } from 'next/server'

// import config from '@/lib/common/config'

// export const runtime = 'nodejs'

// export const POST = async (request: NextRequest) => {
//   try {
//     const apiKey = process.env.INGEST_API_KEY

//     if (!apiKey) {
//       //console.error('INGEST_API_KEY is not configured')

//       return NextResponse.json(
//         { success: false, error: 'Server configuration error' },
//         { status: 500 }
//       )
//     }

//     const { url, userType } = await request.json()

//     const response = await fetch(`${config.app.apiUrl}/api/ingest`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'x-api-key': apiKey,
//       },
//       body: JSON.stringify({ url, userType }),
//       cache: 'no-store',
//       signal: AbortSignal.timeout(30000),
//     })

//     const data = await response.json()

//     return NextResponse.json(data, {
//       status: response.status,
//     })
//   } catch (error) {
//     console.error('Ingestion proxy error:', error)

//     return NextResponse.json(
//       { success: false, error: 'Failed to ingest URL' },
//       { status: 500 }
//     )
//   }
// }