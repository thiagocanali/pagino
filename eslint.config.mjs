import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  { ignores: ['.output/**', '.vercel/**', 'playwright-report/**', 'test-results/**'] },
  { files: ['app/pages/**/*.vue', 'app/layouts/*.vue', 'app/error.vue'], rules: { 'vue/multi-word-component-names': 'off' } },
)
