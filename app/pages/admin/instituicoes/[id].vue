<script setup lang="ts">
import type { InstitutionSummary } from '#shared/types/api'
definePageMeta({ layout: 'workspace', middleware: ['authenticated'] })
useSeoMeta({ title: 'Instituição — Pagino', robots: 'noindex, nofollow' })
const route = useRoute()
const { data, error } = await useFetch<{ institution: InstitutionSummary; data: { id: string; title: string; slug: string; version: number }[] }>(() => `/api/institutions/${encodeURIComponent(String(route.params.id))}/pages`)
</script>

<template>
  <section><NuxtLink to="/admin" class="text-button">← Suas instituições</NuxtLink>
    <div v-if="error" class="panel feedback-space" role="alert"><h1 class="small-heading">Instituição indisponível.</h1><p>O endereço pode estar incorreto ou seu vínculo não está ativo.</p></div>
    <template v-else-if="data"><div class="page-intro feedback-space"><p class="eyebrow">INSTITUIÇÃO</p><h1>{{ data.institution.name }}</h1><p>Páginas em rascunho. Esta consulta não publica conteúdo.</p></div>
      <div class="panel"><h2>Conteúdo disponível</h2><p v-if="!data.data.length">Nenhuma página em rascunho nesta instituição.</p><ul v-else class="page-list"><li v-for="page in data.data" :key="page.id"><span>{{ page.title }}</span><small>Rascunho · versão {{ page.version }}</small></li></ul></div>
    </template>
  </section>
</template>
