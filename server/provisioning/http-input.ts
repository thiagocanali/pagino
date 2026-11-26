import { AccessError } from '../auth/service'

export class InvitationInputError extends AccessError {}

/** Validate the origin and stream a bounded JSON body before privileged work. */
export async function readInvitationInput(request: Request, origin: string): Promise<unknown> {
  if (request.method !== 'POST') throw new InvitationInputError(405)
  if (request.headers.get('origin') !== origin) throw new InvitationInputError(403)
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new InvitationInputError(415)
  if (Number(request.headers.get('content-length')) > 8192) throw new InvitationInputError(413)
  if (!request.body) throw new InvitationInputError(400)
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0
  let raw = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8192) {
        await reader.cancel()
        throw new InvitationInputError(413)
      }
      raw += decoder.decode(value, { stream: true })
    }
    raw += decoder.decode()
    return JSON.parse(raw) as unknown
  }
  catch (error) {
    if (error instanceof InvitationInputError) throw error
    throw new InvitationInputError(400)
  }
  finally { reader.releaseLock() }
}
