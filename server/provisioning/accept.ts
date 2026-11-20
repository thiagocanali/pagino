import { createHash } from 'node:crypto'
import postgres from 'postgres'
import { AccessError, type Authentication } from '../auth/service'
import { assertSecureDatabaseUrl } from '../db/connection-security'

export async function acceptInitialOwnerInvitation(
  runtime: Authentication,
  headers: Headers,
  token: unknown,
  databaseUrl: string,
): Promise<{ institutionId: string }> {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) throw new AccessError(400)
  const session = await runtime.auth.api.getSession({ headers, query: { disableCookieCache: true } })
  if (!session?.session.token) throw new AccessError(401)
  if (!session.user.emailVerified) throw new AccessError(403)

  const digest = createHash('sha256').update(token).digest('hex')
  assertSecureDatabaseUrl(databaseUrl)
  const client = postgres(databaseUrl, {
    max: 1, prepare: false, connect_timeout: 5, connection: { role: 'invitation_acceptor' },
  })
  try {
    return await client.begin(async tx => {
      const [role] = await tx`
        select current_user = 'invitation_acceptor'
          and session_user = 'invitation_acceptor_login'
          and not active.rolcanlogin and login.rolcanlogin and not login.rolinherit
          and not (active.rolsuper or active.rolbypassrls or active.rolcreaterole or active.rolcreatedb)
          and not (login.rolsuper or login.rolbypassrls or login.rolcreaterole or login.rolcreatedb)
          and (
            select count(*) = 1 and bool_and(m.roleid = active.oid and m.set_option and not m.inherit_option)
            from pg_auth_members m where m.member = login.oid
          ) as allowed
        from pg_roles active, pg_roles login
        where active.rolname = current_user and login.rolname = session_user
      `
      if (role?.allowed !== true) throw new Error('Restricted invitation executor required')
      const [result] = await tx<{ institution_id: string }[]>`
        select pagino.accept_initial_owner_invitation_for_session(${session.session.token}, ${digest})
          as institution_id
      `
      if (!result?.institution_id) throw new Error('Invitation acceptance did not return an institution')
      return { institutionId: result.institution_id }
    })
  }
  catch (error) {
    if (error instanceof postgres.PostgresError && error.code === '22023' && error.message === 'INVALID_INVITATION') {
      throw new AccessError(400)
    }
    // Database error details may contain credentials or query parameters.
    // eslint-disable-next-line preserve-caught-error
    throw new Error('Invitation acceptance unavailable')
  }
  finally {
    await client.end({ timeout: 1 })
  }
}
