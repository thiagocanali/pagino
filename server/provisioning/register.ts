import { createHash, randomUUID } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { z } from 'zod'
import { AccessError, type Authentication } from '../auth/service'
import { account, user } from '../db/auth-schema'
import { invitationTokenSchema } from '../../shared/schemas/provisioning'
import { withInvitationExecutor } from './executor'

const registrationSchema = z.strictObject({
  token: invitationTokenSchema,
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(128),
})

/** Register credentials only. Verification and membership use their own existing flows. */
export async function registerInvitedOwner(runtime: Authentication, input: unknown, databaseUrl: string): Promise<void> {
  const parsed = registrationSchema.safeParse(input)
  if (!parsed.success) throw new AccessError(400)
  if (!runtime.mailEnabled) throw new AccessError(503)
  const { email, token, name, password } = parsed.data
  const digest = createHash('sha256').update(token).digest('hex')
  const eligible = await withInvitationExecutor(databaseUrl, async tx => {
    const [result] = await tx`
      select pagino.can_register_initial_owner(${digest}, ${email}) as eligible
    `
    return result?.eligible === true
  })
  if (!eligible) throw new AccessError(400)

  const hashed = await hashPassword(password)
  await runtime.db.transaction(async tx => {
    const id = randomUUID()
    const [created] = await tx.insert(user).values({ id, email, name, emailVerified: false })
      .onConflictDoNothing({ target: user.email }).returning({ id: user.id })
    if (!created) return
    await tx.insert(account).values({
      id: randomUUID(), userId: id, accountId: id, providerId: 'credential', password: hashed, updatedAt: new Date(),
    })
  })
}
