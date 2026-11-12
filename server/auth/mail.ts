export interface AuthMail { to: string; subject: string; text: string }
export interface AuthMailTransport { send(message: AuthMail): Promise<void> }
const loopback = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host)

// Development-only network transport. No external provider is selected or contacted.
export function localMailTransport(appOrigin: string, endpoint: string, secret: string): AuthMailTransport | undefined {
  if (!endpoint && !secret) return undefined
  const app = new URL(appOrigin)
  const target = new URL(endpoint)
  if (!loopback(app.hostname) || !loopback(target.hostname) || target.protocol !== 'http:' || target.username || target.password || target.search || target.hash || target.pathname !== '/messages' || secret.length < 32) throw new Error('Local mail transport requires loopback and a private key')
  return {
    async send(message) {
      const response = await fetch(target, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000), headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: JSON.stringify(message) })
      if (!response.ok) throw new Error('Local mail delivery failed')
    },
  }
}
