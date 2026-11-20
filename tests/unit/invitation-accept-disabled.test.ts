import { describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'
import acceptInvitation from '../../server/api/invitations/accept.post'

describe('initial owner acceptance HTTP safety gate', () => {
  it('keeps HTTP acceptance unavailable while the internal executor is integrated', async () => {
    await expect(async () => acceptInvitation({} as H3Event))
      .rejects.toMatchObject({ statusCode: 503 })
  })
})
