<template>
  <div class="admin-shell">
    <a href="#main" class="skip-link">Ir para o conteúdo</a>
    <aside class="sidebar">
      <BrandMark />
      <div class="workspace-label"><span class="workspace-icon" aria-hidden="true">P</span><div>Ambiente de preparação<small>Fundação do produto</small></div></div>
      <p class="nav-label">ESPAÇO DE TRABALHO</p>
      <nav aria-label="Navegação da fundação">
        <NuxtLink to="/admin" :exact-active-class="'selected'"><span aria-hidden="true">◫</span>Visão geral</NuxtLink>
        <NuxtLink to="/admin/configuracao" :exact-active-class="'selected'"><span aria-hidden="true">⚙</span>Validar configuração</NuxtLink>
      </nav>
      <div class="sidebar-note"><span class="eyebrow">UMA BASE BEM CUIDADA</span><p>Cada instituição terá seu próprio espaço. A conexão com autenticação e dados vem na próxima etapa.</p></div>
      <NuxtLink to="/" class="back-link">← Voltar ao início</NuxtLink>
    </aside>
    <div class="admin-content">
      <header class="admin-topbar"><span>Pagino <span class="breadcrumb-separator">/</span> Fundação técnica</span><StatusBadge label="Desenvolvimento local" /></header>
      <main id="main" class="admin-main"><slot /></main>
      <footer class="admin-footer">Sem instituição conectada · Nenhum dado institucional é armazenado nesta etapa.</footer>
    </div>
  </div>
</template>
