import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { test, expect, type Page } from '@playwright/test'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { hashPassword } from 'better-auth/crypto'
import { eq } from 'drizzle-orm'
import { user, account, rateLimit, session } from '../../server/db/auth-schema'
import { institutions, memberships, sites, pages } from '../../server/db/schema'

const connection = process.env.PAGINO_TEST_DATABASE_URL
if (!connection || !['127.0.0.1','localhost'].includes(new URL(connection).hostname) || new URL(connection).pathname !== '/pagino_test') throw new Error('Run npm run test:auth:e2e against a disposable local database')
const admin = postgres(connection, { max: 1, prepare: false, onnotice: () => {} })
const db = drizzle(admin)
const id = randomUUID(), tenantA = randomUUID(), tenantB = randomUUID(), siteA = randomUUID(), siteB = randomUUID()
const email = `auth-${id}@example.test`, password = randomBytes(24).toString('hex')
let child: ChildProcess, origin: string
let startupLog = ''

test.beforeAll(async () => {
  await migrate(db, { migrationsFolder: 'migrations' })
  const rolePassword = randomBytes(24).toString('hex')
  await admin.unsafe(`alter role app_runtime login password '${rolePassword}'`).catch(() => { throw new Error('Role setup failed') })
  await admin.unsafe(`alter role auth_runtime login password '${rolePassword}'`).catch(() => { throw new Error('Role setup failed') })
  const url = new URL(connection!)
  url.username = 'auth_runtime'; url.password = rolePassword
  const authDatabaseUrl = url.href
  url.username = 'app_runtime'
  await db.insert(user).values({ id, name: 'Pessoa de teste', email, emailVerified: true })
  await db.insert(account).values({ id: randomUUID(), accountId: id, providerId: 'credential', userId: id, password: await hashPassword(password), updatedAt: new Date() })
  await db.insert(institutions).values([{ id: tenantA, name: 'Instituição Horizonte', slug: `horizonte-${tenantA}` }, { id: tenantB, name: 'Instituição Aurora', slug: `aurora-${tenantB}` }])
  await db.insert(memberships).values([{ userId: id, institutionId: tenantA, role: 'owner' }, { userId: id, institutionId: tenantB, role: 'viewer' }])
  await db.insert(sites).values([{ id: siteA, institutionId: tenantA }, { id: siteB, institutionId: tenantB }])
  await db.insert(pages).values([{ institutionId: tenantA, siteId: siteA, title: 'História do Horizonte', slug: 'home' }, { institutionId: tenantB, siteId: siteB, title: 'História da Aurora', slug: 'home' }])
  const reservation = createServer()
  await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve))
  const address = reservation.address()
  if (!address || typeof address === 'string') throw new Error('No local port available')
  const port = address.port
  await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()))
  origin = `http://127.0.0.1:${port}`
  child = spawn('node', ['.output/server/index.mjs'], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), NUXT_AUTH_BASE_URL: origin, NUXT_AUTH_SECRET: randomBytes(32).toString('hex'), NUXT_AUTH_DATABASE_URL: authDatabaseUrl, NUXT_DOMAIN_DATABASE_URL: url.href } })
  child.stderr?.on('data', data => { startupLog = (startupLog + String(data)).slice(-4000) })
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(origin + '/api/health')).ok) { ready = true; break } }
    catch { /* Wait for this owned local server. */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  if (!ready) throw new Error('App did not become ready: ' + startupLog)
})
test.beforeEach(async () => { await db.delete(rateLimit) })
test.afterAll(async () => {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 3000))])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
  await admin.end()
})
async function login(page: Page) {
  await page.goto(origin + '/auth/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  const response = page.waitForResponse(origin + '/api/auth/sign-in/email')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  const result = await response
  expect(result.status(), startupLog).toBe(200)
  expect(await result.json()).toEqual({ success: true })
  await expect(page.getByRole('heading', { name: 'Suas instituições.' })).toBeVisible()
}

test('login, tenant selection and logout use real HTTP, sessions and PostgreSQL', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(origin + '/admin')
  await expect(page).toHaveURL(origin + '/auth/login')
  await login(page)
  const cookies = await page.context().cookies()
  const tokenCookie = cookies.find(cookie => cookie.name.includes('session_token'))
  expect(tokenCookie?.httpOnly).toBe(true)
  expect(tokenCookie?.sameSite).toBe('Lax')
  const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
  await page.getByRole('link', { name: /Instituição Horizonte/ }).click()
  await expect(page.getByText('História do Horizonte', { exact: true })).toBeVisible()
  await expect(page.getByText('História da Aurora', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const audit = await page.request.get(`${origin}/api/institutions/${tenantA}/audit`)
  expect(audit.status()).toBe(200)
  const me = await page.request.get(origin + '/api/me')
  expect(Object.keys(await me.json()).sort()).toEqual(['email','id','name'])
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL(origin + '/auth/login')
  await page.goto(origin + '/admin')
  await expect(page).toHaveURL(origin + '/auth/login')
  const replay = await page.request.get(origin + '/api/me', { headers: { cookie: cookieHeader } })
  expect(replay.status()).toBe(401)
  expect(errors).toEqual([])
})

test('API denies cross-tenant and role escalation even when UI is bypassed', async ({ page }) => {
  await login(page)
  const forbidden = await page.request.get(`${origin}/api/institutions/${tenantB}/audit`, { headers: { 'x-role': 'owner', 'x-user-id': id } })
  expect(forbidden.status()).toBe(403)
  const foreign = await page.request.get(`${origin}/api/institutions/${randomUUID()}/pages`, { headers: { 'x-user-id': id, 'x-role': 'owner' } })
  expect(foreign.status()).toBe(404)
  await db.update(memberships).set({ status: 'revoked' }).where(eq(memberships.institutionId, tenantA))
  const revoked = await page.request.get(`${origin}/api/institutions/${tenantA}/pages`)
  expect(revoked.status()).toBe(404)
  await db.update(memberships).set({ status: 'active' }).where(eq(memberships.institutionId, tenantA))
  const attack = await page.request.post(origin + '/api/auth/sign-out', { headers: { origin: 'https://untrusted.example' }, data: {} })
  expect(attack.status()).toBe(403)
  expect((await page.request.get(origin + '/api/me')).status()).toBe(200)
})

test('expired sessions are denied by the server and the next protected navigation', async ({ page }) => {
  await login(page)
  await db.update(session).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(session.userId, id))
  expect((await page.request.get(origin + '/api/me')).status()).toBe(401)
  await page.goto(origin + '/admin')
  await expect(page).toHaveURL(origin + '/auth/login')
})

test('shows a real empty state when all memberships are revoked', async ({ page }) => {
  await login(page)
  await db.update(memberships).set({ status: 'revoked' }).where(eq(memberships.userId, id))
  try {
    await page.goto(origin + '/admin')
    await expect(page.getByRole('heading', { name: 'Nenhuma instituição disponível.' })).toBeVisible()
    expect((await page.request.get(`${origin}/api/institutions/${tenantA}/pages`)).status()).toBe(404)
  }
  finally { await db.update(memberships).set({ status: 'active' }).where(eq(memberships.userId, id)) }
})
