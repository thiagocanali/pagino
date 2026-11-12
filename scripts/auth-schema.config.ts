import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../server/db/auth-schema'

// Used only by the schema generator; no connection is opened during generation.
const url = process.env.PAGINO_SCHEMA_DATABASE_URL
if (!url) throw new Error('PAGINO_SCHEMA_DATABASE_URL is required for schema generation')
export const auth = betterAuth({
  baseURL: 'http://localhost:3000',
  database: drizzleAdapter(drizzle(postgres(url, { prepare: false }), { schema }), { provider: 'pg', schema }),
  rateLimit: { enabled: true, storage: 'database' },
  emailAndPassword: { enabled: true },
})
