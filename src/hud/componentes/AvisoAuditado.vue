<script setup lang="ts">
/**
 * Confirmación antes de abrir una consulta sensible que queda en la auditoría (detalle de
 * votos reservados, contactos de una visita, datos tratados de una persona).
 */
import IOjo from '~icons/tabler/eye'
import HudBoton from './HudBoton.vue'
import HudDialogo from './HudDialogo.vue'

withDefaults(defineProps<{ que: string; cargando?: boolean }>(), { cargando: false })
const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ confirmar: [] }>()
</script>

<template>
  <HudDialogo
    v-model:abierto="abierto"
    titulo="Consulta registrada en la auditoría"
  >
    <p>
      Va a ver <strong>{{ que }}</strong>. Esta consulta queda registrada con su usuario, la fecha
      y la hora. Ábrala solo si la necesita para su trabajo.
    </p>
    <template #acciones>
      <HudBoton
        variante="fantasma"
        @click="abierto = false"
      >
        Cancelar
      </HudBoton>
      <HudBoton
        :cargando="cargando"
        @click="emit('confirmar')"
      >
        <IOjo aria-hidden="true" /> Ver de todos modos
      </HudBoton>
    </template>
  </HudDialogo>
</template>
