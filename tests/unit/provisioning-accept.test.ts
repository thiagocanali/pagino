import { describe, expect, it, vi } from 'vitest'
import { acceptInitialOwnerInvitation } from '../../server/provisioning/accept'
import type { Authentication } from '../../server/auth/service'

function runtime(execute: ReturnType<typeof vi.fn>) {
  return { domain: { execute } } as unknown as Authentication
}

describe('initial owner invitation acceptance boundary (disabled until DB-bound identity)', () => {
  it.each([
    ['malformed token', 'not-a-token'],
    ['well-formed token', 'a'.repeat(64)],
    ['different well-formed token', 'b'.repeat(64)],
  ])('fails closed for %s without database access', async (_label, token) => {
    const execute = vi.fn()
    await expect(acceptInitialOwnerInvitation(runtime(execute), new Headers(), token))
      .rejects.toThrow('Invitation acceptance is disabled')
    expect(execute).not.toHaveBeenCalled()
  })

  it('does not invoke the database even when the adapter would fail', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('DB_DOWN'))
    await expect(acceptInitialOwnerInvitation(runtime(execute), new Headers(), 'b'.repeat(64)))
      .rejects.toThrow('Invitation acceptance is disabled')
    expect(execute).not.toHaveBeenCalled()
  })
})
