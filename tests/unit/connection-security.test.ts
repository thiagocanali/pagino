import { describe, expect, it } from 'vitest'
import { assertSecureDatabaseUrl } from '../../server/db/connection-security'

describe('database connection security', () => {
  it('accepts disposable local PostgreSQL without TLS', () => {
    expect(() => assertSecureDatabaseUrl('postgres://user:pass@127.0.0.1:5432/pagino_test')).not.toThrow()
  })
  it('requires explicit TLS for remote databases', () => {
    expect(() => assertSecureDatabaseUrl('postgres://user:pass@ep.example.neon.tech/pagino')).toThrow(/sslmode/)
    expect(() => assertSecureDatabaseUrl('postgres://user:pass@ep.example.neon.tech/pagino?sslmode=disable')).toThrow(/sslmode/)
    expect(() => assertSecureDatabaseUrl('postgres://user:pass@ep.example.neon.tech/pagino?sslmode=prefer')).toThrow(/sslmode/)
    expect(() => assertSecureDatabaseUrl('postgres://user:pass@ep.example.neon.tech/pagino?sslmode=require')).not.toThrow()
    expect(() => assertSecureDatabaseUrl('postgresql://user:pass@ep.example.neon.tech/pagino?sslmode=verify-full')).not.toThrow()
  })
  it('rejects unsupported connection schemes', () => {
    expect(() => assertSecureDatabaseUrl('https://example.com/database')).toThrow(/protocol/)
  })
})
