import postgres from 'postgres'
import { AccessError } from '../auth/service'
import { assertSecureDatabaseUrl } from '../db/connection-security'

export async function withInvitationExecutor<T>(
  databaseUrl: string,
  operation: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  assertSecureDatabaseUrl(databaseUrl)
  const client = postgres(databaseUrl, {
    max: 1, prepare: false, connect_timeout: 5, connection: { role: 'invitation_acceptor' },
  })
  try {
    const { result } = await client.begin(async tx => {
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
      return { result: await operation(tx) }
    })
    return result
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
