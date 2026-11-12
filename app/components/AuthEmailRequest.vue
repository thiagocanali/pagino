<script setup lang="ts">
import { emailRequestSchema } from '#shared/schemas/login'
const props = defineProps<{ purpose: 'reset' | 'verify' }>()
const email = ref('')
const pending = ref(false)
const message = ref('')
const error = ref('')
const fieldError = ref('')
async function submit() {
  message.value = ''; error.value = ''; fieldError.value = ''
  const parsed = emailRequestSchema.safeParse({ email: email.value })
  if (!parsed.success) { fieldError.value = 'Informe um e-mail válido.'; await nextTick(); document.getElementById('email')?.focus(); return }
  pending.value = true
  try {
    const result = await $fetch<{ message: string }>(props.purpose === 'reset' ? '/api/auth/request-password-reset' : '/api/auth/send-verification-email', { method: 'POST', body: parsed.data })
    message.value = result.message
  }
  catch (failure: unknown) {
    const status = (failure as { statusCode?: number }).statusCode
    error.value = status === 429 ? 'Muitas tentativas. Aguarde um minuto antes de tentar novamente.' : 'Envio indisponível neste momento. Tente novamente mais tarde.'
  }
  finally { pending.value = false }
}
</script>

<template>
  <section class="login-section container">
    <div class="page-intro"><p class="eyebrow">SEU ACESSO AO PAGINO</p><h1>{{ purpose === 'reset' ? 'Vamos recuperar seu acesso.' : 'Confirme seu e-mail.' }}</h1><p>Use o e-mail da sua conta. As instruções serão enviadas apenas para o endereço cadastrado.</p></div>
    <div class="panel form-panel login-panel"><h2>{{ purpose === 'reset' ? 'Recuperar senha' : 'Solicitar confirmação' }}</h2>
      <form novalidate :aria-busy="pending" @submit.prevent="submit">
        <AppField id="email" v-model="email" label="E-mail" type="email" autocomplete="email" :error="fieldError" :maxlength="254" />
        <p v-if="message" role="status" class="feedback feedback-success">{{ message }}</p><p v-if="error" role="alert" class="feedback feedback-error">{{ error }}</p>
        <button class="button button-primary" :disabled="pending" type="submit">{{ pending ? 'Solicitando…' : 'Solicitar instruções' }}</button>
      </form><NuxtLink to="/auth/login" class="text-button">Voltar para entrar</NuxtLink>
    </div>
  </section>
</template>
