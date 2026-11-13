import { defineEventHandler, readBody, getHeader } from 'h3'
import { z } from 'zod'
import { protectedOperation } from '../../auth/runtime'
import { acceptInitialOwnerInvitation } from '../../provisioning/accept'
import { AccessError } from '../../auth/service'

const bodySchema = z.strictObject({ token: z.string() })

export default defineEventHandler(event => protectedOperation(event, async runtime => {
  const origin = getHeader(event, 'origin')
  if (origin !== runtime.origin) throw new AccessError(403)
  if (getHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new AccessError(400)
  const length = Number(getHeader(event, 'content-length') || 0)
  if (!Number.isFinite(length) || length > 8192) throw new AccessError(400)
  const input = bodySchema.safeParse(await readBody(event))
  if (!input.success) throw new AccessError(400)
  const headers = new Headers()
  const cookie = getHeader(event, 'cookie')
  if (cookie) headers.set('cookie', cookie)
  return acceptInitialOwnerInvitation(runtime, headers, input.data.token)
}))
