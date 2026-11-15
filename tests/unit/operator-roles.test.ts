import { describe, expect, it } from 'vitest'
import { assertRestrictedOperator } from '../../server/provisioning/operator-roles'

const operator = { name: 'provision_operator', rolcanlogin: false, rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false }
const login = { ...operator, name: 'pagino_operator_login', rolcanlogin: true }

describe('operator identity checks', () => {
  it('accepts a restricted NOLOGIN operator behind a restricted login', () => {
    expect(() => assertRestrictedOperator(operator, login)).not.toThrow()
  })
  it('rejects missing or wrong active role', () => {
    expect(() => assertRestrictedOperator(undefined, login)).toThrow()
    expect(() => assertRestrictedOperator({ ...operator, name: 'app_runtime' }, login)).toThrow()
    expect(() => assertRestrictedOperator({ ...operator, rolcanlogin: true }, login)).toThrow()
  })
  it.each(['rolsuper', 'rolbypassrls', 'rolcreaterole', 'rolcreatedb'] as const)('rejects %s on either identity', privilege => {
    expect(() => assertRestrictedOperator({ ...operator, [privilege]: true }, login)).toThrow()
    expect(() => assertRestrictedOperator(operator, { ...login, [privilege]: true })).toThrow()
  })
  it('rejects missing login role', () => {
    expect(() => assertRestrictedOperator(operator, undefined)).toThrow()
  })
})
