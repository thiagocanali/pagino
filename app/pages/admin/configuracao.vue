<script setup lang="ts">
import { validateInstitution } from '#shared/schemas/institution'
import type { ApiErrorData } from '#shared/types/api'
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Validar configuração — Pagino', robots: 'noindex, nofollow' })
const form = reactive({ name: '', slug: '' })
const fields = ref<Record<string, string>>({})
const pending = ref(false)
const message = ref('')
const failure = ref('')

watch(form, () => { message.value = ''; failure.value = '' })

async function submit() {
  message.value = ''
  failure.value = ''
  const result = validateInstitution(form)
  fields.value = result.success ? {} : result.fields
  if (!result.success) {
    await nextTick()
    document.getElementById(Object.keys(result.fields)[0] ?? '')?.focus()
    return
  }
  pending.value = true
  try {
    await $fetch('/api/setup/validate', { method: 'POST', body: result.data })
    message.value = 'Configuração válida. Nenhuma instituição foi criada e nenhum dado foi salvo.'
  }
  catch (error: unknown) {
    const response = error as { data?: { data?: ApiErrorData } }
    const detail = response.data?.data
    if (detail?.fields) fields.value = detail.fields
    failure.value = detail?.message ?? 'Não foi possível validar agora. Tente novamente.'
  }
  finally { pending.value = false }
}
</script>

<template>
  <div>
  <div class="page-intro"><p class="eyebrow">PREPARAÇÃO INSTITUCIONAL</p><h1>Clareza desde<br>o primeiro campo.</h1><p>Verifique a estrutura do nome e do endereço com as mesmas regras no navegador e no servidor.</p></div>
  <div class="configuration-grid">
    <section class="panel form-panel" aria-labelledby="form-heading">
      <h2 id="form-heading">Validar configuração</h2><p class="form-description">Este formulário apenas valida os campos. Não verifica disponibilidade de endereço, não cadastra e não armazena dados.</p>
      <form novalidate :aria-busy="pending" @submit.prevent="submit">
        <AppField id="name" v-model="form.name" label="Nome da instituição" hint="Entre 2 e 120 caracteres." :error="fields.name" placeholder="Como sua instituição se chama?" :maxlength="120" />
        <AppField id="slug" v-model="form.slug" label="Endereço do site" hint="Letras minúsculas, números e hífens. De 3 a 60 caracteres." :error="fields.slug" placeholder="minha-instituicao" :maxlength="60" />
        <p class="url-preview">Estrutura prevista: <code>/s/{{ form.slug || 'seu-endereco' }}</code></p>
        <div v-if="message" class="feedback feedback-success" role="status">{{ message }}</div>
        <div v-if="failure" class="feedback feedback-error" role="alert">{{ failure }}</div>
        <button type="submit" class="button button-primary" :disabled="pending">{{ pending ? 'Validando…' : 'Validar campos' }}<span aria-hidden="true">→</span></button>
      </form>
    </section>
    <aside class="configuration-note"><span class="note-symbol" aria-hidden="true">✳</span><h2>Um endereço.<br>Uma identidade.</h2><p>O endereço será a referência pública da instituição. Por isso, nomes de rotas da plataforma são reservados e cada formato é validado antes de seguir.</p><p class="small-text">A criação real depende de autenticação, permissões e persistência. Esses recursos ainda não estão disponíveis.</p></aside>
  </div>
  </div>
</template>
