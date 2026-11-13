import { defineEventHandler, createError } from 'h3'

/**
 * Explicitly disabled until a database-verified session identity is available
 * to the privileged membership-creation transaction. See TASK 04-C / PR #12.
 * Never call a SECURITY DEFINER function using only a caller-provided user id.
 */
export default defineEventHandler(() => {
  throw createError({ statusCode: 503, statusMessage: 'Invitation onboarding is not enabled yet' })
})
