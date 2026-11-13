import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { eq, sql } from 'drizzle-orm'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { hashPassword } from 'better-auth/crypto'
import * as authSchema from '../../server/db/auth-schema'
import { institutions, memberships, sites, pages, auditLogs } from '../../server/db/schema'
import { createDomainDatabase, createDraftPage, withTenant } from '../../server/db/tenant'

const connection = process.env.PAGINO_TEST_DATABASE_URL
if (!connection) throw new Error('Run npm run test:db; no implicit database is allowed')
const target = new URL(connection)
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/pagino_test') throw new Error('Integration tests require a loopback disposable pagino_test database')
const admin = postgres(connection, { max: 1, prepare: false, onnotice: () => {} })
const adminDb = drizzle(admin)
const tenantA = randomUUID()
const tenantB = randomUUID()
const siteA = randomUUID()
const siteB = randomUUID()
const userA = 'fixture-owner-a'
const userB = 'fixture-owner-b'
const viewer = 'fixture-viewer-a'
let runtime: ReturnType<typeof createDomainDatabase>
let identityClient: ReturnType<typeof postgres>
let identityDb: ReturnType<typeof drizzle<typeof authSchema>>

beforeAll(async () => {
  await migrate(adminDb, { migrationsFolder: 'migrations' })
  await migrate(adminDb, { migrationsFolder: 'migrations' }) // Applying the same migration set again is a no-op.
  const rolePassword = randomBytes(24).toString('hex')
  // Random hexadecimal only, not user-controlled; PostgreSQL utility statements do not accept bind parameters here.
  await admin.unsafe(`alter role app_runtime login password '${rolePassword}'`).catch(() => { throw new Error('Test role bootstrap failed') })
  await admin.unsafe(`alter role auth_runtime login password '${rolePassword}'`).catch(() => { throw new Error('Test auth role bootstrap failed') })
  const runtimeURL = new URL(connection!)
  runtimeURL.username = 'app_runtime'; runtimeURL.password = rolePassword
  runtime = createDomainDatabase(runtimeURL.href)
  runtimeURL.username = 'auth_runtime'
  identityClient = postgres(runtimeURL.href, { max: 1, prepare: false })
  identityDb = drizzle(identityClient, { schema: authSchema })
  await adminDb.insert(authSchema.user).values([
    { id: userA, name: 'Owner A', email: 'owner-a@example.test', emailVerified: true },
    { id: userB, name: 'Owner B', email: 'owner-b@example.test', emailVerified: true },
    { id: viewer, name: 'Viewer A', email: 'viewer-a@example.test', emailVerified: true },
  ])
  await adminDb.insert(institutions).values([{ id: tenantA, name: 'Institution A', slug: 'institution-a' }, { id: tenantB, name: 'Institution B', slug: 'institution-b' }])
  await adminDb.insert(memberships).values([
    { institutionId: tenantA, userId: userA, role: 'owner' },
    { institutionId: tenantB, userId: userB, role: 'owner' },
    { institutionId: tenantA, userId: viewer, role: 'viewer' },
  ])
  await adminDb.insert(sites).values([{ id: siteA, institutionId: tenantA }, { id: siteB, institutionId: tenantB }])
  await adminDb.insert(pages).values([{ institutionId: tenantA, siteId: siteA, title: 'A only', slug: 'home' }, { institutionId: tenantB, siteId: siteB, title: 'B only', slug: 'home' }])
})

afterEach(async () => {
  await adminDb.update(memberships).set({ status: 'active' })
  await adminDb.update(institutions).set({ status: 'active' })
})
afterAll(async () => { await runtime?.close(); await identityClient?.end(); await admin.end() })

