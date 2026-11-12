<script setup lang="ts">
import type { SessionUser } from '#shared/types/api'
const user = useState<SessionUser | null>('authenticated-user', () => null)
const pending = ref(false)
const error = ref('')
async function logout() {
  pending.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/sign-out', { method: 'POST', body: {} })
    user.value = null
    clearNuxtData()
    await navigateTo('/auth/login')
  }
  catch { error.value = 'Não foi possível encerrar a sessão. Tente novamente.' }
  finally { pending.value = false }
}
</script>

<template>
  <div class="workspace-shell">
    <a href="#main" class="skip-link">Ir para o conteúdo</a>
    <header class="public-header container"><BrandMark /><div class="header-actions"><span class="user-name">{{ user?.name }}</span><button class="button button-outline" :disabled="pending" @click="logout">{{ pending ? 'Saindo…' : 'Sair' }}</button></div></header>
    <p v-if="error" class="feedback feedback-error container" role="alert">{{ error }}</p>
    <main id="main" class="container workspace-main"><slot /></main>
  </div>
</template>
