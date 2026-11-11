import { createError } from 'h3'
import type { ApiErrorData } from '#shared/types/api'

export function apiError(statusCode: number, data: ApiErrorData) {
  return createError({ statusCode, statusMessage: statusCode >= 500 ? 'Internal Server Error' : 'Request Rejected', message: data.message, data })
}
