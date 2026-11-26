import { describe, expect, it } from 'vitest'
import { readInvitationInput } from '../../server/provisioning/http-input'

const origin = 'https://pagino.example'
function request(body: string, headers: Record<string, string> = {}) {
  return new Request(origin + '/api/invitations/register', {
    method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body,
  })
}

describe('invitation HTTP input boundary', () => {
  it('parses same-origin JSON', async () => {
    await expect(readInvitationInput(request('{"token":"test"}'), origin)).resolves.toEqual({ token: 'test' })
  })
  it('rejects foreign origin', async () => {
    await expect(readInvitationInput(request('{}', { origin: 'https://foreign.example' }), origin)).rejects.toMatchObject({ status: 403 })
  })
  it('rejects absent origin', async () => {
    const input = request('{}')
    input.headers.delete('origin')
    await expect(readInvitationInput(input, origin)).rejects.toMatchObject({ status: 403 })
  })
  it('rejects non-JSON', async () => {
    await expect(readInvitationInput(request('{}', { 'content-type': 'text/plain' }), origin)).rejects.toMatchObject({ status: 415 })
  })
  it('rejects oversized declared body', async () => {
    await expect(readInvitationInput(request('{}', { 'content-length': '8193' }), origin)).rejects.toMatchObject({ status: 413 })
  })
  it('rejects oversized actual body without content-length', async () => {
    await expect(readInvitationInput(request(JSON.stringify('é'.repeat(4096))), origin)).rejects.toMatchObject({ status: 413 })
  })
  it('rejects malformed JSON', async () => {
    await expect(readInvitationInput(request('{'), origin)).rejects.toMatchObject({ status: 400 })
  })
  it('rejects GET', async () => {
    await expect(readInvitationInput(new Request(origin), origin)).rejects.toMatchObject({ status: 405 })
  })
})
