<script setup lang="ts">
import { loginSchema } from '#shared/schemas/login'
useSeoMeta({ title: 'Entrar — Pagino', robots: 'noindex, nofollow' })
const { data: capabilities } = await useFetch<{ emailRecovery: boolean; emailVerification: boolean }>('/api/auth/capabilities')
const form = reactive({ email: '', password: '' })
const fields = ref<Record<string, string>>({})
const pending = ref(false)
const failure = ref('')
async function submit() {
  failure.value = ''
  fields.value = {}
  const result = loginSchema.safeParse(form)
  if (!result.success) {
    for (const issue of result.error.issues) fields.value[String(issue.path[0])] ??= issue.message
    await nextTick()
    document.getElementById(Object.keys(fields.value)[0] ?? '')?.focus()
    return
  }
  pending.value = true
  try {
    await $fetch('/api/auth/sign-in/email', { method: 'POST', body: result.data })
    form.password = ''
    await navigateTo('/admin')
  }
  catch (error: unknown) {
    const response = error as { statusCode?: number }
    failure.value = response.statusCode === 503 ? 'O acesso ainda não está conectado neste ambiente. Tente novamente mais tarde.'
      : response.statusCode === 429 ? 'Muitas tentativas. Aguarde um minuto antes de tentar novamente.'
        : 'Não foi possível entrar. Confira seus dados ou tente novamente mais tarde.'
  }
  finally { pending.value = false }
}
</script>

<template>
  <section class="login-section container">
    <div class="page-intro"><p class="eyebrow">SEU ESPAÇO NO PAGINO</p><h1>Bom ter você<br>por aqui.</h1><p>Acesse com o e-mail e a senha da sua equipe. O acesso é restrito a pessoas previamente cadastradas e verificadas.</p></div>
    <div class="panel form-panel login-panel">
      <h2>Entrar na sua conta</h2>
      <form novalidate :aria-busy="pending" @submit.prevent="submit">
        <AppField id="email" v-model="form.email" label="E-mail" type="email" autocomplete="username" :error="fields.email" :maxlength="254" />
        <AppField id="password" v-model="form.password" label="Senha" type="password" autocomplete="current-password" :error="fields.password" :maxlength="128" />
        <p v-if="failure" role="alert" class="feedback feedback-error">{{ failure }}</p>
        <button class="button button-primary" type="submit" :disabled="pending">{{ pending ? 'Entrando…' : 'Entrar' }} <span aria-hidden="true">→</span></button>
      </form>
      <div v-if="capabilities?.emailRecovery" class="auth-links"><NuxtLink to="/auth/recuperar" class="text-button">Esqueci minha senha</NuxtLink><NuxtLink to="/auth/verificar-email" class="text-button">Confirmar meu e-mail</NuxtLink></div><p v-else class="field-hint">Envio de e-mail não conectado neste ambiente.</p><p class="field-hint">Cadastro público e convites ainda não estão disponíveis.</p>
    </div>
  </section>
</template>
