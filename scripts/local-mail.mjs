import { createServer } from 'node:http'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

const directory = resolve(process.env.PAGINO_LOCAL_MAIL_DIR || '.local-mail')
const port = Number(process.env.PAGINO_LOCAL_MAIL_PORT || 3025)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid local port')
await mkdir(join(directory, 'messages'), { recursive: true, mode: 0o700 })
const configFile = join(directory, 'collector.env')
const previous = await readFile(configFile, 'utf8').catch(() => '')
const secret = previous.match(/^NUXT_AUTH_MAIL_SECRET=([a-f0-9]{64})$/m)?.[1] || randomBytes(32).toString('hex')
const server = createServer(async (request, response) => {
  const actual = Buffer.from(request.headers.authorization || '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) { response.writeHead(403).end(); return }
  if (request.method !== 'POST' || request.url !== '/messages') { response.writeHead(404).end(); return }
  try {
    const chunks = []
    let length = 0
    for await (const chunk of request) {
      length += chunk.length
      if (length > 16384) { response.writeHead(413).end(); return }
      chunks.push(chunk)
    }
    const message = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!message || typeof message.to !== 'string' || typeof message.subject !== 'string' || typeof message.text !== 'string') { response.writeHead(400).end(); return }
    await writeFile(join(directory, 'messages', `${randomUUID()}.json`), JSON.stringify(message, null, 2), { mode: 0o600, flag: 'wx' })
    response.writeHead(202).end()
  }
  catch { response.writeHead(500).end() }
})
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
await writeFile(configFile, `NUXT_AUTH_MAIL_URL=http://127.0.0.1:${port}/messages\nNUXT_AUTH_MAIL_SECRET=${secret}\n`, { mode: 0o600 })
console.log('Coletor local ativo em loopback. Configuração privada em .local-mail/collector.env; mensagens no diretório privado messages. Nenhum e-mail externo será enviado.')
process.on('SIGTERM', () => server.close(() => process.exit(0)))
process.on('SIGINT', () => server.close(() => process.exit(0)))
