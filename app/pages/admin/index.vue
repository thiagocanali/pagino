<script setup lang="ts">
import type { InstitutionSummary } from '#shared/types/api'
definePageMeta({ layout: 'workspace', middleware: ['authenticated'] })
useSeoMeta({ title: 'Suas instituições — Pagino', robots: 'noindex, nofollow' })
const { data, status, error, refresh } = await useFetch<InstitutionSummary[]>('/api/me/institutions')
const roleNames = { owner: 'Responsável', admin: 'Administrador', editor: 'Editor', viewer: 'Leitor' }
</script>

<template>
  <section><div class="page-intro"><p class="eyebrow">SEU ESPAÇO DE TRABALHO</p><h1>Suas instituições.</h1><p>Escolha a instituição que você quer acompanhar. Seu acesso e suas permissões são verificados no servidor.</p></div>
    <p v-if="status === 'pending'" role="status">Carregando instituições…</p>
    <div v-else-if="error" role="alert" class="panel"><p>Não foi possível carregar suas instituições.</p><button class="text-button" @click="refresh()">Tentar novamente</button></div>
    <div v-else-if="!data?.length" class="panel"><h2>Nenhuma instituição disponível.</h2><p>Você ainda não tem vínculo ativo com uma instituição. Procure o responsável pela sua equipe.</p></div>
    <div v-else class="institution-grid"><NuxtLink v-for="institution in data" :key="institution.id" :to="`/admin/instituicoes/${institution.id}`" class="panel institution-card"><StatusBadge :label="roleNames[institution.role]" /><h2>{{ institution.name }}</h2><p>Abrir instituição <span aria-hidden="true">→</span></p></NuxtLink></div>
  </section>
</template>
