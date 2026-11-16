<script setup lang="ts">
/**
 * Pantalla común cuando un módulo o una acción no se puede usar: no contratado (con el contacto
 * comercial de `config.json`), sin acceso para el rol o próximamente.
 */
import { computed } from 'vue'
import { config } from '@/app/config'
import { type EstadoSeccion, type Seccion, TEXTO_ESTADO } from '@/escena/mapa-modulos'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import ICandado from '~icons/tabler/lock'

const props = defineProps<{ estado: Exclude<EstadoSeccion, 'activa'>; seccion: Seccion }>()

const contacto = computed(() => config().contactoComercial)

const TEXTO: Record<Exclude<EstadoSeccion, 'activa'>, string> = {
  no_contratada: 'Este módulo no está contratado para su entidad.',
  sin_acceso:
    'Su rol no tiene permiso para esta función. Si la necesita, pida al administrador de su entidad que se la asigne.',
  proximamente: 'Esta función estará disponible próximamente.',
}
const texto = computed(() => TEXTO[props.estado])
</script>

<template>
  <HudPanel
    :etiqueta="TEXTO_ESTADO[estado]"
    class="no-disponible"
  >
    <ICandado
      class="candado"
      aria-hidden="true"
    />
    <h1>{{ seccion.nombre }}</h1>
    <p class="resumen">
      {{ seccion.resumen }}
    </p>
    <p>{{ texto }}</p>
    <p v-if="estado === 'no_contratada'">
      <template v-if="contacto">
        Para contratarlo, escríbanos a
        <a :href="`mailto:${contacto}?subject=${encodeURIComponent(`Contratar ${seccion.nombre}`)}`">{{ contacto }}</a>.
      </template>
      <template v-else>
        Para contratarlo, comuníquese con DAD.
      </template>
    </p>
  </HudPanel>
</template>

<style scoped>
.no-disponible p {
  margin: 8px 0 0;
  max-width: 60ch;
  color: var(--texto-2);
}

.candado {
  margin-bottom: 8px;
  font-size: 32px;
  color: var(--ambar);
}

.resumen {
  color: var(--texto-3);
}
</style>
