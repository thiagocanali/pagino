import { describe, expect, it } from 'vitest'
import { acceptInitialOwnerInvitation } from '../../server/provisioning/accept'
import type { Authentication } from '../../server/auth/service'

describe('initial owner acceptance safety gate', () => {
  it('fails closed before invoking a database operation, even with an apparently valid token', async () => {
    const runtime = { domain: { execute: () => { throw new Error('Unsafe database function invoked') } } } as unknown as Authentication
    await expect(acceptInitialOwnerInvitation(runtime, new Headers({ cookie: 'session=forged' }), 'a'.repeat(64)))
      .rejects.toThrow('Invitation acceptance is disabled')
  })
})
