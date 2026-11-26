import { describe, expect, it } from 'vitest'
import { normalizeProvisionInput, invitationTokenSchema } from '../../shared/schemas/provisioning'

const valid = { name: 'Instituto Vida', slug: 'instituto-vida', ownerEmail: 'owner@example.org', idempotencyKey: '4b7b9f77-f5f7-49e8-a1a5-184bf29adac7' }

describe('provisioning input boundaries', () => {
  it('normalizes owner email and institution name', () => {
    const parsed = normalizeProvisionInput({ ...valid, name: ' Instituto Vida ', ownerEmail: ' OWNER@EXAMPLE.ORG ' })
    expect(parsed.name).toBe('Instituto Vida')
    expect(parsed.ownerEmail).toBe('owner@example.org')
  })
  it.each([
    { ...valid, slug: '../another-tenant' },
    { ...valid, slug: 'UPPERCASE' },
    { ...valid, slug: 'ab' },
    { ...valid, name: '' },
    { ...valid, ownerEmail: 'invalid' },
    { ...valid, idempotencyKey: 'not-a-uuid' },
    { ...valid, role: 'owner' },
  ])('rejects invalid or privilege-bearing input %#', input => {
    expect(() => normalizeProvisionInput(input)).toThrow()
  })
  it('accepts only 32-byte lowercase hex tokens', () => {
    expect(invitationTokenSchema.safeParse('a'.repeat(64)).success).toBe(true)
    expect(invitationTokenSchema.safeParse('A'.repeat(64)).success).toBe(false)
    expect(invitationTokenSchema.safeParse('a'.repeat(63)).success).toBe(false)
  })
})
