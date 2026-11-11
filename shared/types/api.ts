export interface HealthResponse {
  status: 'ok'
  service: 'pagino'
}

export interface ApiErrorData {
  code: 'VALIDATION_ERROR' | 'INVALID_REQUEST' | 'INTERNAL_ERROR'
  message: string
  fields?: Record<string, string>
  requestId: string
}
