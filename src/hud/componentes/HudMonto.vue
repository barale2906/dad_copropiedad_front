<script setup lang="ts">
/** Monto en pesos a partir del texto decimal del backend; los negativos se resaltan. */
import { computed } from 'vue'
import { comparar, moneda } from '@/formato/decimales'

const props = withDefaults(defineProps<{ valor: string; decimales?: number }>(), { decimales: 2 })

const negativo = computed(() => comparar(props.valor, '0') < 0)
</script>

<template>
  <span
    class="hud-monto"
    :class="{ negativo }"
  >{{ moneda(valor, decimales) }}</span>
</template>

<style scoped>
.hud-monto {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.negativo {
  color: var(--magenta);
}
</style>
