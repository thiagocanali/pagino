/** Reject insecure remote database URLs before opening any connection. */
export function assertSecureDatabaseUrl(value: string): void {
  const url = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Invalid database protocol')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (local) return
  const sslmode = url.searchParams.get('sslmode')?.toLowerCase()
  if (!['require', 'verify-ca', 'verify-full'].includes(sslmode ?? '')) {
    throw new Error('Remote PostgreSQL requires sslmode=require or stronger')
  }
}
