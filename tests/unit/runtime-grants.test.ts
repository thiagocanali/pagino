import { describe, expect, it } from 'vitest'
import { assertExclusiveRuntimeGrant } from '../../server/auth/runtime-grants'

describe('runtime login grants', () => {
  it.each(['auth_runtime', 'app_runtime'] as const)('accepts exactly one SET-only %s membership', expected => {
    expect(() => assertExclusiveRuntimeGrant([{ name: expected, inherits: false, can_set: true }], expected)).not.toThrow()
  })
  it.each(['auth_runtime', 'app_runtime'] as const)('rejects unrelated or additional memberships for %s', expected => {
    const valid = { name: expected, inherits: false, can_set: true }
    for (const grants of [
      [],
      undefined,
      {},
      [valid, { name: 'pg_read_all_data', inherits: false, can_set: true }],
      [{ ...valid, name: expected === 'auth_runtime' ? 'app_runtime' : 'auth_runtime' }],
      [{ ...valid, inherits: true }],
      [{ ...valid, can_set: false }],
      [{ ...valid, inherits: undefined }],
      [{ ...valid, can_set: 'true' }],
    ]) expect(() => assertExclusiveRuntimeGrant(grants, expected)).toThrow()
  })
})
