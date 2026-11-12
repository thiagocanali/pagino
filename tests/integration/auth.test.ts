import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { eq } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'
import { createAuthentication, handleAuthentication, authenticatedUser, listInstitutions, readInstitution, type Authentication } from '../../server/auth/service'
import { user, account, session } from '../../server/db/auth-schema'
import { institutions, memberships, sites, pages } from '../../server/db/schema'

const connection = process.env.PAGINO_TEST_DATABASE_URL
if (!connection || !['127.0.0.1','localhost'].includes(new URL(connection).hostname) || new URL(connection).pathname !== '/pagino_test') throw new Error('Disposable local database required')
const admin = postgres(connection, { max: 1, prepare: false, onnotice: () => {} })
const db = drizzle(admin)
const password = randomBytes(24).toString('hex')
const origin = 'http://localhost:3000'
const tenantA = randomUUID(), tenantB = randomUUID(), siteA = randomUUID(), siteB = randomUUID()
const member = randomUUID(), unverified = randomUUID()
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
  runtime = await createAuthentication(config)
  await db.insert(user).values([{ id: member, name: 'Member', email, emailVerified: true }, { id: unverified, name: 'Unverified', email: `unverified-${member}@example.test`, emailVerified: false }])
  const hashed = await hashPassword(password)
  await db.insert(account).values([member, unverified].map(id => ({ id: randomUUID(), accountId: id, providerId: 'credential', userId: id, password: hashed, updatedAt: new Date() })))
  await db.insert(institutions).values([{ id: tenantA, name: 'Auth Tenant A', slug: `auth-a-${tenantA}` }, { id: tenantB, name: 'Auth Tenant B', slug: `auth-b-${tenantB}` }])
  await db.insert(memberships).values([{ userId: member, institutionId: tenantA, role: 'viewer' }, { userId: member, institutionId: tenantB, role: 'owner' }])
  await db.insert(sites).values([{ id: siteA, institutionId: tenantA }, { id: siteB, institutionId: tenantB }])
  await db.insert(pages).values([{ institutionId: tenantA, siteId: siteA, title: 'Auth page A', slug: 'home' }, { institutionId: tenantB, siteId: siteB, title: 'Auth page B', slug: 'home' }])
})
afterAll(async () => { await runtime?.close(); await admin.end() })

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
