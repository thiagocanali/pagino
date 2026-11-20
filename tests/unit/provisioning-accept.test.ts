import { describe, expect, it, vi } from 'vitest'
import { acceptInitialOwnerInvitation } from '../../server/provisioning/accept'
import type { Authentication } from '../../server/auth/service'

const headers = new Headers()
const token = 'a'.repeat(64)

function runtime(getSession: ReturnType<typeof vi.fn>) {
  return { auth: { api: { getSession } } } as unknown as Authentication
}

describe('initial owner invitation acceptance boundary', () => {
  it('rejects malformed tokens before reading the session', async () => {
    const getSession = vi.fn()
    await expect(acceptInitialOwnerInvitation(runtime(getSession), headers, 'malformed', ''))
      .rejects.toMatchObject({ status: 400 })
    expect(getSession).not.toHaveBeenCalled()
  })

  it('requires a Better Auth session without cookie caching', async () => {
    const getSession = vi.fn().mockResolvedValue(null)
    await expect(acceptInitialOwnerInvitation(runtime(getSession), headers, token, ''))
      .rejects.toMatchObject({ status: 401 })
    expect(getSession).toHaveBeenCalledWith({ headers, query: { disableCookieCache: true } })
  })

  it('rejects an unverified account before connecting to the executor', async () => {
    const getSession = vi.fn().mockResolvedValue({ session: { token: 'fixture' }, user: { emailVerified: false } })
    await expect(acceptInitialOwnerInvitation(runtime(getSession), headers, token, ''))
      .rejects.toMatchObject({ status: 403 })
  })
})
