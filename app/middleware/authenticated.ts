import type { SessionUser } from '#shared/types/api'

export default defineNuxtRouteMiddleware(async () => {
  const user = useState<SessionUser | null>('authenticated-user', () => null)
  try { user.value = await useRequestFetch()<SessionUser>('/api/me') }
  catch {
    user.value = null
    return navigateTo('/auth/login')
  }
})
