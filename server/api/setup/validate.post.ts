import { defineEventHandler, readRawBody, getHeader, getRequestURL } from 'h3'
import { validateInstitution } from '#shared/schemas/institution'
import { apiError } from '../../utils/api-error'

// Stateless validation only: no provisioning, database, authentication or persistence.
export default defineEventHandler(async (event) => {
  const requestId = String(event.context.requestId)
  const origin = getHeader(event, 'origin')
  if (origin && origin !== getRequestURL(event).origin) {
    throw apiError(403, { code: 'INVALID_REQUEST', message: 'Origem não permitida.', requestId })
  }
  if (getHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    throw apiError(415, { code: 'INVALID_REQUEST', message: 'Envie um corpo JSON.', requestId })
  }
  const rejectSize = () => apiError(413, { code: 'INVALID_REQUEST', message: 'Os dados enviados excedem o limite.', requestId })
  if (Number(getHeader(event, 'content-length')) > 8192) throw rejectSize()
  const raw = await readRawBody(event, false)
  if (raw && raw.byteLength > 8192) throw rejectSize()
  let body: unknown
  try { body = JSON.parse(raw?.toString('utf8') ?? '') }
  catch {
    throw apiError(400, { code: 'INVALID_REQUEST', message: 'Não foi possível ler os dados enviados.', requestId })
  }
  const result = validateInstitution(body)
  if (!result.success) {
    throw apiError(422, { code: 'VALIDATION_ERROR', message: 'Revise os campos indicados.', fields: result.fields, requestId })
  }
  return { valid: true, persisted: false, data: result.data }
})
