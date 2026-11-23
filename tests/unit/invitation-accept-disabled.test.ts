import { describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'
import acceptInvitation from '../../server/api/invitations/accept.post'

describe('initial owner acceptance HTTP safety gate', () => {
  it('keeps HTTP acceptance unavailable while the internal executor is integrated', async () => {
    await expect(async () => acceptInvitation({} as H3Event))
      .rejects.toMatchObject({ statusCode: 503 })
  })
  it('does not trust a caller-supplied identity or invitation token', async () => {
    const event = {
      context: { auth: { userId: 'forged-owner' } },
      node: { req: { headers: { authorization: 'Bearer forged-token' } } },
    } as unknown as H3Event
    await expect(async () => acceptInvitation(event))
      .rejects.toMatchObject({ statusCode: 503 })
  })
})
