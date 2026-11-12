import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { eq } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'
import { startLocalMailCollector } from '../helpers/local-mail'
import { localMailTransport } from '../../server/auth/mail'
import { createAuthentication, handleAuthentication, authenticatedUser, listInstitutions, readInstitution, type Authentication } from '../../server/auth/service'
import { user, account, session, emailChallenges, verification, rateLimit } from '../../server/db/auth-schema'
import { institutions, memberships, sites, pages } from '../../server/db/schema'

const connection = process.env.PAGINO_TEST_DATABASE_URL
if (!connection || !['127.0.0.1','localhost'].includes(new URL(connection).hostname) || new URL(connection).pathname !== '/pagino_test') throw new Error('Disposable local database required')
const admin = postgres(connection, { max: 1, prepare: false, onnotice: () => {} })
const db = drizzle(admin)
const password = randomBytes(24).toString('hex')
let currentPassword = password
const origin = 'http://localhost:3000'
const tenantA = randomUUID(), tenantB = randomUUID(), siteA = randomUUID(), siteB = randomUUID()
const member = randomUUID(), unverified = randomUUID()
let collector: Awaited<ReturnType<typeof startLocalMailCollector>>
let runtime: Authentication
let config: Parameters<typeof createAuthentication>[0]
const email = `member-${member}@example.test`

function request(path: string, body: unknown, cookie?: string, requestOrigin = origin) {
  return new Request(origin + '/api/auth/' + path, { method: 'POST', headers: { 'content-type': 'application/json', origin: requestOrigin, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) })
}
async function login(ip: string) {
  const response = await handleAuthentication(runtime, request('sign-in/email', { email, password }), ip)
  expect(response.status).toBe(200)
  const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  expect(cookie).toContain('session_token')
  return { response, cookie, headers: new Headers({ cookie }) }
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: 'migrations' })
  const rolePassword = randomBytes(24).toString('hex')
  await admin.unsafe(`alter role auth_runtime login password '${rolePassword}'`).catch(() => { throw new Error('Role setup failed') })
  await admin.unsafe(`alter role app_runtime login password '${rolePassword}'`).catch(() => { throw new Error('Role setup failed') })
  const url = new URL(connection!)
  url.username = 'auth_runtime'; url.password = rolePassword
  const authDatabaseUrl = url.href
  url.username = 'app_runtime'
  config = { authSecret: randomBytes(32).toString('hex'), authBaseUrl: origin, authDatabaseUrl, domainDatabaseUrl: url.href }
  collector = await startLocalMailCollector()
  runtime = await createAuthentication(config, localMailTransport(origin, collector.url, collector.secret))
  await db.insert(user).values([{ id: member, name: 'Member', email, emailVerified: true }, { id: unverified, name: 'Unverified', email: `unverified-${member}@example.test`, emailVerified: false }])
  const hashed = await hashPassword(password)
  await db.insert(account).values([member, unverified].map(id => ({ id: randomUUID(), accountId: id, providerId: 'credential', userId: id, password: hashed, updatedAt: new Date() })))
  await db.insert(institutions).values([{ id: tenantA, name: 'Auth Tenant A', slug: `auth-a-${tenantA}` }, { id: tenantB, name: 'Auth Tenant B', slug: `auth-b-${tenantB}` }])
  await db.insert(memberships).values([{ userId: member, institutionId: tenantA, role: 'viewer' }, { userId: member, institutionId: tenantB, role: 'owner' }])
  await db.insert(sites).values([{ id: siteA, institutionId: tenantA }, { id: siteB, institutionId: tenantB }])
  await db.insert(pages).values([{ institutionId: tenantA, siteId: siteA, title: 'Auth page A', slug: 'home' }, { institutionId: tenantB, siteId: siteB, title: 'Auth page B', slug: 'home' }])
})
afterAll(async () => { await runtime?.close(); await collector?.close(); await admin.end() })

