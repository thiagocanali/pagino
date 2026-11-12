import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { AuthMail } from '../../server/auth/mail'

// A real loopback HTTP collector, owned by the test; no public inbox endpoint.
export async function startLocalMailCollector() {
  const secret = randomBytes(32).toString('hex')
  const messages: AuthMail[] = []
  let failing = false
  const server = createServer(async (request, response) => {
    const expected = Buffer.from(`Bearer ${secret}`)
    const received = Buffer.from(request.headers.authorization ?? '')
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) { response.writeHead(403).end(); return }
    if (request.method !== 'POST' || request.url !== '/messages') { response.writeHead(404).end(); return }
    if (failing) { response.writeHead(503).end(); return }
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of request) {
      size += chunk.length
      if (size > 16384) { response.writeHead(413).end(); return }
      chunks.push(chunk)
    }
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as AuthMail
      if (typeof body.to !== 'string' || typeof body.subject !== 'string' || typeof body.text !== 'string') throw new Error('Invalid message')
      messages.push(body)
      response.writeHead(202).end()
    }
    catch { response.writeHead(400).end() }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Collector did not start')
  return {
    url: `http://127.0.0.1:${address.port}/messages`, secret, messages,
    fail: (value: boolean) => { failing = value },
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  }
}
