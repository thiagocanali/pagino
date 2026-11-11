import { randomUUID } from 'node:crypto'
import { defineEventHandler, setResponseHeader } from 'h3'

export default defineEventHandler((event) => {
  // Generate our own value rather than echoing an untrusted client header.
  event.context.requestId = randomUUID()
  setResponseHeader(event, 'x-request-id', event.context.requestId)
})