describe('real authentication and authorization', () => {
  it('rejects unsafe configuration and privileged database connections', async () => {
    await expect(createAuthentication({ ...config, authBaseUrl: 'http://public.example.test' })).rejects.toThrow()
    await expect(createAuthentication({ ...config, authSecret: '' })).rejects.toThrow()
    await expect(createAuthentication({ ...config, authDatabaseUrl: connection! })).rejects.toThrow('Restricted database role required')
  })
  it('returns a verified user and a cookie without returning session tokens in JSON', async () => {
    const { response, headers } = await login('192.0.2.11')
    expect(await response.json()).toEqual({ success: true })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i)
    expect(response.headers.get('set-cookie')).toMatch(/SameSite=Lax/i)
    expect(response.headers.get('set-cookie')).not.toMatch(/Domain=/i)
    expect(await authenticatedUser(runtime, headers)).toEqual({ id: member, name: 'Member', email })
  })
  it('sets Secure on HTTPS cookies without a cross-domain cookie', async () => {
    const secureOrigin = 'https://pagino.example.test'
    const secure = await createAuthentication({ ...config, authBaseUrl: secureOrigin })
    try {
      const response = await handleAuthentication(secure, new Request(secureOrigin + '/api/auth/sign-in/email', { method: 'POST', headers: { origin: secureOrigin, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) }), '192.0.2.19')
      expect(response.status).toBe(200)
      expect(response.headers.get('set-cookie')).toMatch(/; Secure/i)
      expect(response.headers.get('set-cookie')).not.toMatch(/Domain=/i)
    }
    finally { await secure.close() }
  })
  it('does not enumerate unknown, wrong-password or unverified accounts', async () => {
    const responses = await Promise.all([
      handleAuthentication(runtime, request('sign-in/email', { email: 'unknown@example.test', password }), '192.0.2.21'),
      handleAuthentication(runtime, request('sign-in/email', { email, password: 'wrong-password-value' }), '192.0.2.22'),
      handleAuthentication(runtime, request('sign-in/email', { email: `unverified-${member}@example.test`, password }), '192.0.2.23'),
    ])
    const bodies = await Promise.all(responses.map(response => response.text()))
    expect(responses.map(response => response.status)).toEqual([401, 401, 401])
    expect(new Set(bodies).size).toBe(1)
  })
  it('enforces persistent rate limits atomically under concurrent attempts', async () => {
    const responses = await Promise.all(Array.from({ length: 6 }, () => handleAuthentication(runtime, request('sign-in/email', { email: 'unknown@example.test', password }), '192.0.2.31')))
    expect(responses.filter(response => response.status === 429)).toHaveLength(1)
    expect(responses.filter(response => response.status === 401)).toHaveLength(5)
    const freshInstance = await createAuthentication(config)
    try { expect((await handleAuthentication(freshInstance, request('sign-in/email', { email, password }), '192.0.2.31')).status).toBe(429) }
    finally { await freshInstance.close() }
  })
  it('rejects forged origins, signup and invalid bodies', async () => {
    expect((await handleAuthentication(runtime, request('sign-in/email', { email, password }, undefined, 'https://untrusted.example'), '192.0.2.41')).status).toBe(403)
    expect((await handleAuthentication(runtime, request('sign-up/email', { email, password }), '192.0.2.41')).status).toBe(404)
    expect((await handleAuthentication(runtime, request('sign-in/email', { email, password, role: 'owner' }), '192.0.2.41')).status).toBe(422)
  })
  it('keeps per-institution roles and hides unknown tenants', async () => {
    const own = await listInstitutions(runtime, member)
    expect(own.find(row => row.id === tenantA)?.role).toBe('viewer')
    expect(own.find(row => row.id === tenantB)?.role).toBe('owner')
    expect((await readInstitution(runtime, member, tenantA, 'content.read')).data.map(row => 'title' in row ? row.title : '')).toEqual(['Auth page A'])
    await expect(readInstitution(runtime, member, tenantA, 'audit.read')).rejects.toMatchObject({ status: 403 })
    await expect(readInstitution(runtime, member, randomUUID(), 'content.read')).rejects.toMatchObject({ status: 404 })
  })
  it('rechecks membership revocation without revoking the global login session', async () => {
    const { headers } = await login('192.0.2.51')
    await db.update(memberships).set({ status: 'revoked' }).where(eq(memberships.userId, member))
    expect((await authenticatedUser(runtime, headers)).id).toBe(member)
    expect(await listInstitutions(runtime, member)).toEqual([])
    await expect(readInstitution(runtime, member, tenantA, 'content.read')).rejects.toMatchObject({ status: 404 })
    await db.update(memberships).set({ status: 'active' }).where(eq(memberships.userId, member))
  })
  it('rejects expired sessions despite a valid signed cookie', async () => {
    const { headers } = await login('192.0.2.61')
    await db.update(session).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(session.userId, member))
    await expect(authenticatedUser(runtime, headers)).rejects.toMatchObject({ status: 401 })
  })
  it('revokes logout in the database and rejects replay of the old cookie', async () => {
    const { cookie, headers } = await login('192.0.2.71')
    expect((await handleAuthentication(runtime, request('sign-out', {}, cookie), '192.0.2.71')).status).toBe(200)
    await expect(authenticatedUser(runtime, headers)).rejects.toMatchObject({ status: 401 })
  })
  it('does not claim successful logout if session deletion fails', async () => {
    const { cookie } = await login('192.0.2.81')
    await admin`revoke delete on pagino_auth.session from auth_runtime`
    try { await expect(handleAuthentication(runtime, request('sign-out', {}, cookie), '192.0.2.81')).rejects.toThrow() }
    finally { await admin`grant delete on pagino_auth.session to auth_runtime` }
  })
})

