<script setup lang="ts">
/** Vigencia de una versión normativa: vigente, futura o vencida, con su fecha de inicio. */
import { computed } from 'vue'
import { fechaCalendario } from '@/formato/fechas'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import { TEXTO_VIGENCIA, vigencia, type Vigencia } from '../reglas'

const props = defineProps<{ version: Vigencia; hoy: string }>()
const texto = computed(() => TEXTO_VIGENCIA[vigencia(props.version, props.hoy)])
</script>

<template>
  <span class="vigencia">
    <HudInsignia :tono="texto.tono">{{ texto.texto }}</HudInsignia>
    <small>
      Desde {{ fechaCalendario(version.vigente_desde.slice(0, 10)) }}<template v-if="version.vigente_hasta">
        hasta {{ fechaCalendario(version.vigente_hasta.slice(0, 10)) }}
      </template>
    </small>
  </span>
</template>

<style scoped>
.vigencia {
  display: grid;
  justify-items: start;
  gap: 2px;
}

small {
  color: var(--texto-3);
}
</style>
