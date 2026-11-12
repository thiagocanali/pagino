import { z } from 'zod'

export const loginSchema = z.strictObject({
  email: z.email('Informe um e-mail válido.').max(254, 'Use até 254 caracteres.').transform(value => value.toLowerCase()),
  password: z.string().min(1, 'Informe sua senha.').max(128, 'Use até 128 caracteres.'),
})

export const emailRequestSchema = z.strictObject({ email: z.string().trim().pipe(z.email('Informe um e-mail válido.')).transform(value => value.toLowerCase()) })
export const emailTokenSchema = z.string().regex(/^[a-f0-9]{64}$/, 'Link inválido ou expirado.')
export const verificationSchema = z.strictObject({ token: emailTokenSchema })
export const resetPasswordSchema = z.strictObject({ token: emailTokenSchema, newPassword: z.string().min(12, 'Use pelo menos 12 caracteres.').max(128, 'Use até 128 caracteres.') })