function latestToken(to: string) {
  const message = [...collector.messages].reverse().find(item => item.to === to)
  const fragment = message?.text.match(/http[^\s]+#([a-f0-9]{64})/)?.[1]
  if (!fragment) throw new Error('Expected local delivery was not captured')
  return fragment
}
async function emailAction(path: string, body: unknown, ip = '192.0.2.151') {
  await db.delete(rateLimit)
  return handleAuthentication(runtime, request(path, body), ip)
}

describe('recovery and email verification', () => {
  it('fails closed without mail and rejects external transport configuration', async () => {
    const disabled = await createAuthentication(config)
    try {
      expect((await handleAuthentication(disabled, request('request-password-reset', { email }), '192.0.2.1')).status).toBe(503)
    } finally { await disabled.close() }
    expect(() => localMailTransport('https://production.example', collector.url, collector.secret)).toThrow()
    expect(() => localMailTransport(origin, 'http://external.example/messages', collector.secret)).toThrow()
  })
  it('requests known and unknown emails with identical generic results, without returning tokens', async () => {
    const known = await emailAction('request-password-reset', { email })
    const unknown = await emailAction('request-password-reset', { email: 'missing@example.test' })
    expect(known.status).toBe(200); expect(unknown.status).toBe(200)
    expect(await known.text()).toBe(await unknown.text())
    const raw = latestToken(email)
    const records = await db.select().from(emailChallenges).where(eq(emailChallenges.recipient, email))
    expect(records.length).toBeGreaterThan(0)
    for (const row of records) { expect(row.tokenHash).not.toBe(raw); expect(row.nativeToken).not.toContain(raw); expect(row.deliveryStatus).toBe('sent') }
    const native = await db.select().from(verification)
    expect(native.some(row => row.identifier.startsWith('reset-password:'))).toBe(false)
  })
  it('rejects expired links without changing the password', async () => {
    await emailAction('request-password-reset', { email })
    const token = latestToken(email)
    await db.update(emailChallenges).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(emailChallenges.recipient, email))
    expect((await emailAction('reset-password', { token, newPassword: 'new-password-not-applied' })).status).toBe(400)
    expect((await handleAuthentication(runtime, request('sign-in/email', { email, password }), '192.0.2.152')).status).toBe(200)
  })
  it('rolls back token consumption, password and revocation if the password write fails', async () => {
    const signed = await login('192.0.2.153')
    await emailAction('request-password-reset', { email })
    const token = latestToken(email)
    await admin`revoke update on pagino_auth.account from auth_runtime`
    try { expect((await emailAction('reset-password', { token, newPassword: 'new-password-not-applied' })).status).toBe(503) }
    finally { await admin`grant update on pagino_auth.account to auth_runtime` }
    expect((await authenticatedUser(runtime, signed.headers)).id).toBe(member)
    const rows = await db.select().from(emailChallenges).where(eq(emailChallenges.recipient, email))
    expect(rows.some(row => !row.usedAt && row.deliveryStatus === 'sent')).toBe(true)
  })
  it('consumes a reset once across instances, invalidates siblings and revokes old sessions', async () => {
    const signed = await login('192.0.2.154')
    await emailAction('request-password-reset', { email }); const sibling = latestToken(email)
    await emailAction('request-password-reset', { email }); const token = latestToken(email)
    const nextPassword = '  a new password with spaces  '
    await db.delete(rateLimit)
    const other = await createAuthentication(config, localMailTransport(origin, collector.url, collector.secret))
    try {
      const responses = await Promise.all([runtime, other].map(instance => handleAuthentication(instance, request('reset-password', { token, newPassword: nextPassword }), '192.0.2.155')))
      expect(responses.map(response => response.status).sort()).toEqual([200,400])
    } finally { await other.close() }
    await expect(authenticatedUser(runtime, signed.headers)).rejects.toMatchObject({ status: 401 })
    expect((await emailAction('reset-password', { token: sibling, newPassword: 'another valid password' })).status).toBe(400)
    expect((await handleAuthentication(runtime, request('sign-in/email', { email, password }), '192.0.2.156')).status).toBe(401)
    expect((await handleAuthentication(runtime, request('sign-in/email', { email, password: nextPassword }), '192.0.2.157')).status).toBe(200)
    currentPassword = nextPassword
  })
  it('cannot leave an old-password session valid during a concurrent reset and login', async () => {
    await emailAction('request-password-reset', { email })
    const token = latestToken(email)
    const next = 'another strong synthetic password'
    await db.delete(rateLimit)
    const [reset, signed] = await Promise.all([
      handleAuthentication(runtime, request('reset-password', { token, newPassword: next }), '192.0.2.158'),
      handleAuthentication(runtime, request('sign-in/email', { email, password: currentPassword }), '192.0.2.159'),
    ])
    expect(reset.status).toBe(200)
    expect([200,401]).toContain(signed.status)
    if (signed.status === 200) {
      const cookie = signed.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
      await expect(authenticatedUser(runtime, new Headers({ cookie }))).rejects.toMatchObject({ status: 401 })
    }
    currentPassword = next
  })
  it('verifies an opaque one-use link without automatic login or GET side effects', async () => {
    const address = `unverified-${member}@example.test`
    await emailAction('send-verification-email', { email: address })
    const expired = latestToken(address)
    await db.update(emailChallenges).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(emailChallenges.recipient, address))
    expect((await emailAction('verify-email', { token: expired })).status).toBe(400)
    expect((await db.select().from(user).where(eq(user.id, unverified)))[0]?.emailVerified).toBe(false)
    await emailAction('send-verification-email', { email: address })
    const token = latestToken(address)
    const get = await handleAuthentication(runtime, new Request(origin + '/api/auth/verify-email?token=' + token), '192.0.2.161')
    expect(get.status).toBe(405)
    const wrongPurpose = await emailAction('reset-password', { token, newPassword: 'not used password' })
    expect(wrongPurpose.status).toBe(400)
    const completed = await emailAction('verify-email', { token })
    expect(completed.status).toBe(200)
    expect(completed.headers.get('set-cookie')).toBeNull()
    expect((await db.select().from(user).where(eq(user.id, unverified)))[0]?.emailVerified).toBe(true)
    expect((await emailAction('verify-email', { token })).status).toBe(400)
    expect((await handleAuthentication(runtime, request('sign-in/email', { email: address, password }), '192.0.2.162')).status).toBe(200)
  })
  it('records failed delivery without exposing account existence', async () => {
    collector.fail(true)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const known = await emailAction('request-password-reset', { email })
      const unknown = await emailAction('request-password-reset', { email: 'not-existing@example.test' })
      expect(known.status).toBe(200); expect(await known.text()).toBe(await unknown.text())
      expect((await db.select().from(emailChallenges).where(eq(emailChallenges.recipient, email))).some(row => row.deliveryStatus === 'failed')).toBe(true)
      expect(log).toHaveBeenCalled()
      expect(JSON.stringify(log.mock.calls)).not.toContain(email)
      for (const call of log.mock.calls) expect(Object.keys(JSON.parse(String(call[0]))).sort()).toEqual(['event','requestId'])
    } finally { collector.fail(false); log.mockRestore() }
  })
  it('does not accept callbacks or secrets from a request', async () => {
    expect((await emailAction('request-password-reset', { email, redirectTo: 'https://untrusted.example' })).status).toBe(422)
    expect((await emailAction('send-verification-email', { email, callbackURL: 'https://untrusted.example' })).status).toBe(422)
  })
})
