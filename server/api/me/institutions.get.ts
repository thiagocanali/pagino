import { defineEventHandler, toWebRequest } from 'h3'
import { authenticatedUser, listInstitutions } from '../../auth/service'
import { protectedOperation } from '../../auth/runtime'

export default defineEventHandler(event => protectedOperation(event, async (runtime) => {
  const user = await authenticatedUser(runtime, toWebRequest(event).headers)
  return listInstitutions(runtime, user.id)
}))
