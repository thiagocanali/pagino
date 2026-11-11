import { z } from 'zod'

const reservedSlugs = new Set(['admin', 'api', 'auth', 'eventos', 's', 'www', 'pagino'])

export const institutionSchema = z.strictObject({
  name: z.string().trim().min(2, 'Informe um nome com pelo menos 2 caracteres.').max(120, 'Use até 120 caracteres.'),
  slug: z.string().trim().min(3, 'Use pelo menos 3 caracteres.').max(60, 'Use até 60 caracteres.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use letras minúsculas, números e hífens entre palavras.')
    .refine(value => !reservedSlugs.has(value), 'Este endereço está reservado.'),
})

export type InstitutionInput = z.infer<typeof institutionSchema>

export function validateInstitution(input: unknown) {
  const result = institutionSchema.safeParse(input)
  if (result.success) return { success: true as const, data: result.data }
  const fields: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form')
    fields[key] ??= issue.message
  }
  return { success: false as const, fields }
}
