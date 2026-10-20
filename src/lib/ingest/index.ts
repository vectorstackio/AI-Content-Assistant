// lib/ingest/index.js

import config from '@/lib/common/config'
import { ValidationError } from '@/lib/common/error'
import { FetchResponse, ValidationInput } from '@/types'

/**
 * @function ingestUrl
 * Return a response object.
 *
 * @param  {string}     url          The URL to ingest.
 * @param  {string}     userType     The type of user.
 * @return {object}
 */
export const ingestUrl = async (url: string, userType: string): Promise<FetchResponse> => {
  validate({ url, userType })
  const response = await fetch(`${config.app.apiUrl}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, userType }),
  })
  const data: FetchResponse = await response.json()
  return data
}

const validate = (data: ValidationInput) => {
  if (!data.url || ! data.userType) throw new ValidationError('URL is required')
  if (!data.userType) throw new ValidationError('User type is required')
  if (!['pupil', 'teacher', 'tutor'].includes(data.userType)) throw new ValidationError('Please select a valid user type')
  const re: RegExp = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi
  const result: boolean = re.test(String(data.url).toLowerCase())
  if (!result) throw new ValidationError('Please enter a valid URL')
}