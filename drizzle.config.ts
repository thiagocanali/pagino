import { defineConfig } from 'drizzle-kit'

// Generation is offline. No production connection or push command is configured.
export default defineConfig({
  dialect: 'postgresql',
  schema: ['./server/db/auth-schema.ts', './server/db/schema.ts'],
  out: './migrations',
  strict: true,
})
