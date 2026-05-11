// lib/query/index.ts

import config from '@/lib/common/config'
//import { FetchResponse } from '@/types'

/**
 * @function ingestUrl
 * Return a response object.
 *
 * @param  {string}     question     The question to ask.
 * @param  {string}     userType     The type of user.
 * @return {object}
 */
export const askQuestion = async (
  question: string,
  onChunk: (chunk: string) => void,
  userType: string = 'pupil'
): Promise<void> => {
  const response = await fetch(`${config.app.apiUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, userType }),
  })

  if (!response.body) {
    throw new Error('No response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    onChunk(chunk)
  }
}
// export const askQuestion = async (question: string, userType: string = 'pupil'): Promise<FetchResponse> => {
//   const response = await fetch(`${config.app.apiUrl}/api/query`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ question, userType }),
//   })

//   //validate({ url, userType })
//   const data: FetchResponse = await response.json()
//   return data
// }