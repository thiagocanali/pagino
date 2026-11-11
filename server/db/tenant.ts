import { and, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { z } from 'zod'
import * as schema from './schema'

export function createDomainDatabase(url: string) {
  const client = postgres(url, { max: 2, prepare: false, connect_timeout: 5, idle_timeout: 20 })
  return { db: drizzle(client, { schema }), close: () => client.end() }
}

type Database = ReturnType<typeof createDomainDatabase>['db']
const contextSchema = z.strictObject({ institutionId: z.uuid(), userId: z.string().min(1).max(128) })
export type TenantContext = z.infer<typeof contextSchema>
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

// Only accept context obtained from a validated server session, never request payloads.
export async function withTenant<T>(db: Database, context: TenantContext, operation: (tx: Transaction) => Promise<T>) {
  const trusted = contextSchema.parse(context)
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('pagino.institution_id', ${trusted.institutionId}, true), set_config('pagino.user_id', ${trusted.userId}, true)`)
    return operation(tx)
  })
}

export async function createDraftPage(db: Database, context: TenantContext, input: { siteId: string; slug: string; title: string }) {
  const page = z.strictObject({ siteId: z.uuid(), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60), title: z.string().trim().min(1).max(120) }).parse(input)
  return withTenant(db, context, async (tx) => {
    const [membership] = await tx.select().from(schema.memberships).where(and(eq(schema.memberships.institutionId, context.institutionId), eq(schema.memberships.userId, context.userId)))
    if (!membership || !['owner', 'admin', 'editor'].includes(membership.role)) throw new Error('FORBIDDEN')
    const [site] = await tx.select().from(schema.sites).where(and(eq(schema.sites.id, page.siteId), eq(schema.sites.institutionId, context.institutionId))).for('update')
    if (!site) throw new Error('NOT_FOUND')
    const [created] = await tx.insert(schema.pages).values({ ...page, institutionId: context.institutionId }).returning()
    if (!created) throw new Error('INSERT_FAILED')
    await tx.update(schema.sites).set({ draftVersion: sql`${schema.sites.draftVersion} + 1` }).where(eq(schema.sites.id, site.id))
    await tx.insert(schema.auditLogs).values({ institutionId: context.institutionId, actorUserId: context.userId, action: 'page.created', entityId: created.id })
    return created
  })
}
