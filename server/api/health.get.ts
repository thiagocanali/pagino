import { defineEventHandler } from 'h3'
import type { HealthResponse } from '#shared/types/api'

export default defineEventHandler((): HealthResponse => ({ status: 'ok', service: 'pagino' }))
