<script setup lang="ts">
defineProps<{ tone?: 'neutral' | 'success'; label: string }>()
</script>

<template>
  <span class="status-badge" :class="{ 'status-success': tone === 'success' }">
    <span aria-hidden="true" />{{ label }}
  </span>
</template>
