import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

const url = process.env.PAGINO_TEST_DATABASE_URL
if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) || new URL(url).pathname !== '/pagino_test') throw new Error('Disposable local PostgreSQL required')
const db = postgres(url, { max: 2, prepare: false })
const migration = drizzle(db)
const owner = randomUUID()
const wrong = randomUUID()
const slug = 'owner-invite-' + randomUUID()
const token = randomBytes(32).toString('hex')
const digest = createHash('sha256').update(token).digest('hex')
let institution: string

beforeAll(async () => {
  await migrate(migration, { migrationsFolder: 'migrations' })
  await db`insert into pagino_auth."user" (id,name,email,email_verified) values (${owner},'Owner','invite-owner@example.test',true),(${wrong},'Wrong','invite-wrong@example.test',true)`
  const [created] = await db`insert into pagino.institutions (name,slug) values ('Invite Tenant',${slug}) returning id`
  institution = created!.id as string
  await db`insert into pagino.sites (institution_id) values (${institution})`
  await db`insert into pagino.initial_owner_invitations (institution_id,recipient_email,token_hash,encrypted_token,expires_at,delivery_status) values (${institution},'invite-owner@example.test',${digest},'encrypted',now()+interval '1 hour','sent')`
})
afterAll(async () => { await db.end() })

