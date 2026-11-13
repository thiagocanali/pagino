import { z } from 'zod'

/** Inputs accepted only by the restricted operational provisioning command. */
export const provisionInstitutionSchema = z.strictObject({
  name: z.string().trim().min(3).max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(60),
  ownerEmail: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  idempotencyKey: z.uuid(),
})

export const invitationTokenSchema = z.string().regex(/^[a-f0-9]{64}$/)

export function normalizeProvisionInput(value: unknown) {
  return provisionInstitutionSchema.parse(value)
}
