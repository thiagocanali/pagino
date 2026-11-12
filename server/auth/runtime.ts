import { localMailTransport } from './mail'
import type { H3Event } from 'h3'
import { createAuthentication, AccessError, type Authentication } from './service'
import { apiError } from '../utils/api-error'

let runtime: Promise<Authentication> | undefined
export function getAuthentication(event: H3Event) {
  if (!runtime) {
    const config = useRuntimeConfig(event)
    runtime = createAuthentication({ authSecret: config.authSecret, authBaseUrl: config.authBaseUrl, authDatabaseUrl: config.authDatabaseUrl, domainDatabaseUrl: config.domainDatabaseUrl }, localMailTransport(config.authBaseUrl, config.authMailUrl, config.authMailSecret))
      .catch(() => { runtime = undefined; throw unavailable(event) })
  }
  return runtime
}
function unavailable(event: H3Event) {
  return apiError(503, { code: 'SERVICE_UNAVAILABLE', message: 'O acesso ainda não está conectado neste ambiente. Tente novamente mais tarde.', requestId: String(event.context.requestId) })
}
export async function protectedOperation<T>(event: H3Event, operation: (auth: Authentication) => Promise<T>) {
  try { return await operation(await getAuthentication(event)) }
  catch (error) {
    if (error instanceof AccessError) {
      const messages = { 401: 'Entre para continuar.', 403: 'Você não tem permissão para esta ação.', 404: 'Recurso não encontrado.' } as const
      const status = error.status as keyof typeof messages
      throw apiError(status, { code: status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'NOT_FOUND', message: messages[status], requestId: String(event.context.requestId) })
    }
    throw unavailable(event)
  }
}
export async function closeAuthentication() {
  const current = runtime
  runtime = undefined
  if (current) { try { await (await current).close() } catch { /* Failed initialization already closes its clients. */ } }
}
