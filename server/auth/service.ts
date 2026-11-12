import { createHmac, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { drizzle } from 'drizzle-orm/postgres-js'
import { and, eq, sql } from 'drizzle-orm'
import postgres from 'postgres'
import * as identity from '../db/auth-schema'
import { memberships, institutions, pages, auditLogs } from '../db/schema'
import { createDomainDatabase, withTenant } from '../db/tenant'
import { can, isRole, type Permission } from '../../shared/auth/permissions'
import { loginSchema } from '../../shared/schemas/login'
import type { InstitutionSummary } from '../../shared/types/api'

const configSchema = z.strictObject({
  authSecret: z.string().min(32), authBaseUrl: z.url(), authDatabaseUrl: z.url(), domainDatabaseUrl: z.url(),
})
export type AuthConfig = z.infer<typeof configSchema>
export class AccessError extends Error {
  constructor(public status: number) { super('Access denied') }
}

export async function createAuthentication(input: AuthConfig) {
  const config = configSchema.parse(input)
  const base = new URL(config.authBaseUrl)
  if (base.origin !== config.authBaseUrl || base.username || base.password || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) throw new Error('Invalid authentication origin')
  for (const value of [config.authDatabaseUrl, config.domainDatabaseUrl]) {
    if (!['postgres:', 'postgresql:'].includes(new URL(value).protocol)) throw new Error('Invalid database protocol')
  }
  const identityClient = postgres(config.authDatabaseUrl, { max: 2, prepare: false, connect_timeout: 5, idle_timeout: 20 })
  const domain = createDomainDatabase(config.domainDatabaseUrl)
  const db = drizzle(identityClient, { schema: identity })
  try {
    for (const [client, expected] of [[db, 'auth_runtime'], [domain.db, 'app_runtime']] as const) {
      const query = sql`select current_user as name, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb from pg_roles where rolname = current_user`
      const rows = await client.execute(query)
      const row = rows[0]
      if (!row || row.name !== expected || row.rolsuper || row.rolbypassrls || row.rolcreaterole || row.rolcreatedb) throw new Error('Restricted database role required')
    }
    const auth = betterAuth({
      secret: config.authSecret, baseURL: config.authBaseUrl, trustedOrigins: [config.authBaseUrl],
      database: drizzleAdapter(db, { provider: 'pg', schema: identity }),
      emailAndPassword: { enabled: true, disableSignUp: true, requireEmailVerification: true, minPasswordLength: 12, maxPasswordLength: 128 },
      session: { expiresIn: 60 * 60 * 24 * 7, disableSessionRefresh: true, cookieCache: { enabled: false } },
      rateLimit: { enabled: true, storage: 'database', window: 60, max: 100, customRules: { '/sign-in/email': { window: 60, max: 100 } } },
      advanced: { useSecureCookies: base.protocol === 'https:', crossSubDomainCookies: { enabled: false }, defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' }, ipAddress: { ipAddressHeaders: ['x-pagino-client-ip'] } },
      logger: { disabled: true },
    })
    return { auth, db, domain: domain.db, origin: config.authBaseUrl, secret: config.authSecret, close: async () => { await identityClient.end(); await domain.close() } }
  }
  catch (error) { await identityClient.end(); await domain.close(); throw error }
}
export type Authentication = Awaited<ReturnType<typeof createAuthentication>>

export async function authenticatedUser(runtime: Authentication, headers: Headers) {
  const session = await runtime.auth.api.getSession({ headers, query: { disableCookieCache: true } })
  if (!session) throw new AccessError(401)
  if (!session.user.emailVerified) throw new AccessError(403)
  return { id: session.user.id, name: session.user.name, email: session.user.email }
}

export async function listInstitutions(runtime: Authentication, userId: string): Promise<InstitutionSummary[]> {
  const own = await runtime.domain.transaction(async (tx) => {
    await tx.execute(sql`select set_config('pagino.user_id', ${userId}, true)`)
    return tx.select().from(memberships).where(eq(memberships.userId, userId))
  })
  const result: InstitutionSummary[] = []
  for (const membership of own) {
    const institution = await withTenant(runtime.domain, { institutionId: membership.institutionId, userId }, tx => tx.select().from(institutions).where(eq(institutions.id, membership.institutionId)))
    if (institution[0] && isRole(membership.role)) result.push({ id: institution[0].id, name: institution[0].name, slug: institution[0].slug, role: membership.role })
  }
  return result.sort((a, b) => a.name.localeCompare(b.name))
}

export async function readInstitution(runtime: Authentication, userId: string, institutionId: string, permission: Permission) {
  if (!z.uuid().safeParse(institutionId).success) throw new AccessError(404)
  return withTenant(runtime.domain, { institutionId, userId }, async (tx) => {
    const [institution] = await tx.select().from(institutions).where(eq(institutions.id, institutionId))
    const [membership] = await tx.select().from(memberships).where(and(eq(memberships.institutionId, institutionId), eq(memberships.userId, userId)))
    if (!institution || !membership) throw new AccessError(404)
    if (!can(membership.role, permission)) throw new AccessError(403)
    const data = permission === 'audit.read'
      ? await tx.select().from(auditLogs).where(eq(auditLogs.institutionId, institutionId)).limit(50)
      : await tx.select().from(pages).where(eq(pages.institutionId, institutionId)).limit(20)
    return { institution: { ...institution, role: membership.role }, data }
  })
}

async function consumeLoginAttempt(runtime: Authentication, clientIP: string) {
  const key = 'login:' + createHmac('sha256', runtime.secret).update(clientIP).digest('hex')
  const now = Date.now()
  const reset = sql`${now} - ${identity.rateLimit.lastRequest} >= 60000`
  const [bucket] = await runtime.db.insert(identity.rateLimit).values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({ target: identity.rateLimit.key, set: {
      count: sql`case when ${reset} then 1 else ${identity.rateLimit.count} + 1 end`,
      lastRequest: sql`case when ${reset} then ${now} else ${identity.rateLimit.lastRequest} end`,
    } }).returning({ count: identity.rateLimit.count })
  return Boolean(bucket && bucket.count <= 5)
}

function json(status: number, message: string) {
  return Response.json({ message }, { status, headers: { 'cache-control': 'no-store' } })
}
export async function handleAuthentication(runtime: Authentication, request: Request, clientIP: string) {
  const path = new URL(request.url).pathname
  if (!['/api/auth/sign-in/email', '/api/auth/sign-out'].includes(path)) return json(404, 'Rota não encontrada.')
  if (request.method !== 'POST') return json(405, 'Método não permitido.')
  if (request.headers.get('origin') !== runtime.origin) return json(403, 'Origem não permitida.')
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') return json(415, 'Envie um corpo JSON.')
  if (Number(request.headers.get('content-length')) > 8192) return json(413, 'Dados acima do limite.')
  const raw = await request.text()
  if (Buffer.byteLength(raw) > 8192) return json(413, 'Dados acima do limite.')
  let body: unknown
  try { body = JSON.parse(raw) } catch { return json(400, 'JSON inválido.') }
  const headers = new Headers(request.headers)
  headers.delete('content-length')
  headers.set('x-pagino-client-ip', clientIP)
  if (path.endsWith('/sign-in/email')) {
    if (!await consumeLoginAttempt(runtime, clientIP)) {
      const response = json(429, 'Muitas tentativas. Aguarde um minuto antes de tentar novamente.')
      response.headers.set('retry-after', '60')
      return response
    }
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) return json(422, 'Revise o e-mail e a senha informados.')
    body = parsed.data
  }
  else {
    const session = await runtime.auth.api.getSession({ headers, query: { disableCookieCache: true } })
    if (session) await runtime.db.delete(identity.session).where(and(eq(identity.session.id, session.session.id), eq(identity.session.userId, session.user.id)))
    body = {}
  }
  const response = await runtime.auth.handler(new Request(request.url, { method: 'POST', headers, body: JSON.stringify(body) }))
  if (!response.ok) return json(path.endsWith('/sign-in/email') && response.status < 500 ? 401 : 503, 'Não foi possível entrar. Confira seus dados ou tente novamente mais tarde.')
  const responseHeaders = new Headers(response.headers)
  responseHeaders.delete('content-length')
  responseHeaders.set('cache-control', 'no-store')
  // Keep the HttpOnly cookie; never send Better Auth session tokens in JSON to the browser.
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: responseHeaders })
}
