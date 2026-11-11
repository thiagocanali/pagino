<script setup lang="ts">
import type { NuxtError } from '#app'
defineProps<{ error: NuxtError }>()
</script>

<template>
  <div class="error-page"><BrandMark /><p class="eyebrow">VAMOS ENCONTRAR O CAMINHO</p><h1>{{ error.statusCode === 404 ? 'Esta página não foi encontrada.' : 'Algo interrompeu o caminho.' }}</h1><p>{{ error.statusCode === 404 ? 'Confira o endereço ou retorne ao início.' : 'Tente novamente em instantes.' }}</p><button class="button button-primary" @click="clearError({ redirect: '/' })">Voltar ao início →</button></div>
</template>
