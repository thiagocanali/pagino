import { describe, expect, it } from 'vitest'
import { can, roles, type Permission } from '../../shared/auth/permissions'
import { loginSchema } from '../../shared/schemas/login'

describe('permission contract', () => {
  const expected: Record<Permission, readonly boolean[]> = {
    'content.read': [true, true, true, true],
    'content.write': [true, true, true, false],
    'site.publish': [true, true, false, false],
    'audit.read': [true, true, false, false],
    'institution.update': [true, true, false, false],
    'membership.manage_limited': [true, true, false, false],
    'membership.manage_admin': [true, false, false, false],
    'membership.transfer_owner': [true, false, false, false],
  }
  for (const [permission, values] of Object.entries(expected)) {
    it(`checks every role for ${permission}`, () => {
      expect(roles.map(role => can(role, permission as Permission))).toEqual(values)
      expect(can('platform-admin', permission as Permission)).toBe(false)
    })
  }
})

describe('login boundary', () => {
  it('normalizes email while preserving meaningful password whitespace', () => {
    expect(loginSchema.parse({ email: 'USER@example.test', password: ' password with spaces ' })).toEqual({ email: 'user@example.test', password: ' password with spaces ' })
  })
  it.each([{ email: 'bad', password: 'x' }, { email: 'a@example.test', password: '' }, { email: 'a@example.test', password: 'a'.repeat(129) }, { email: 'a@example.test', password: 'ok', role: 'owner' }])('rejects invalid credentials shape', input => expect(loginSchema.safeParse(input).success).toBe(false))
})
