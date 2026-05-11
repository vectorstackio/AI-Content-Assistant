// types/fetch/index.ts

export interface FetchResponse {
  success: boolean
  message?: string
  error?: string
  answer?: string
}

export interface ValidationInput {
  url: string
  userType: string
}