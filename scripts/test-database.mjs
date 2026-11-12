import { spawnSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import postgres from 'postgres'

const name = `pagino-test-${randomUUID()}`
const password = randomBytes(24).toString('hex')
const dockerEnv = { ...process.env, POSTGRES_PASSWORD: password }
for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete dockerEnv[key]
const image = 'postgres:17.11-alpine@sha256:e5d2edd28b1f8d40a0a6c0c9cdc545b19b56a0d5d88f94bc11a97d970d4700d0'
function docker(args) {
  const result = spawnSync('docker', ['--host=unix:///var/run/docker.sock', ...args], { env: dockerEnv, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`Docker failed: ${result.stderr || 'daemon unavailable'}`)
  return result.stdout.trim()
}
let started = false
try {
  docker(['run', '--detach', '--rm', '--name', name, '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_PASSWORD', '--env', 'POSTGRES_DB=pagino_test', image])
  started = true
  const port = docker(['inspect', '--format', '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}', name])
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/pagino_test`
  const probe = postgres(url, { max: 1, connect_timeout: 1 })
  let ready = false
  for (let attempt = 0; attempt < 50; attempt++) {
    try { await probe`select 1`; ready = true; break }
    catch { await new Promise(resolve => setTimeout(resolve, 200)) }
  }
  await probe.end({ timeout: 1 })
  if (!ready) throw new Error('Disposable PostgreSQL did not become ready')
  console.log('Running integration tests against a new disposable PostgreSQL 17.11 instance.')
  const browser = process.argv.includes('--browser')
  const args = browser ? ['exec', '--', 'playwright', 'test', '--config', 'playwright.auth.config.ts'] : ['exec', '--', 'vitest', 'run', '--config', 'vitest.integration.config.ts']
  const result = spawnSync('npm', args, {
    stdio: 'inherit', env: { ...process.env, PAGINO_TEST_DATABASE_URL: url },
  })
  process.exitCode = result.status ?? 1
}
finally {
  if (started) docker(['stop', '--time', '1', name])
}
