import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { provisionInstitution } from '../../server/provisioning/operator'

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

  it('limits invitation eligibility lookup to the dedicated executor without granting account access', async () => {
    for (const role of ['app_runtime', 'auth_runtime', 'public_reader', 'provision_operator']) {
      const [privilege] = await db`
        select has_function_privilege(${role}, 'pagino.can_register_initial_owner(text,text)', 'EXECUTE') as allowed
      `
      expect(privilege?.allowed, role).toBe(false)
    }
    await db.begin(async tx => {
      await tx`set local role invitation_acceptor`
      const [eligibility] = await tx`
        select pagino.can_register_initial_owner(${digest}, 'invite-owner@example.test') as eligible,
          pagino.can_register_initial_owner(${digest}, 'invite-wrong@example.test') as wrong_recipient
      `
      expect(eligibility).toMatchObject({ eligible: true, wrong_recipient: false })
      await expect(tx.savepoint(sp => sp`select * from pagino_auth."user"`)).rejects.toThrow()
      await expect(tx.savepoint(sp => sp`select * from pagino.initial_owner_invitations`)).rejects.toThrow()
    })
  })


  it('binds acceptance to a valid database session and grants only the session entry point', async () => {
    const [privileges] = await db`
      select
        has_function_privilege('invitation_acceptor', 'pagino.accept_initial_owner_invitation_for_session(text,text)', 'EXECUTE') as can_accept,
        has_function_privilege('invitation_acceptor', 'pagino.accept_initial_owner_invitation(text,text)', 'EXECUTE') as can_accept_by_id,
        has_table_privilege('invitation_acceptor', 'pagino_auth.session', 'SELECT') as can_read_sessions,
        has_table_privilege('invitation_acceptor', 'pagino.memberships', 'INSERT') as can_create_memberships
    `
    expect(privileges).toMatchObject({
      can_accept: true,
      can_accept_by_id: false,
      can_read_sessions: false,
      can_create_memberships: false,
    })
    const [runtime] = await db`
      select bool_or(has_function_privilege(role_name, 'pagino.accept_initial_owner_invitation_for_session(text,text)', 'EXECUTE')) as can_accept
      from unnest(array['app_runtime', 'auth_runtime', 'public_reader', 'provision_operator']::text[]) as roles(role_name)
    `
    expect(runtime).toMatchObject({ can_accept: false })

    const active = randomUUID()
    const expired = randomUUID()
    const other = randomUUID()
    const rollback = new Error('Roll back session acceptance fixture')
    await expect(db.begin(async tx => {
      await tx`
        insert into pagino_auth.session (id, token, user_id, expires_at, updated_at)
        values
          (${randomUUID()}, ${active}, ${owner}, now() + interval '1 hour', now()),
          (${randomUUID()}, ${expired}, ${owner}, now() - interval '1 hour', now()),
          (${randomUUID()}, ${other}, ${wrong}, now() + interval '1 hour', now())
      `
      await tx`set local role invitation_acceptor`
      for (const candidate of [owner, expired, other]) {
        await expect(tx.savepoint(sp => sp`
          select pagino.accept_initial_owner_invitation_for_session(${candidate}, ${digest})
        `)).rejects.toMatchObject({ code: '22023' })
      }
      const [accepted] = await tx`
        select pagino.accept_initial_owner_invitation_for_session(${active}, ${digest}) as institution_id
      `
      expect(accepted?.institution_id).toBe(institution)
      await tx`reset role`
      const [membership] = await tx`
        select user_id, role from pagino.memberships where institution_id = ${institution}
      `
      expect(membership).toMatchObject({ user_id: owner, role: 'owner' })
      throw rollback
    })).rejects.toBe(rollback)
  })

  it('keeps the provisioning role non-login, non-superuser and without bypass RLS', async () => {
    const [role] = await db`select rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb from pg_roles where rolname = 'provision_operator'`
    expect(role).toMatchObject({ rolcanlogin: false, rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false })
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

  it('delegates SET ROLE only to a non-inheriting, unprivileged login', async () => {
    const [login] = await db`select rolcanlogin, rolinherit, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb from pg_roles where rolname = 'provision_operator_login'`
    expect(login).toMatchObject({ rolcanlogin: true, rolinherit: false, rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false })
    const [membership] = await db`select pg_has_role('provision_operator_login', 'provision_operator', 'MEMBER') as member, pg_has_role('provision_operator_login', 'provision_operator', 'SET') as can_set`
    expect(membership).toMatchObject({ member: true, can_set: true })
    const [privileges] = await db`select has_table_privilege('provision_operator_login', 'pagino.memberships', 'INSERT') as can_create_membership, has_function_privilege('provision_operator_login', 'pagino.accept_initial_owner_invitation(text,text)', 'EXECUTE') as can_accept`
    expect(privileges).toMatchObject({ can_create_membership: false, can_accept: false })
  })

  it('keeps runtime logins NOINHERIT and grants only SET ROLE to their runtime identities', async () => {
    const [logins] = await db`
      select
        (select rolcanlogin and not rolinherit and not rolsuper and not rolcreatedb and not rolcreaterole and not rolbypassrls from pg_roles where rolname = 'app_runtime_login') as app_login_safe,
        (select rolcanlogin and not rolinherit and not rolsuper and not rolcreatedb and not rolcreaterole and not rolbypassrls from pg_roles where rolname = 'auth_runtime_login') as auth_login_safe,
        pg_has_role('app_runtime_login', 'app_runtime', 'SET') as app_can_set,
        pg_has_role('auth_runtime_login', 'auth_runtime', 'SET') as auth_can_set,
        pg_has_role('app_runtime_login', 'auth_runtime', 'MEMBER') as app_is_auth_member,
        pg_has_role('auth_runtime_login', 'app_runtime', 'MEMBER') as auth_is_app_member
    `
    expect(logins).toMatchObject({ app_login_safe: true, auth_login_safe: true, app_can_set: true, auth_can_set: true, app_is_auth_member: false, auth_is_app_member: false })
  })

  it('grants the dedicated operator login no other PostgreSQL role memberships', async () => {
    const grants = await db`
      select granted.rolname as name, membership.inherit_option as inherits, membership.set_option as can_set
      from pg_auth_members membership
      join pg_roles granted on granted.oid = membership.roleid
      where membership.member = (select oid from pg_roles where rolname = 'provision_operator_login')
    `
    expect(grants).toEqual([{ name: 'provision_operator', inherits: false, can_set: true }])
  })

  it('restricts app and auth logins to exactly their own SET-only membership', async () => {
    for (const [login, expected] of [
      ['app_runtime_login', 'app_runtime'],
      ['auth_runtime_login', 'auth_runtime'],
    ] as const) {
      const grants = await db`
        select granted.rolname as name, membership.inherit_option as inherits, membership.set_option as can_set
        from pg_auth_members membership
        join pg_roles granted on granted.oid = membership.roleid
        where membership.member = (select oid from pg_roles where rolname = ${login})
      `
      expect(grants).toEqual([{ name: expected, inherits: false, can_set: true }])
    }
  })

  it('authenticates as the dedicated operator login and assumes only the NOLOGIN role on connection', async () => {
    const password = randomBytes(24).toString('hex')
    // Disposable local PostgreSQL only; no real secrets or remote roles are modified.
    await db.unsafe(`alter role provision_operator_login password '${password}'`)
    const restrictedUrl = new URL(url!)
    restrictedUrl.username = 'provision_operator_login'
    restrictedUrl.password = password
    const operatorClient = postgres(restrictedUrl.href, {
      max: 1, prepare: false, connection: { role: 'provision_operator' },
    })
    try {
      const [identity] = await operatorClient`select current_user as active, session_user as login`
      expect(identity).toMatchObject({ active: 'provision_operator', login: 'provision_operator_login' })
      const [roles] = await operatorClient`select current_user = 'provision_operator' as restricted`
      expect(roles?.restricted).toBe(true)
      await expect(operatorClient`select * from pagino_auth."user"`).rejects.toThrow()
      await expect(operatorClient`insert into pagino.memberships (institution_id,user_id,role,status) values (${institution},${owner},'owner','active')`).rejects.toThrow()
    }
    finally { await operatorClient.end() }
  })

  it('delivers an idempotent invitation only once under concurrent operator calls', async () => {
    const password = randomBytes(24).toString('hex')
    await db.unsafe(`alter role provision_operator_login password '${password}'`)
    const operatorUrl = new URL(url!)
    operatorUrl.username = 'provision_operator_login'
    operatorUrl.password = password
    const idempotencyKey = randomUUID()
    const slug = 'delivery-concurrent-' + randomUUID()
    const input = { name: 'Concurrent Mail Tenant', slug, ownerEmail: 'mail-concurrent@example.test', idempotencyKey }
    const delivered: string[] = []
    const options = {
      databaseUrl: operatorUrl.href,
      appOrigin: 'http://localhost:3000',
      encryptionSecret: randomBytes(32).toString('hex'),
      mail: {
        async send(message: { to: string; subject: string; text: string }) {
          delivered.push(message.to)
          await new Promise(resolve => setTimeout(resolve, 80))
        },
      },
    }
    const [first, second] = await Promise.all([
      provisionInstitution(options, input),
      provisionInstitution(options, input),
    ])
    expect(first).toEqual(second)
    expect(first.deliveryStatus).toBe('sent')
    expect(delivered).toEqual(['mail-concurrent@example.test'])
    const [institution] = await db`select count(*)::int as total from pagino.institutions where slug = ${slug}`
    const [audit] = await db`select count(*)::int as total from pagino.operator_audit_logs where action = 'institution.provisioned' and institution_id = ${first.institutionId}`
    expect(institution?.total).toBe(1)
    expect(audit?.total).toBe(1)
  })

  it('retries failed delivery without creating a second institution or invitation', async () => {
    const password = randomBytes(24).toString('hex')
    await db.unsafe(`alter role provision_operator_login password '${password}'`)
    const operatorUrl = new URL(url!)
    operatorUrl.username = 'provision_operator_login'
    operatorUrl.password = password
    const idempotencyKey = randomUUID()
    const slug = 'delivery-retry-' + randomUUID()
    const input = { name: 'Retry Mail Tenant', slug, ownerEmail: 'mail-retry@example.test', idempotencyKey }
    let attempts = 0
    const options = {
      databaseUrl: operatorUrl.href,
      appOrigin: 'http://localhost:3000',
      encryptionSecret: randomBytes(32).toString('hex'),
      mail: {
        async send() {
          attempts++
          if (attempts === 1) throw new Error('Simulated transport failure')
        },
      },
    }
    await expect(provisionInstitution(options, input)).rejects.toThrow('Invitation delivery failed')
    const [failed] = await db`select v.delivery_status from pagino.initial_owner_invitations v join pagino.institutions i on i.id = v.institution_id where i.slug = ${slug}`
    expect(failed?.delivery_status).toBe('failed')
    const success = await provisionInstitution(options, input)
    expect(success.deliveryStatus).toBe('sent')
    expect(attempts).toBe(2)
    const [counts] = await db`
      select (select count(*)::int from pagino.institutions where slug = ${slug}) as institutions,
        (select count(*)::int from pagino.initial_owner_invitations where institution_id = ${success.institutionId}) as invitations,
        (select count(*)::int from pagino.operator_audit_logs where institution_id = ${success.institutionId}) as audits
    `
    expect(counts).toMatchObject({ institutions: 1, invitations: 1, audits: 1 })
  })

  it('rejects a reused idempotency key with changed tenant or recipient without sending mail', async () => {
    const password = randomBytes(24).toString('hex')
    await db.unsafe(`alter role provision_operator_login password '${password}'`)
    const operatorUrl = new URL(url!)
    operatorUrl.username = 'provision_operator_login'
    operatorUrl.password = password
    const idempotencyKey = randomUUID()
    const input = { name: 'Idempotency Guard Tenant', slug: 'idempotency-' + randomUUID(), ownerEmail: 'original-guard@example.test', idempotencyKey }
    let sent = 0
    const options = {
      databaseUrl: operatorUrl.href,
      appOrigin: 'http://localhost:3000',
      encryptionSecret: randomBytes(32).toString('hex'),
      mail: { async send() { sent++ } },
    }
    const first = await provisionInstitution(options, input)
    expect(first.deliveryStatus).toBe('sent')
    for (const changed of [
      { ...input, ownerEmail: 'different-guard@example.test' },
      { ...input, name: 'Changed Tenant Name' },
      { ...input, slug: 'different-' + randomUUID() },
    ]) {
      await expect(provisionInstitution(options, changed)).rejects.toThrow('Idempotency key reused with different input')
    }
    expect(sent).toBe(1)
    const [counts] = await db`
      select (select count(*)::int from pagino.provisioning_operations where idempotency_key = ${idempotencyKey}) as operations,
        (select count(*)::int from pagino.initial_owner_invitations where institution_id = ${first.institutionId}) as invitations
    `
    expect(counts).toMatchObject({ operations: 1, invitations: 1 })
  })

  it('does not resend or mutate an expired invitation during retry', async () => {
    const password = randomBytes(24).toString('hex')
    await db.unsafe(`alter role provision_operator_login password '${password}'`)
    const operatorUrl = new URL(url!)
    operatorUrl.username = 'provision_operator_login'
    operatorUrl.password = password
    const idempotencyKey = randomUUID()
    const slug = 'expired-retry-' + randomUUID()
    const input = { name: 'Expired Retry Tenant', slug, ownerEmail: 'expired-retry@example.test', idempotencyKey }
    let sends = 0
    const options = {
      databaseUrl: operatorUrl.href,
      appOrigin: 'http://localhost:3000',
      encryptionSecret: randomBytes(32).toString('hex'),
      mail: { async send() { sends++; throw new Error('Simulated delivery failure') } },
    }
    await expect(provisionInstitution(options, input)).rejects.toThrow('Invitation delivery failed')
    const [existing] = await db`select v.id from pagino.initial_owner_invitations v join pagino.institutions i on i.id=v.institution_id where i.slug=${slug}`
    await db`update pagino.initial_owner_invitations set created_at = now() - interval '2 minutes', expires_at = now() - interval '1 minute' where id = ${existing!.id}`
    await expect(provisionInstitution(options, input)).rejects.toThrow('Invitation expired')
    expect(sends).toBe(1)
    const [after] = await db`select delivery_status,used_at from pagino.initial_owner_invitations where id=${existing!.id}`
    expect(after).toMatchObject({ delivery_status: 'failed', used_at: null })
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

  it('allows the restricted operator to mark a pending invitation as sent', async () => {
    const slug = 'delivery-' + randomUUID()
    const hash = createHash('sha256').update(randomBytes(32)).digest('hex')
    const tenant = await db.begin(async (tx) => {
      await tx`set local role provision_operator`
      const [row] = await tx`insert into pagino.institutions (name, slug) values ('Delivery Test', ${slug}) returning id`
      await tx`insert into pagino.initial_owner_invitations (institution_id, recipient_email, token_hash, encrypted_token, expires_at) values (${row!.id}, 'delivery@example.test', ${hash}, 'encrypted', now() + interval '1 hour')`
      await tx`update pagino.initial_owner_invitations set delivery_status = 'sent' where institution_id = ${row!.id} and used_at is null`
      return row!.id as string
    })
    const [row] = await db`select delivery_status from pagino.initial_owner_invitations where institution_id = ${tenant}`
    expect(row?.delivery_status).toBe('sent')
  })

  it('denies the operator from changing invitation recipient or token', async () => {
    const slug = 'immutable-' + randomUUID()
    const hash = createHash('sha256').update(randomBytes(32)).digest('hex')
    const tenant = await db.begin(async (tx) => {
      await tx`set local role provision_operator`
      const [row] = await tx`insert into pagino.institutions (name, slug) values ('Immutable Invite', ${slug}) returning id`
      await tx`insert into pagino.initial_owner_invitations (institution_id, recipient_email, token_hash, encrypted_token, expires_at) values (${row!.id}, 'original@example.test', ${hash}, 'encrypted', now() + interval '1 hour')`
      return row!.id as string
    })
    await expect(db.begin(async (tx) => {
      await tx`set local role provision_operator`
      await tx`update pagino.initial_owner_invitations set recipient_email = 'attacker@example.test' where institution_id = ${tenant}`
    })).rejects.toThrow()
    for (const [column, value] of [['token_hash', '0'.repeat(64)], ['encrypted_token', 'forged']] as const) {
      await expect(db.begin(async (tx) => {
        await tx`set local role provision_operator`
        await tx.unsafe(`update pagino.initial_owner_invitations set ${column} = $1 where institution_id = $2`, [value, tenant])
      })).rejects.toThrow()
    }
    const [row] = await db`select recipient_email, token_hash, encrypted_token from pagino.initial_owner_invitations where institution_id = ${tenant}`
    expect(row).toMatchObject({ recipient_email: 'original@example.test', token_hash: hash, encrypted_token: 'encrypted' })
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

  it('rejects invalid and expired token digests without consuming the invitation', async () => {
    for (const invalid of ['', '0'.repeat(63), 'G'.repeat(64), '0'.repeat(65)]) {
      await expect(db`select pagino.accept_initial_owner_invitation(${owner}, ${invalid})`).rejects.toThrow()
    }
    const [invite] = await db`select used_at from pagino.initial_owner_invitations where token_hash = ${digest}`
    expect(invite?.used_at).toBeNull()
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

  it('does not create a second owner when accepting a reused token', async () => {
    const [membership] = await db`select count(*)::int as total from pagino.memberships where institution_id = ${institution} and user_id = ${owner}`
    expect(membership?.total).toBe(1)
    await expect(db`select pagino.accept_initial_owner_invitation(${owner}, ${digest})`).rejects.toThrow()
    const [after] = await db`select count(*)::int as total from pagino.memberships where institution_id = ${institution} and user_id = ${owner}`
    expect(after?.total).toBe(1)
  })

  it('serializes concurrent redemption of the same invitation without duplicate owners or audits', async () => {
    const tenant = randomUUID()
    const concurrentHash = createHash('sha256').update(randomBytes(32)).digest('hex')
    await db`insert into pagino.institutions (id,name,slug) values (${tenant},'Concurrent Tenant',${'concurrent-' + tenant})`
    await db`insert into pagino.initial_owner_invitations (institution_id,recipient_email,token_hash,encrypted_token,expires_at,delivery_status) values (${tenant},'invite-owner@example.test',${concurrentHash},'encrypted',now()+interval '1 hour','sent')`
    const attempts = await Promise.allSettled([
      db`select pagino.accept_initial_owner_invitation(${owner},${concurrentHash}) as id`,
      db`select pagino.accept_initial_owner_invitation(${owner},${concurrentHash}) as id`,
    ])
    expect(attempts.filter(attempt => attempt.status === 'fulfilled')).toHaveLength(1)
    expect(attempts.filter(attempt => attempt.status === 'rejected')).toHaveLength(1)
    const [membership] = await db`select count(*)::int as total from pagino.memberships where institution_id=${tenant} and user_id=${owner} and role='owner'`
    const [audit] = await db`select count(*)::int as total from pagino.audit_logs where institution_id=${tenant} and action='institution.owner_accepted'`
    const [invitation] = await db`select used_at, encrypted_token from pagino.initial_owner_invitations where institution_id=${tenant}`
    expect(membership?.total).toBe(1)
    expect(audit?.total).toBe(1)
    expect(invitation?.used_at).not.toBeNull()
    expect(invitation?.encrypted_token).toBe('')
  })

  it('rolls back invitation consumption if the recipient already has a membership', async () => {
    const tenant = randomUUID()
    const collisionHash = createHash('sha256').update(randomBytes(32)).digest('hex')
    await db`insert into pagino.institutions (id,name,slug) values (${tenant},'Existing Membership Tenant',${'existing-' + tenant})`
    await db`insert into pagino.memberships (institution_id,user_id,role,status) values (${tenant},${owner},'viewer','active')`
    await db`insert into pagino.initial_owner_invitations (institution_id,recipient_email,token_hash,encrypted_token,expires_at,delivery_status) values (${tenant},'invite-owner@example.test',${collisionHash},'encrypted',now()+interval '1 hour','sent')`
    await expect(db`select pagino.accept_initial_owner_invitation(${owner},${collisionHash})`).rejects.toThrow()
    const [membership] = await db`select role from pagino.memberships where institution_id=${tenant} and user_id=${owner}`
    const [invitation] = await db`select used_at,encrypted_token from pagino.initial_owner_invitations where institution_id=${tenant}`
    const [audit] = await db`select count(*)::int as total from pagino.audit_logs where institution_id=${tenant} and action='institution.owner_accepted'`
    expect(membership?.role).toBe('viewer')
    expect(invitation?.used_at).toBeNull()
    expect(invitation?.encrypted_token).toBe('encrypted')
    expect(audit?.total).toBe(0)
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
