import { createHash } from 'node:crypto'
import { AccessError, type Authentication } from '../auth/service'
import { invitationTokenSchema } from '../../shared/schemas/provisioning'
import { withInvitationExecutor } from './executor'

export async function acceptInitialOwnerInvitation(
  runtime: Authentication,
  headers: Headers,
  token: unknown,
  databaseUrl: string,
): Promise<{ institutionId: string }> {
  const parsed = invitationTokenSchema.safeParse(token)
  if (!parsed.success) throw new AccessError(400)
  const session = await runtime.auth.api.getSession({ headers, query: { disableCookieCache: true } })
  if (!session?.session.token) throw new AccessError(401)
  if (!session.user.emailVerified) throw new AccessError(403)

  const digest = createHash('sha256').update(parsed.data).digest('hex')
  return withInvitationExecutor(databaseUrl, async tx => {
    const [result] = await tx<{ institution_id: string }[]>`
      select pagino.accept_initial_owner_invitation_for_session(${session.session.token}, ${digest})
        as institution_id
    `
    if (!result?.institution_id) throw new Error('Invitation acceptance did not return an institution')
    return { institutionId: result.institution_id }
  })
}