describe('PostgreSQL tenant boundary', () => {
  it('uses a non-owner role without superuser or BYPASSRLS and forces RLS on all domain tables', async () => {
    const roles = await runtime.db.execute(sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`)
    expect(roles[0]).toMatchObject({ rolsuper: false, rolbypassrls: false })
    const tables = await admin`select relrowsecurity, relforcerowsecurity, pg_get_userbyid(relowner) as owner from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'pagino' and c.relkind = 'r'`
    expect(tables).toHaveLength(8)
    for (const table of tables) expect(table).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true, owner: 'postgres' })
  })

  it('denies runtime invocation of privileged owner invitation acceptance', async () => {
    // A compromised domain connection must not be able to choose an arbitrary
    // verified user id and mint an owner membership via SECURITY DEFINER.
    await expect(runtime.db.execute(sql`select pagino.accept_initial_owner_invitation('fixture-owner-a', repeat('0', 64))`)).rejects.toThrow()
    const privileges = await admin`select has_function_privilege('app_runtime', 'pagino.accept_initial_owner_invitation(text,text)', 'EXECUTE') as can_execute`
    expect(privileges[0]?.can_execute).toBe(false)
  })

  it('denies every domain read without context', async () => {
    expect(await runtime.db.select().from(pages)).toEqual([])
    expect(await runtime.db.select().from(institutions)).toEqual([])
  })

  it('separates both tenants and denies a valid user in the wrong institution', async () => {
    for (const [institutionId, userId, expected] of [[tenantA, userA, 'A only'], [tenantB, userB, 'B only']] as const) {
      const rows = await withTenant(runtime.db, { institutionId, userId }, tx => tx.select().from(pages))
      expect(rows.map(row => row.title)).toEqual([expected])
    }
    expect(await withTenant(runtime.db, { institutionId: tenantB, userId: userA }, tx => tx.select().from(pages))).toEqual([])
  })

  it('blocks cross-tenant inserts and moves via WITH CHECK', async () => {
    await expect(withTenant(runtime.db, { institutionId: tenantA, userId: userA }, tx => tx.insert(pages).values({ institutionId: tenantB, siteId: siteB, title: 'Attack', slug: 'attack' }))).rejects.toThrow()
    await expect(withTenant(runtime.db, { institutionId: tenantA, userId: userA }, tx => tx.update(pages).set({ institutionId: tenantB, siteId: siteB }).where(eq(pages.slug, 'home')))).rejects.toThrow()
  })

  it('hides cross-tenant targets during UPDATE and DELETE without changing them', async () => {
    const context = { institutionId: tenantA, userId: userA }
    expect(await withTenant(runtime.db, context, tx => tx.update(pages).set({ title: 'Attack' }).where(eq(pages.institutionId, tenantB)).returning())).toEqual([])
    expect(await withTenant(runtime.db, context, tx => tx.delete(pages).where(eq(pages.institutionId, tenantB)).returning())).toEqual([])
    const rows = await adminDb.select().from(pages).where(eq(pages.institutionId, tenantB))
    expect(rows.map(row => row.title)).toEqual(['B only'])
  })

  it('enforces the tenant/site foreign key independently of application filters', async () => {
    await expect(adminDb.insert(pages).values({ institutionId: tenantA, siteId: siteB, title: 'Bad reference', slug: 'bad-ref' })).rejects.toThrow()
  })

  it('does not leak transaction context after commit, rollback or concurrent pool reuse', async () => {
    await Promise.all(Array.from({ length: 12 }, (_, i) => withTenant(runtime.db, { institutionId: i % 2 ? tenantA : tenantB, userId: i % 2 ? userA : userB }, async (tx) => {
      const rows = await tx.select().from(pages)
      expect(rows.every(row => row.institutionId === (i % 2 ? tenantA : tenantB))).toBe(true)
    })))
    await expect(withTenant(runtime.db, { institutionId: tenantA, userId: userA }, async () => { throw new Error('ROLLBACK') })).rejects.toThrow('ROLLBACK')
    const contexts = await Promise.all(Array.from({ length: 4 }, () => runtime.db.execute(sql`select current_setting('pagino.institution_id', true) as tenant`)))
    for (const result of contexts) expect(result[0]?.tenant || '').toBe('')
    expect(await runtime.db.select().from(pages)).toEqual([])
  })

  it('revokes the next operation when membership or institution becomes inactive', async () => {
    await adminDb.update(memberships).set({ status: 'revoked' }).where(eq(memberships.userId, userA))
    expect(await withTenant(runtime.db, { institutionId: tenantA, userId: userA }, tx => tx.select().from(pages))).toEqual([])
    await adminDb.update(institutions).set({ status: 'suspended' }).where(eq(institutions.id, tenantB))
    expect(await withTenant(runtime.db, { institutionId: tenantB, userId: userB }, tx => tx.select().from(pages))).toEqual([])
  })

  it('lets a viewer read while denying writes, audit access and membership escalation', async () => {
    const context = { institutionId: tenantA, userId: viewer }
    expect((await withTenant(runtime.db, context, tx => tx.select().from(pages))).length).toBeGreaterThan(0)
    await expect(createDraftPage(runtime.db, context, { siteId: siteA, title: 'No', slug: 'viewer-write' })).rejects.toThrow('FORBIDDEN')
    expect(await withTenant(runtime.db, context, tx => tx.select().from(auditLogs))).toEqual([])
    await expect(withTenant(runtime.db, context, tx => tx.update(memberships).set({ role: 'owner' }))).rejects.toThrow()
  })

  it('persists a page, increments draft version and commits append-only audit atomically', async () => {
    const [before] = await adminDb.select().from(sites).where(eq(sites.id, siteA))
    const created = await createDraftPage(runtime.db, { institutionId: tenantA, userId: userA }, { siteId: siteA, title: 'New page', slug: 'new-page' })
    const [after] = await adminDb.select().from(sites).where(eq(sites.id, siteA))
    expect(after!.draftVersion).toBe(before!.draftVersion + 1)
    expect(await adminDb.select().from(auditLogs).where(eq(auditLogs.entityId, created.id))).toHaveLength(1)
    await expect(withTenant(runtime.db, { institutionId: tenantA, userId: userA }, tx => tx.delete(auditLogs))).rejects.toThrow()
  })

  it('rolls back page writes when audit fails', async () => {
    const id = randomUUID()
    await expect(withTenant(runtime.db, { institutionId: tenantA, userId: userA }, async (tx) => {
      await tx.insert(pages).values({ id, institutionId: tenantA, siteId: siteA, title: 'Rollback', slug: 'rollback' })
      await tx.insert(auditLogs).values({ institutionId: tenantA, actorUserId: userB, action: 'invalid-actor', entityId: id })
    })).rejects.toThrow()
    expect(await adminDb.select().from(pages).where(eq(pages.id, id))).toEqual([])
  })

  it('separates auth and domain privileges', async () => {
    await expect(runtime.db.execute(sql`select * from pagino_auth."user"`)).rejects.toThrow()
    await expect(identityDb.select().from(institutions)).rejects.toThrow()
  })

  it('grants no unpublished domain data to the public role', async () => {
    await expect(admin.begin(async (tx) => {
      await tx`set local role public_reader`
      await tx`select * from pagino.pages`
    })).rejects.toThrow()
  })

  it('uses the actual Better Auth adapter with the private schema and restricted auth role', async () => {
    const password = randomBytes(24).toString('hex')
    await identityDb.insert(authSchema.account).values({ id: randomUUID(), accountId: userA, providerId: 'credential', userId: userA, password: await hashPassword(password), updatedAt: new Date() })
    const auth = betterAuth({
      secret: randomBytes(32).toString('hex'), baseURL: 'http://localhost:3000', trustedOrigins: ['http://localhost:3000'],
      database: drizzleAdapter(identityDb, { provider: 'pg', schema: authSchema }),
      emailAndPassword: { enabled: true, disableSignUp: true },
    })
    const response = await auth.api.signInEmail({ body: { email: 'owner-a@example.test', password }, asResponse: true })
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(await identityDb.select().from(authSchema.session).where(eq(authSchema.session.userId, userA))).toHaveLength(1)
  })
})
