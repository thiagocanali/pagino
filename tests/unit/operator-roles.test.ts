import { describe, expect, it } from 'vitest'
import { assertRestrictedOperator, parseRole } from '../../server/provisioning/operator-roles'

const operator = { name: 'provision_operator', rolcanlogin: false, rolinherit: true, rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false }
const login = { ...operator, name: 'provision_operator_login', rolcanlogin: true, rolinherit: false }

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
  it('rejects a login role that inherits privileges implicitly', () => {
    expect(() => assertRestrictedOperator(operator, { ...login, rolinherit: true })).toThrow()
  })
  it('rejects an unrelated restricted login even if its flags are safe', () => {
    expect(() => assertRestrictedOperator(operator, { ...login, name: 'auth_runtime_login' })).toThrow()
    expect(() => assertRestrictedOperator(operator, { ...login, name: 'untrusted_login' })).toThrow()
  })
  it('rejects missing login role', () => {
    expect(() => assertRestrictedOperator(operator, undefined)).toThrow()
  })
})


describe('PostgreSQL role metadata parsing', () => {
  it('parses a complete role record', () => {
    expect(parseRole(operator)).toEqual(operator)
  })
  it.each([
    undefined,
    null,
    {},
    { ...operator, rolcanlogin: undefined },
    { ...operator, rolinherit: undefined },
    { ...operator, rolsuper: 'false' },
    { ...operator, rolbypassrls: 0 },
    { ...operator, rolcreaterole: null },
    { ...operator, rolcreatedb: undefined },
    { ...operator, rolinherit: 'true' },
  ])('rejects missing or mistyped privilege metadata', value => {
    expect(parseRole(value)).toBeUndefined()
    expect(() => assertRestrictedOperator(parseRole(value), login)).toThrow()
  })
})
