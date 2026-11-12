<script setup lang="ts">
import { resetPasswordSchema } from '#shared/schemas/login'
useSeoMeta({ title: 'Definir nova senha — Pagino', robots: 'noindex, nofollow' })
const { token, ready } = useEmailLink()
const password = ref(''), confirmation = ref(''), pending = ref(false), success = ref(false), error = ref('')
async function submit() {
  error.value = ''
  const parsed = resetPasswordSchema.safeParse({ token: token.value, newPassword: password.value })
  if (!parsed.success) { error.value = 'Use uma senha entre 12 e 128 caracteres e um link válido.'; return }
  if (password.value !== confirmation.value) { error.value = 'As senhas precisam ser iguais.'; return }
  pending.value = true
  try { await $fetch('/api/auth/reset-password', { method: 'POST', body: parsed.data }); success.value = true; token.value = ''; password.value = ''; confirmation.value = '' }
  catch (failure: unknown) {
    const status = (failure as { statusCode?: number }).statusCode
    error.value = status === 400 ? 'Link inválido, expirado ou já utilizado. Solicite novas instruções.' : 'Não foi possível concluir agora. Tente novamente mais tarde.'
  }
  finally { pending.value = false }
}
</script>
<template>
  <section class="login-section container"><div class="page-intro"><p class="eyebrow">UM NOVO ACESSO</p><h1>Defina sua nova senha.</h1><p>Use de 12 a 128 caracteres. Ao concluir, suas sessões anteriores serão encerradas.</p></div>
    <div class="panel form-panel login-panel">
      <div v-if="success" role="status"><h2>Senha atualizada.</h2><p>Entre novamente com sua nova senha.</p><NuxtLink to="/auth/login" class="button button-primary">Ir para entrar</NuxtLink></div>
      <form v-else-if="token" novalidate :aria-busy="pending" @submit.prevent="submit">
        <AppField id="new-password" v-model="password" label="Nova senha" type="password" autocomplete="new-password" :maxlength="128" />
        <AppField id="confirmation" v-model="confirmation" label="Confirme a nova senha" type="password" autocomplete="new-password" :maxlength="128" />
        <p v-if="error" role="alert" class="feedback feedback-error">{{ error }}</p><button class="button button-primary" :disabled="pending" type="submit">{{ pending ? 'Atualizando…' : 'Atualizar senha' }}</button>
      </form>
      <p v-else-if="ready" role="alert">Link inválido ou ausente. Solicite novas instruções.</p><p v-else role="status">Preparando acesso…</p>
      <NuxtLink v-if="!success" to="/auth/recuperar" class="text-button">Solicitar novas instruções</NuxtLink>
    </div>
  </section>
</template>
