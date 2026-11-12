import { emailTokenSchema } from '#shared/schemas/login'

export function useEmailLink() {
  const token = ref('')
  const ready = ref(false)
  const router = useRouter()
  onMounted(async () => {
    const path = window.location.pathname
    const parsed = emailTokenSchema.safeParse(window.location.hash.slice(1))
    if (parsed.success) token.value = parsed.data
    // Replace router state as well as the address, so the secret is not retained in history.state.
    try { await router.replace({ path, query: {}, hash: '' }) }
    catch { token.value = ''; window.history.replaceState(null, '', path) }
    ready.value = true
  })
  return { token, ready }
}
