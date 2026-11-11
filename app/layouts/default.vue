<template>
  <div class="public-shell">
    <a href="#main" class="skip-link">Ir para o conteúdo</a>
    <header class="public-header container">
      <BrandMark />
      <div class="header-actions">
        <span class="development-label">Em desenvolvimento</span>
        <NuxtLink to="/admin" class="button button-outline">Acompanhar a fundação <span aria-hidden="true">↗</span></NuxtLink>
      </div>
    </header>
    <main id="main"><slot /></main>
    <footer class="public-footer container">
      <BrandMark />
      <p>Feito para quem tem algo a compartilhar.</p>
      <span>Fundação técnica · Pagino</span>
    </footer>
  </div>
</template>
