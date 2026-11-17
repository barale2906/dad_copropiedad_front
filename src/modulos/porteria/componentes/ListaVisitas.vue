<script setup lang="ts">
/**
 * Visitas con su estado (semáforo), bien, tiempo de espera y acceso al detalle. Las que esperan
 * llamada se resaltan. El slot `acciones` recibe la visita para los botones rápidos.
 */
import type { RouteLocationRaw } from 'vue-router'
import type { Visita } from '@/api/tipos'
import { TIPO_VISITA } from '@/composables/textos-acceso'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import { useBienes } from '@/stores/bienes'
import { ESTADO_VISITA, transcurrido } from '../reglas'

defineProps<{ visitas: Visita[]; titulo: string; detalle: (v: Visita) => RouteLocationRaw; ahora?: Date }>()
defineSlots<{ acciones?(p: { visita: Visita }): unknown }>()
const bienes = useBienes()
</script>

<template>
  <ul
    class="lista"
    :aria-label="titulo"
  >
    <li
      v-for="v in visitas"
      :key="v.id"
      :class="{ urgente: v.estado === 'requiere_llamada' }"
    >
      <HudInsignia :tono="ESTADO_VISITA[v.estado].tono">
        {{ ESTADO_VISITA[v.estado].texto }}
      </HudInsignia>
      <span class="crece">
        <RouterLink :to="detalle(v)">
          <strong>{{ v.visitante_nombre }}</strong>
        </RouterLink>
        <small>
          {{ bienes.codigo(v.bien_privado_id) }} · {{ TIPO_VISITA[v.tipo] }}{{ v.placa ? ` · placa ${v.placa}` : '' }} ·
          {{ transcurrido(v.creada_en, ahora) }}
        </small>
      </span>
      <slot
        name="acciones"
        :visita="v"
      />
    </li>
  </ul>
</template>

<style scoped src="../vistas/porteria.css"></style>
<style scoped>
a {
  color: var(--texto);
}
</style>