describe('atomic initial owner acceptance', () => {
  it('keeps the provisioning role non-login, non-superuser and without bypass RLS', async () => {
    const [role] = await db`select rolcanlogin, rolsuper, rolbypassrls, rolcreaterole from pg_roles where rolname = 'provision_operator'`
    expect(role).toMatchObject({ rolcanlogin: false, rolsuper: false, rolbypassrls: false, rolcreaterole: false })
    const [privileges] = await db`
      select
        has_table_privilege('provision_operator', 'pagino.institutions', 'INSERT') as can_create_institution,
        has_table_privilege('provision_operator', 'pagino.memberships', 'INSERT') as can_create_membership,
        has_table_privilege('provision_operator', 'pagino.initial_owner_invitations', 'INSERT') as can_create_invitation,
        has_function_privilege('provision_operator', 'pagino.accept_initial_owner_invitation(text,text)', 'EXECUTE') as can_accept
    `
    expect(privileges).toMatchObject({
      can_create_institution: true,
      can_create_membership: false,
      can_create_invitation: true,
      can_accept: false,
    })
  })

  it('provisions an institution atomically under the restricted operator role', async () => {
    const slug = 'operator-' + randomUUID()
    const key = randomUUID()
    const hash = createHash('sha256').update(randomBytes(32)).digest('hex')
    const created = await db.begin(async (tx) => {
      await tx`set local role provision_operator`
      const [institution] = await tx`insert into pagino.institutions (name, slug) values ('Operator Test', ${slug}) returning id`
      const id = institution!.id as string
      await tx`insert into pagino.sites (institution_id) values (${id})`
      await tx`insert into pagino.initial_owner_invitations (institution_id, recipient_email, token_hash, encrypted_token, expires_at) values (${id}, 'operator@example.test', ${hash}, 'encrypted', now() + interval '1 hour')`
      await tx`insert into pagino.provisioning_operations (idempotency_key, institution_id) values (${key}, ${id})`
      await tx`insert into pagino.operator_audit_logs (institution_id, action) values (${id}, 'institution.provisioned')`
      return id
    })
    const [institution] = await db`select id from pagino.institutions where id = ${created}`
    const [invitation] = await db`select delivery_status from pagino.initial_owner_invitations where institution_id = ${created}`
    const [audit] = await db`select action from pagino.operator_audit_logs where institution_id = ${created}`
    expect(institution?.id).toBe(created)
    expect(invitation?.delivery_status).toBe('pending')
    expect(audit?.action).toBe('institution.provisioned')
  })

  it('cannot create an owner membership while acting as the provision operator', async () => {
    await expect(db.begin(async (tx) => {
      await tx`set local role provision_operator`
      await tx`insert into pagino.memberships (institution_id, user_id, role, status) values (${institution}, ${owner}, 'owner', 'active')`
    })).rejects.toThrow()
    const [count] = await db`select count(*)::int as total from pagino.memberships where institution_id = ${institution} and user_id = ${owner}`
    expect(count?.total).toBe(0)
  })

  it('does not expose provisioned invitations to the application runtime', async () => {
    await expect(db.begin(async (tx) => {
      await tx`set local role app_runtime`
      await tx`select * from pagino.initial_owner_invitations`
    })).rejects.toThrow()
    await expect(db.begin(async (tx) => {
      await tx`set local role auth_runtime`
      await tx`select * from pagino.provisioning_operations`
    })).rejects.toThrow()
  })

  it('rolls back institution and site when the operator audit write fails', async () => {
    const slug = 'operator-rollback-' + randomUUID()
    await expect(db.begin(async (tx) => {
      await tx`set local role provision_operator`
      const [institution] = await tx`insert into pagino.institutions (name, slug) values ('Rollback Test', ${slug}) returning id`
      await tx`insert into pagino.sites (institution_id) values (${institution!.id})`
      // The operator audit policy allows only institution.provisioned.
      await tx`insert into pagino.operator_audit_logs (institution_id, action) values (${institution!.id}, 'unauthorized.action')`
    })).rejects.toThrow()
    const [remaining] = await db`select count(*)::int as total from pagino.institutions where slug = ${slug}`
    expect(remaining?.total).toBe(0)
  })

  it('denies SECURITY DEFINER acceptance to every non-privileged runtime role', async () => {
    for (const role of ['app_runtime', 'auth_runtime', 'public_reader', 'provision_operator']) {
      const [privilege] = await db`select has_function_privilege(${role}, 'pagino.accept_initial_owner_invitation(text,text)', 'EXECUTE') as allowed`
      expect(privilege?.allowed, role).toBe(false)
    }
    // Execute under the real database role, not only inspect the grant catalog.
    await expect(db.begin(async (tx) => {
      await tx`set local role auth_runtime`
      await tx`select pagino.accept_initial_owner_invitation(${owner}, ${digest})`
    })).rejects.toThrow()
    const [invite] = await db`select used_at from pagino.initial_owner_invitations where token_hash = ${digest}`
    expect(invite?.used_at).toBeNull()
  })

  it('enforces one invitation per institution and unique token hashes', async () => {
    const duplicateToken = createHash('sha256').update(randomBytes(32)).digest('hex')
    await expect(db`insert into pagino.initial_owner_invitations (institution_id,recipient_email,token_hash,encrypted_token,expires_at) values (${institution},'invite-owner@example.test',${duplicateToken},'encrypted',now()+interval '1 hour')`).rejects.toThrow()
    const other = randomUUID()
    await db`insert into pagino.institutions (id,name,slug) values (${other},'Duplicate Token Tenant',${'duplicate-token-' + other})`
    await expect(db`insert into pagino.initial_owner_invitations (institution_id,recipient_email,token_hash,encrypted_token,expires_at) values (${other},'invite-owner@example.test',${digest},'encrypted',now()+interval '1 hour')`).rejects.toThrow()
    const [count] = await db`select count(*)::int as total from pagino.initial_owner_invitations where institution_id = ${other}`
    expect(count?.total).toBe(0)
  })

  it('rejects invalid delivery states and non-normalized recipient addresses', async () => {
    const tenant = randomUUID()
    await db`insert into pagino.institutions (id,name,slug) values (${tenant},'Invalid Delivery Tenant',${'invalid-delivery-' + tenant})`
    const hash = createHash('sha256').update(randomBytes(32)).digest('hex')
    await expect(db`insert into pagino.initial_owner_invitations (institution_id,recipient_email,token_hash,encrypted_token,expires_at,delivery_status) values (${tenant},'invite-owner@example.test',${hash},'encrypted',now()+interval '1 hour','accepted')`).rejects.toThrow()
    await expect(db`insert into pagino.initial_owner_invitations (institution_id,recipient_email,token_hash,encrypted_token,expires_at) values (${tenant},'INVITE-OWNER@example.test',${hash},'encrypted',now()+interval '1 hour')`).rejects.toThrow()
    const [count] = await db`select count(*)::int as total from pagino.initial_owner_invitations where institution_id = ${tenant}`
    expect(count?.total).toBe(0)
  })

  it('rejects the wrong verified recipient and preserves the invitation', async () => {
    await expect(db`select pagino.accept_initial_owner_invitation(${wrong},${digest})`).rejects.toThrow()
    const [invite] = await db`select used_at from pagino.initial_owner_invitations where token_hash=${digest}`
    expect(invite!.used_at).toBeNull()
  })
  it('accepts once and atomically creates the correct membership', async () => {
    const [result] = await db`select pagino.accept_initial_owner_invitation(${owner},${digest}) as id`
    expect(result!.id).toBe(institution)
    const [membership] = await db`select role,status from pagino.memberships where institution_id=${institution} and user_id=${owner}`
    expect(membership).toMatchObject({ role: 'owner', status: 'active' })
    await expect(db`select pagino.accept_initial_owner_invitation(${owner},${digest})`).rejects.toThrow()
  })
  it('rejects an unverified matching identity without consuming its invitation', async () => {
    const unverified = randomUUID()
    const tenant = randomUUID()
    const hash = createHash('sha256').update(randomBytes(32)).digest('hex')
    await db`insert into pagino_auth."user" (id,name,email,email_verified) values (${unverified},'Unverified','unverified-invite@example.test',false)`
    await db`insert into pagino.institutions (id,name,slug) values (${tenant},'Unverified Tenant',${'unverified-' + tenant})`
    await db`insert into pagino.initial_owner_invitations (institution_id,recipient_email,token_hash,encrypted_token,expires_at,delivery_status) values (${tenant},'unverified-invite@example.test',${hash},'encrypted',now()+interval '1 hour','sent')`
    await expect(db`select pagino.accept_initial_owner_invitation(${unverified},${hash})`).rejects.toThrow()
    const [invite] = await db`select used_at from pagino.initial_owner_invitations where token_hash=${hash}`
    const [count] = await db`select count(*)::int as n from pagino.memberships where institution_id=${tenant}`
    expect(invite?.used_at).toBeNull()
    expect(count?.n).toBe(0)
  })

  it('rejects invitations not marked sent', async () => {
    const tenant = randomUUID()
    const hash = createHash('sha256').update(randomBytes(32)).digest('hex')
    await db`insert into pagino.institutions (id,name,slug) values (${tenant},'Undelivered Tenant',${'undelivered-' + tenant})`
    await db`insert into pagino.initial_owner_invitations (institution_id,recipient_email,token_hash,encrypted_token,expires_at,delivery_status) values (${tenant},'invite-owner@example.test',${hash},'encrypted',now()+interval '1 hour','failed')`
    await expect(db`select pagino.accept_initial_owner_invitation(${owner},${hash})`).rejects.toThrow()
    const [count] = await db`select count(*)::int as n from pagino.memberships where institution_id=${tenant}`
    expect(count?.n).toBe(0)
  })

  it('rejects expired tokens without creating memberships', async () => {
    const other = randomUUID()
    const otherToken = createHash('sha256').update(randomBytes(32)).digest('hex')
    await db`insert into pagino.institutions (id,name,slug) values (${other},'Expired Tenant',${'expired-' + other})`
    await db`insert into pagino.initial_owner_invitations (institution_id,recipient_email,token_hash,encrypted_token,expires_at,created_at,delivery_status) values (${other},'invite-wrong@example.test',${otherToken},'encrypted',now()-interval '1 minute',now()-interval '2 hours','sent')`
    await expect(db`select pagino.accept_initial_owner_invitation(${wrong},${otherToken})`).rejects.toThrow()
    const [count] = await db`select count(*)::int as n from pagino.memberships where institution_id=${other}`
    expect(count!.n).toBe(0)
  })
})
