import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { authenticatedUser, AccessError } from '../auth/service'
import type { Authentication } from '../auth/service'
import { invitationTokenSchema } from '../../shared/schemas/provisioning'

/**
 * The caller must have a current verified Better Auth session.
 * The database function validates recipient, expiry, replay and membership atomically.
 */
export async function acceptInitialOwnerInvitation(runtime: Authentication, headers: Headers, token: unknown) {
  const parsed = invitationTokenSchema.safeParse(token)
  if (!parsed.success) throw new AccessError(400)
  const user = await authenticatedUser(runtime, headers)
  const digest = createHash('sha256').update(parsed.data).digest('hex')
  try {
    const rows = await runtime.domain.execute(sql`select pagino.accept_initial_owner_invitation(${user.id}, ${digest}) as institution_id`)
    const id = rows[0]?.institution_id
    if (typeof id !== 'string') throw new Error('Invitation acceptance returned no institution')
    return { institutionId: id }
  }
  catch (error) {
    if ((error as { code?: string }).code === '22023') throw new AccessError(400)
    throw error
  }
}
