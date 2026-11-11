export default defineNuxtConfig({
  compatibilityDate: '2026-11-11',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      title: 'Pagino — seu site, seu controle',
      meta: [{ name: 'description', content: 'A fundação de uma plataforma para sites institucionais simples e bem cuidados.' }],
    },
  },
  routeRules: {
    '/admin/**': { headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } },
    '/api/**': { headers: { 'cache-control': 'no-store' } },
    '/**': { headers: { 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'x-frame-options': 'DENY' } },
  },
})
