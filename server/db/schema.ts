import { sql } from 'drizzle-orm'
import { pgSchema, uuid, text, timestamp, integer, jsonb, unique, foreignKey, check, index } from 'drizzle-orm/pg-core'
import { user } from './auth-schema'

export const pagino = pgSchema('pagino')
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull()

export const institutions = pagino.table('institutions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  status: text('status').notNull().default('active'),
  createdAt: createdAt(),
}, t => [
  check('institutions_status_check', sql`${t.status} in ('active', 'suspended')`),
  check('institutions_slug_check', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.slug}) between 3 and 60`),
]).enableRLS()

export const memberships = pagino.table('memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id),
  userId: text('user_id').notNull().references(() => user.id),
  role: text('role').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: createdAt(),
}, t => [
  unique('memberships_institution_user_unique').on(t.institutionId, t.userId),
  check('memberships_role_check', sql`${t.role} in ('owner','admin','editor','viewer')`),
  check('memberships_status_check', sql`${t.status} in ('active','revoked')`),
  index('memberships_user_status_index').on(t.userId, t.status),
]).enableRLS()

export const sites = pagino.table('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull().unique().references(() => institutions.id),
  templateKey: text('template_key').notNull().default('institutional-classic'),
  templateVersion: integer('template_version').notNull().default(1),
  draftVersion: integer('draft_version').notNull().default(1),
  createdAt: createdAt(),
}, t => [
  unique('sites_tenant_id_unique').on(t.institutionId, t.id),
  check('sites_versions_check', sql`${t.templateVersion} > 0 and ${t.draftVersion} > 0`),
]).enableRLS()

export const pages = pagino.table('pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull(),
  siteId: uuid('site_id').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  sections: jsonb('sections').$type<unknown[]>().notNull().default([]),
  version: integer('version').notNull().default(1),
  createdAt: createdAt(),
}, t => [
  unique('pages_site_slug_unique').on(t.siteId, t.slug),
  unique('pages_tenant_id_unique').on(t.institutionId, t.id),
  foreignKey({ name: 'pages_tenant_site_fk', columns: [t.institutionId, t.siteId], foreignColumns: [sites.institutionId, sites.id] }),
  check('pages_version_check', sql`${t.version} > 0`),
  index('pages_tenant_site_index').on(t.institutionId, t.siteId),
]).enableRLS()

export const auditLogs = pagino.table('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id),
  actorUserId: text('actor_user_id').notNull().references(() => user.id),
  action: text('action').notNull(),
  entityId: uuid('entity_id').notNull(),
  createdAt: createdAt(),
}, t => [index('audit_tenant_created_index').on(t.institutionId, t.createdAt, t.id)])

/** Operational bootstrap records; no direct runtime grants to these tables. */
export const initialOwnerInvitations = pagino.table('initial_owner_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id).unique(),
  recipientEmail: text('recipient_email').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  encryptedToken: text('encrypted_token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  deliveryStatus: text('delivery_status').notNull().default('pending'),
  createdAt: createdAt(),
}, t => [
  check('initial_owner_invitation_delivery', sql`${t.deliveryStatus} in ('pending','sent','failed')`),
  check('initial_owner_invitation_email', sql`${t.recipientEmail} = lower(${t.recipientEmail}) and length(${t.recipientEmail}) <= 254`),
  check('initial_owner_invitation_expiry', sql`${t.expiresAt} > ${t.createdAt}`),
]).enableRLS()

export const provisioningOperations = pagino.table('provisioning_operations', {
  idempotencyKey: uuid('idempotency_key').primaryKey(),
  institutionId: uuid('institution_id').notNull().unique().references(() => institutions.id),
  createdAt: createdAt(),
}).enableRLS()

export const operatorAuditLogs = pagino.table('operator_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id),
  action: text('action').notNull(),
  createdAt: createdAt(),
}).enableRLS()
