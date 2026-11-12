import { defineEventHandler, getRequestIP, toWebRequest } from 'h3'
import { handleAuthentication } from '../../auth/service'
import { protectedOperation } from '../../auth/runtime'

export default defineEventHandler(event => protectedOperation(event, runtime =>
  handleAuthentication(runtime, toWebRequest(event), getRequestIP(event, { xForwardedFor: false }) ?? 'unknown'),
))
