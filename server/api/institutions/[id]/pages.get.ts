import { defineEventHandler, toWebRequest, getRouterParam } from 'h3'
import { authenticatedUser, readInstitution } from '../../../auth/service'
import { protectedOperation } from '../../../auth/runtime'

export default defineEventHandler(event => protectedOperation(event, async (runtime) => {
  const user = await authenticatedUser(runtime, toWebRequest(event).headers)
  return readInstitution(runtime, user.id, getRouterParam(event, 'id') ?? '', 'content.read')
}))
