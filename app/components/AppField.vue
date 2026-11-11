<script setup lang="ts">
const model = defineModel<string>({ required: true })
defineProps<{ id: string; label: string; hint?: string; error?: string; placeholder?: string; maxlength?: number }>()
</script>

<template>
  <div class="field">
    <label :for="id">{{ label }}</label>
    <input
      :id="id" v-model="model" :name="id" :placeholder="placeholder" :maxlength="maxlength"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="[hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined"
      autocomplete="off"
    >
    <p v-if="hint" :id="`${id}-hint`" class="field-hint">{{ hint }}</p>
    <p v-if="error" :id="`${id}-error`" class="field-error">{{ error }}</p>
  </div>
</template>
