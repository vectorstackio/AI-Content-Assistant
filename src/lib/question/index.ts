// lib/question/index.ts

import config from '../config'
import { FetchResponse } from '@/types'

/**
 * @function ingestUrl
 * Return a response object.
 *
 * @param  {string}     question     The question to ask.
 * @param  {string}     userType     The type of user.
 * @return {object}
 */
export const askQuestion = async (question: string, userType: string = 'pupil'): Promise<FetchResponse> => {
  const response = await fetch(`${config.app.apiUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, userType }),
  })

  //validate({ url, userType })
  const data: FetchResponse = await response.json()
  return data
}