import { AccessError } from '../auth/service'
import type { Authentication } from '../auth/service'

/**
 * Fail closed until acceptance can bind a Better Auth session to the user
 * inside the privileged PostgreSQL transaction. The previous implementation
 * passed a user id to a SECURITY DEFINER function; do not restore it.
 *
 * The public HTTP endpoint is independently disabled (503).
 */
export async function acceptInitialOwnerInvitation(
  _runtime: Authentication,
  _headers: Headers,
  _token: unknown,
): Promise<never> {
  throw new AccessError(503)
}
