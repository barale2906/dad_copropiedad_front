<script setup lang="ts">
/** Insignia del plazo: vencido (rojo), por vencer (ámbar), a tiempo (verde) o sin plazo. */
import { computed } from 'vue'
import { semaforoVencimiento } from '@/formato/vencimiento'
import HudInsignia from './HudInsignia.vue'

const props = withDefaults(defineProps<{ venceEn?: string | null; vencido?: boolean; ahora?: Date }>(), {
  venceEn: null,
  vencido: false,
  ahora: () => new Date(),
})
const s = computed(() => semaforoVencimiento(props.venceEn, props.vencido, props.ahora))
</script>

<template>
  <HudInsignia :tono="s.tono">
    {{ s.texto }}
  </HudInsignia>
</template>
