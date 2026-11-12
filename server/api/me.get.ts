import { defineEventHandler, toWebRequest } from 'h3'
import { authenticatedUser } from '../auth/service'
import { protectedOperation } from '../auth/runtime'

export default defineEventHandler(event => protectedOperation(event, runtime => authenticatedUser(runtime, toWebRequest(event).headers)))
