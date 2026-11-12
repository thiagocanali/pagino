<script setup lang="ts">
useSeoMeta({ title: 'Confirmar e-mail — Pagino', robots: 'noindex, nofollow' })
const { token, ready } = useEmailLink()
const pending = ref(false), success = ref(false), error = ref('')
async function confirm() {
  pending.value = true; error.value = ''
  try { await $fetch('/api/auth/verify-email', { method: 'POST', body: { token: token.value } }); success.value = true; token.value = '' }
  catch (failure: unknown) {
    error.value = (failure as { statusCode?: number }).statusCode === 400 ? 'Link inválido, expirado ou já utilizado. Solicite novas instruções.' : 'Não foi possível confirmar agora. Tente novamente mais tarde.'
  }
  finally { pending.value = false }
}
</script>
<template>
  <section class="login-section container"><div class="page-intro"><p class="eyebrow">SEU E-MAIL NO PAGINO</p><h1>Confirme que é você.</h1><p>Confirme o endereço para acessar sua conta. Abrir o link não altera sua conta até você confirmar.</p></div>
    <div class="panel form-panel login-panel"><div v-if="success" role="status"><h2>E-mail confirmado.</h2><p>Agora você pode entrar na sua conta.</p><NuxtLink to="/auth/login" class="button button-primary">Ir para entrar</NuxtLink></div>
      <template v-else-if="token"><p v-if="error" role="alert" class="feedback feedback-error">{{ error }}</p><button class="button button-primary" :disabled="pending" @click="confirm">{{ pending ? 'Confirmando…' : 'Confirmar e-mail' }}</button></template>
      <p v-else-if="ready" role="alert">Link inválido ou ausente. Solicite novas instruções.</p><p v-else role="status">Preparando confirmação…</p>
      <NuxtLink v-if="!success" to="/auth/verificar-email" class="text-button">Solicitar novas instruções</NuxtLink>
    </div>
  </section>
</template>
