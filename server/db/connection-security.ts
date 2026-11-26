/** Reject insecure remote database URLs before opening any connection. */
export function assertSecureDatabaseUrl(value: string): void {
  const url = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Invalid database protocol')
  if (!url.hostname) throw new Error('Database hostname is required')
  // Conflicting driver-specific TLS switches must not override sslmode.
  if (url.searchParams.has('ssl')) throw new Error('Ambiguous PostgreSQL TLS configuration')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (local) return
  const sslModes = url.searchParams.getAll('sslmode')
  // Duplicate parameters can be interpreted differently by URL parsers and drivers.
  if (sslModes.length !== 1 || !['require', 'verify-ca', 'verify-full'].includes(sslModes[0]!.toLowerCase())) {
    throw new Error('Remote PostgreSQL requires sslmode=require or stronger')
  }
}
