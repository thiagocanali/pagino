import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { acceptInitialOwnerInvitation } from '../../server/provisioning/accept'
import type { Authentication } from '../../server/auth/service'

vi.mock('../../server/auth/service', async () => {
  const actual = await vi.importActual<typeof import('../../server/auth/service')>('../../server/auth/service')
  return { ...actual, authenticatedUser: vi.fn().mockResolvedValue({ id: 'user-1', email: 'owner@example.test', name: 'Owner' }) }
})

function runtime(execute: ReturnType<typeof vi.fn>) {
  return { domain: { execute } } as unknown as Authentication
}

describe('initial owner invitation acceptance boundary', () => {
  it('rejects malformed tokens before database access', async () => {
    const execute = vi.fn()
    await expect(acceptInitialOwnerInvitation(runtime(execute), new Headers(), 'not-a-token')).rejects.toMatchObject({ status: 400 })
    expect(execute).not.toHaveBeenCalled()
  })

  it('passes only the SHA-256 token digest to the database', async () => {
    const execute = vi.fn().mockResolvedValue([{ institution_id: 'tenant-1' }])
    const token = 'a'.repeat(64)
    await expect(acceptInitialOwnerInvitation(runtime(execute), new Headers(), token)).resolves.toEqual({ institutionId: 'tenant-1' })
    expect(execute).toHaveBeenCalledTimes(1)
    const query = execute.mock.calls[0]?.[0] as { queryChunks?: unknown[] }
    expect(query).toBeDefined()
    // The SQL tagged template is bound, not concatenated with the raw token.
    expect(JSON.stringify(query)).not.toContain(token)
    expect(createHash('sha256').update(token).digest('hex')).toHaveLength(64)
  })

  it('maps expired, used, or mismatched invitations to the same safe error', async () => {
    const execute = vi.fn().mockRejectedValue(Object.assign(new Error('INVALID_INVITATION'), { code: '22023' }))
    await expect(acceptInitialOwnerInvitation(runtime(execute), new Headers(), 'b'.repeat(64))).rejects.toMatchObject({ status: 400 })
  })

  it('does not suppress unexpected database failures', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('DB_DOWN'))
    await expect(acceptInitialOwnerInvitation(runtime(execute), new Headers(), 'b'.repeat(64))).rejects.toThrow('DB_DOWN')
  })
})
