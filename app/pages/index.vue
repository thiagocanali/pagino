<script setup lang="ts">
useSeoMeta({
  title: 'Pagino — presença digital para quem faz a diferença',
  description: 'Uma plataforma em construção para instituições criarem sites próprios, compartilharem seu trabalho e se aproximarem de suas comunidades.',
})
</script>

<template>
  <div class="landing-page">
    <section class="hero container" aria-labelledby="hero-heading">
      <div class="hero-copy">
        <p class="eyebrow"><span class="short-line" /> PRESENÇA DIGITAL, SEM COMPLICAÇÃO</p>
        <h1 id="hero-heading">O trabalho de vocês merece <span>ser visto.</span></h1>
        <p class="hero-description">O Pagino está nascendo para ajudar igrejas, ONGs e associações a contarem sua história com um site próprio, acolhedor e fácil de cuidar.</p>
        <div class="hero-actions">
          <NuxtLink to="/foundation" class="button button-primary">Conheça o projeto <span aria-hidden="true">→</span></NuxtLink>
          <a href="#como-funciona" class="button button-outline">Descubra a ideia <span aria-hidden="true">↓</span></a>
        </div>
        <p class="hero-footnote"><span class="status-dot" /> Projeto em desenvolvimento. A plataforma ainda não está aberta para cadastros.</p>
      </div>
      <div class="story-card" aria-label="Exemplo conceitual de um site institucional criado com o Pagino">
        <div class="story-top"><span class="eyebrow">UMA IDEIA EM CONSTRUÇÃO</span><span aria-hidden="true">↗</span></div>
        <div class="story-art" aria-hidden="true"><span class="arch arch-one" /><span class="arch arch-two" /><span class="sun" /><span class="art-line" /></div>
        <div class="concept-label">EXEMPLO CONCEITUAL</div>
        <h2>Um lugar para<br>chamar de seu.</h2>
        <p>Uma presença digital que começa com a sua história.</p>
        <div class="story-bottom"><span>Feito para a sua comunidade.</span><span aria-hidden="true">✳</span></div>
      </div>
    </section>

    <section id="como-funciona" class="principles container" aria-labelledby="principles-heading">
      <div class="section-heading"><p class="eyebrow">A IDEIA POR TRÁS DO PAGINO</p><h2 id="principles-heading">Menos barreiras.<br>Mais presença.</h2><p>Ferramentas digitais deveriam aproximar as pessoas — não criar mais trabalho.</p></div>
      <article class="principle"><span class="number">01</span><h3>Um site com identidade</h3><p>Uma estrutura pronta para apresentar quem vocês são, o que fazem e como participar.</p></article>
      <article class="principle"><span class="number">02</span><h3>Autonomia no dia a dia</h3><p>Uma experiência pensada para que cada instituição possa cuidar do próprio conteúdo.</p></article>
      <article class="principle"><span class="number">03</span><h3>Segurança desde a base</h3><p>Instituições e seus dados tratados com cuidado, privacidade e limites claros.</p></article>
    </section>

    <section class="closing container" aria-labelledby="closing-heading">
      <div><p class="eyebrow">UM PROJETO EM CONSTRUÇÃO</p><h2 id="closing-heading">Estamos preparando<br>um novo capítulo.</h2></div>
      <div class="closing-copy"><p>O Pagino ainda está sendo construído. Neste momento, você pode conhecer a fundação do projeto e acompanhar o que já está funcionando — sem promessas de funcionalidades que ainda não chegaram.</p><NuxtLink to="/foundation" class="text-link">Ver o que já está de pé <span aria-hidden="true">→</span></NuxtLink></div>
    </section>
  </div>
</template>
