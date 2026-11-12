<script setup lang="ts">
import type { HealthResponse } from '#shared/types/api'
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Fundação técnica — Pagino', robots: 'noindex, nofollow' })
const { data, status, error, refresh } = await useFetch<HealthResponse>('/api/health', { key: 'foundation-health' })
</script>

<template>
  <div>
  <div class="page-intro"><p class="eyebrow">BEM-VINDO AO PAGINO</p><h1>Uma boa história<br>começa pela base.</h1><p>A fundação técnica está tomando forma. Aqui você acompanha o que já pode ser verificado de verdade.</p></div>
  <div class="overview-grid">
    <section class="panel health-panel" aria-labelledby="health-heading">
      <div class="panel-heading"><span class="panel-icon" aria-hidden="true">⌁</span><StatusBadge v-if="data && !error" tone="success" label="Respondendo" /><StatusBadge v-else label="Verificação pendente" /></div>
      <h2 id="health-heading">Conexão com o backend</h2>
      <p v-if="status === 'pending'" role="status">Verificando a resposta do servidor…</p>
      <p v-else-if="error" role="alert">Não foi possível verificar o servidor. Tente novamente.</p>
      <p v-else>O Nitro respondeu à verificação de saúde. Esta consulta não acessa banco de dados ou autenticação.</p>
      <div class="endpoint-line"><code>GET /api/health</code><span v-if="data && !error">{{ data.status }}</span></div>
      <button class="text-button" :disabled="status === 'pending'" @click="refresh()">{{ status === 'pending' ? 'Verificando…' : 'Verificar novamente' }} <span aria-hidden="true">↻</span></button>
    </section>
    <section class="panel next-panel" aria-labelledby="next-heading"><span class="eyebrow">PRÓXIMO PASSO</span><h2 id="next-heading">Um espaço para<br>cada instituição.</h2><p>Persistência e isolamento entre instituições serão conectados antes de disponibilizar dados ou gestão de acesso.</p><div class="inline-note">Nenhum banco conectado nesta etapa.</div></section>
  </div>
  <section class="panel setup-callout"><div><p class="eyebrow">CONTRATOS CLAROS DESDE O INÍCIO</p><h2>Experimente a validação de configuração.</h2><p>Confira as regras de nome e endereço. A validação é real; ela não cria uma instituição nem salva dados.</p></div><NuxtLink to="/admin/configuracao" class="button button-dark">Validar configuração <span aria-hidden="true">→</span></NuxtLink></section>
  </div>
</template>
