export interface HealthResponse {
  status: 'ok'
  service: 'pagino'
}

export interface ApiErrorData {
  code: 'VALIDATION_ERROR' | 'INVALID_REQUEST' | 'INTERNAL_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'SERVICE_UNAVAILABLE'
  message: string
  fields?: Record<string, string>
  requestId: string
}

export interface SessionUser { id: string; name: string; email: string }
export interface InstitutionSummary { id: string; name: string; slug: string; role: 'owner' | 'admin' | 'editor' | 'viewer' }
