import { describe, expect, it, vi } from 'vitest'
import type { Authentication } from '../../server/auth/service'
import { registerInvitedOwner } from '../../server/provisioning/register'

const valid = { token: 'a'.repeat(64), email: 'owner@example.test', name: 'Owner', password: 'valid-password-123' }

describe('invited credential registration boundaries', () => {
  it.each([
    { ...valid, token: 'not-a-token' },
    { ...valid, email: 'invalid' },
    { ...valid, name: ' ' },
    { ...valid, password: 'short' },
    { ...valid, password: 'a'.repeat(129) },
    { ...valid, role: 'owner' },
    { ...valid, emailVerified: true },
    { ...valid, institutionId: 'client-chosen-tenant' },
  ])('rejects malformed or privilege-bearing input before persistence %#', async input => {
    const transaction = vi.fn()
    const runtime = { mailEnabled: true, db: { transaction } } as unknown as Authentication
    await expect(registerInvitedOwner(runtime, input, '')).rejects.toMatchObject({ status: 400 })
    expect(transaction).not.toHaveBeenCalled()
  })

  it('keeps registration unavailable without a verification mail transport', async () => {
    const transaction = vi.fn()
    const runtime = { mailEnabled: false, db: { transaction } } as unknown as Authentication
    await expect(registerInvitedOwner(runtime, valid, '')).rejects.toMatchObject({ status: 503 })
    expect(transaction).not.toHaveBeenCalled()
  })
})
