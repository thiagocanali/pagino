import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { betterAuth } from 'better-auth'
import { symmetricEncrypt, symmetricDecrypt } from 'better-auth/crypto'
import type { AuthMailTransport } from './mail'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { drizzle } from 'drizzle-orm/postgres-js'
import { and, eq, isNull, sql } from 'drizzle-orm'
import postgres from 'postgres'
import * as identity from '../db/auth-schema'
import { memberships, institutions, pages, auditLogs } from '../db/schema'
import { createDomainDatabase, withTenant } from '../db/tenant'
import { can, isRole, type Permission } from '../../shared/auth/permissions'
import { loginSchema, emailRequestSchema, resetPasswordSchema, verificationSchema } from '../../shared/schemas/login'
import type { InstitutionSummary } from '../../shared/types/api'

const configSchema = z.strictObject({
  authSecret: z.string().min(32), authBaseUrl: z.url(), authDatabaseUrl: z.url(), domainDatabaseUrl: z.url(),
})
export type AuthConfig = z.infer<typeof configSchema>
export class AccessError extends Error {
  constructor(public status: number) { super('Access denied') }
}

export async function createAuthentication(input: AuthConfig, mail?: AuthMailTransport) {
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
    const deliver = async (recipient: { id: string; email: string }, native: string, purpose: 'reset' | 'verify', correlationId: string) => {
      if (!mail) throw new Error('Mail transport unavailable')
      const token = randomBytes(32).toString('hex')
      const [challenge] = await db.insert(identity.emailChallenges).values({
        userId: recipient.id, recipient: recipient.email, purpose,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        nativeToken: await symmetricEncrypt({ key: config.authSecret, data: native }),
        expiresAt: new Date(Date.now() + (purpose === 'reset' ? 1800 : 86400) * 1000),
      }).returning({ id: identity.emailChallenges.id })
      if (!challenge) throw new Error('Challenge creation failed')
      const link = config.authBaseUrl + (purpose === 'reset' ? '/auth/redefinir-senha#' : '/auth/confirmar-email#') + token
      try {
        await mail.send({ to: recipient.email, subject: purpose === 'reset' ? 'Redefina sua senha — Pagino' : 'Confirme seu e-mail — Pagino', text: `Use o link para continuar: ${link}\nSe você não solicitou esta ação, ignore a mensagem.` })
        await db.update(identity.emailChallenges).set({ deliveryStatus: 'sent' }).where(eq(identity.emailChallenges.id, challenge.id))
      }
      catch {
        console.error(JSON.stringify({ event: 'auth_email_delivery_failed', requestId: correlationId }))
        await db.update(identity.emailChallenges).set({ deliveryStatus: 'failed' }).where(eq(identity.emailChallenges.id, challenge.id))
        throw new Error('Mail delivery failed')
      }
    }
    const makeAuth = (connection: Parameters<typeof drizzleAdapter>[0], correlationId: string = randomUUID()) => betterAuth({
      secret: config.authSecret, baseURL: config.authBaseUrl, trustedOrigins: [config.authBaseUrl],
      database: drizzleAdapter(connection, { provider: 'pg', schema: identity, transaction: true }),
      emailAndPassword: { enabled: true, disableSignUp: true, requireEmailVerification: true, minPasswordLength: 12, maxPasswordLength: 128, resetPasswordTokenExpiresIn: 1800, revokeSessionsOnPasswordReset: true, sendResetPassword: mail ? async ({ user, token }) => deliver(user, token, 'reset', correlationId) : undefined },
      emailVerification: { expiresIn: 86400, autoSignInAfterVerification: false, sendOnSignIn: false, sendOnSignUp: false, sendVerificationEmail: mail ? async ({ user, token }) => deliver(user, token, 'verify', correlationId) : undefined },
      verification: { storeIdentifier: 'hashed' },
      session: { expiresIn: 60 * 60 * 24 * 7, disableSessionRefresh: true, cookieCache: { enabled: false } },
      rateLimit: { enabled: true, storage: 'database', window: 60, max: 100, customRules: { '/sign-in/email': { window: 60, max: 100 } } },
      advanced: { useSecureCookies: base.protocol === 'https:', crossSubDomainCookies: { enabled: false }, defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' }, ipAddress: { ipAddressHeaders: ['x-pagino-client-ip'] } },
      logger: { disabled: true },
    })
    const auth = makeAuth(db)
    return { auth, makeAuth, mailEnabled: Boolean(mail), db, domain: domain.db, origin: config.authBaseUrl, secret: config.authSecret, close: async () => { await identityClient.end(); await domain.close() } }
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

async function consumeLoginAttempt(runtime: Authentication, clientIP: string, bucketName = 'login') {
  const key = bucketName + ':' + createHmac('sha256', runtime.secret).update(clientIP).digest('hex')
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
export async function handleAuthentication(runtime: Authentication, request: Request, clientIP: string, requestId: string = randomUUID()) {
  const path = new URL(request.url).pathname
  if (path === '/api/auth/capabilities' && request.method === 'GET') return Response.json({ emailRecovery: runtime.mailEnabled, emailVerification: runtime.mailEnabled }, { headers: { 'cache-control': 'no-store' } })
  const emailRequest = ['/api/auth/request-password-reset', '/api/auth/send-verification-email'].includes(path)
  const emailCompletion = ['/api/auth/reset-password', '/api/auth/verify-email'].includes(path)
  if (!['/api/auth/sign-in/email', '/api/auth/sign-out'].includes(path) && !emailRequest && !emailCompletion) return json(404, 'Rota não encontrada.')
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
  if (emailRequest || emailCompletion) {
    if (!runtime.mailEnabled) return json(503, 'Envio de e-mail indisponível neste ambiente.')
    if (!await consumeLoginAttempt(runtime, clientIP, emailRequest ? 'email-request' : 'email-complete')) return json(429, 'Muitas tentativas. Aguarde um minuto antes de tentar novamente.')
    if (emailRequest) {
      const parsed = emailRequestSchema.safeParse(body)
      if (!parsed.success) return json(422, 'Informe um e-mail válido.')
      const started = Date.now()
      const mailAuth = runtime.makeAuth(runtime.db, requestId)
      // A delivery failure must not disclose whether an account exists. Failed deliveries remain identifiable for operations.
      try {
        if (path.endsWith('/request-password-reset')) await mailAuth.api.requestPasswordReset({ body: parsed.data, headers })
        else await mailAuth.api.sendVerificationEmail({ body: parsed.data, headers: new Headers({ origin: runtime.origin }) })
      }
      catch { console.error(JSON.stringify({ event: 'auth_email_request_failed', requestId })) }
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 500 - (Date.now() - started))))
      return json(200, 'Se houver uma conta elegível, você receberá as instruções por e-mail.')
    }
    const parsed = path.endsWith('/reset-password') ? resetPasswordSchema.safeParse(body) : verificationSchema.safeParse(body)
    if (!parsed.success) return json(422, 'Revise os dados. A senha deve ter entre 12 e 128 caracteres e o link deve ser válido.')
    try {
      await runtime.db.transaction(async (tx) => {
        const digest = createHash('sha256').update(parsed.data.token).digest('hex')
        const [candidate] = await tx.select({ userId: identity.emailChallenges.userId }).from(identity.emailChallenges).where(eq(identity.emailChallenges.tokenHash, digest))
        if (!candidate) throw new AccessError(400)
        // Serialize identity changes and logins for this user before locking receipts.
        await tx.select({ id: identity.user.id }).from(identity.user).where(eq(identity.user.id, candidate.userId)).for('update')
        const [challenge] = await tx.select().from(identity.emailChallenges).where(eq(identity.emailChallenges.tokenHash, digest)).for('update')
        const purpose = path.endsWith('/reset-password') ? 'reset' : 'verify'
        if (!challenge || challenge.purpose !== purpose || challenge.usedAt || challenge.expiresAt.getTime() <= Date.now() || challenge.deliveryStatus !== 'sent') throw new AccessError(400)
        const nativeToken = await symmetricDecrypt({ key: runtime.secret, data: challenge.nativeToken })
        const transactional = runtime.makeAuth(tx)
        if ('newPassword' in parsed.data && typeof parsed.data.newPassword === 'string') await transactional.api.resetPassword({ body: { token: nativeToken, newPassword: parsed.data.newPassword } })
        else {
          await transactional.api.verifyEmail({ query: { token: nativeToken } })
          await tx.delete(identity.session).where(eq(identity.session.userId, challenge.userId))
        }
        await tx.update(identity.emailChallenges).set({ usedAt: new Date(), nativeToken: '' }).where(and(eq(identity.emailChallenges.userId, challenge.userId), eq(identity.emailChallenges.purpose, purpose), isNull(identity.emailChallenges.usedAt)))
      })
      return Response.json({ success: true }, { headers: { 'cache-control': 'no-store' } })
    }
    catch (error) {
      const status = error instanceof AccessError ? error.status : (error as { statusCode?: number }).statusCode
      return json(status && status < 500 ? 400 : 503, status && status < 500 ? 'Link inválido, expirado ou já utilizado.' : 'Não foi possível concluir agora. Tente novamente mais tarde.')
    }
  }
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
  const nativeRequest = () => new Request(request.url, { method: 'POST', headers, body: JSON.stringify(body) })
  const response = path.endsWith('/sign-in/email')
    ? await runtime.db.transaction(async (tx) => {
      const credentials = loginSchema.parse(body)
      await tx.select({ id: identity.user.id }).from(identity.user).where(eq(identity.user.email, credentials.email)).for('update')
      return runtime.makeAuth(tx).api.signInEmail({ body: credentials, headers, asResponse: true })
    })
    : await runtime.auth.handler(nativeRequest())
  if (!response.ok) return json(path.endsWith('/sign-in/email') && response.status < 500 ? 401 : 503, 'Não foi possível entrar. Confira seus dados ou tente novamente mais tarde.')
  const responseHeaders = new Headers(response.headers)
  responseHeaders.delete('content-length')
  responseHeaders.set('cache-control', 'no-store')
  // Keep the HttpOnly cookie; never send Better Auth session tokens in JSON to the browser.
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: responseHeaders })
}
