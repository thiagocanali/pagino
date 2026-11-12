import { z } from 'zod'

export const loginSchema = z.strictObject({
  email: z.email('Informe um e-mail válido.').max(254, 'Use até 254 caracteres.').transform(value => value.toLowerCase()),
  password: z.string().min(1, 'Informe sua senha.').max(128, 'Use até 128 caracteres.'),
})
