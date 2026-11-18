<script setup lang="ts">
/** Mantenimiento: órdenes de trabajo (y su detalle en `:id`), planes preventivos y obligaciones. */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePestana } from '@/composables/usePestana'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import DetalleOrden from '../componentes/DetalleOrden.vue'
import PanelObligaciones from '../componentes/PanelObligaciones.vue'
import PanelOrdenes from '../componentes/PanelOrdenes.vue'
import PanelPlanes from '../componentes/PanelPlanes.vue'

const PESTANAS = [
  { id: 'ordenes', texto: 'Órdenes de trabajo' },
  { id: 'planes', texto: 'Planes preventivos' },
  { id: 'obligaciones', texto: 'Obligaciones' },
] as const

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const pestana = usePestana(PESTANAS)
const ordenId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (o = '') => ({ name: 'modulo', params: { ...route.params, id: o }, query: o ? {} : { vista: 'ordenes' } })
</script>

<template>
  <section aria-labelledby="titulo-mantenimiento">
    <template v-if="ordenId">
      <RouterLink
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Órdenes de trabajo
      </RouterLink>
      <DetalleOrden
        :key="ordenId"
        :entidad-id="id"
        :orden-id="ordenId"
      />
    </template>
    <template v-else>
      <h1 id="titulo-mantenimiento">
        Mantenimiento
      </h1>
      <HudPestanas
        :pestanas="PESTANAS"
        etiqueta="Mantenimiento"
      />
      <PanelOrdenes
        v-if="pestana === 'ordenes'"
        :entidad-id="id"
        :detalle="ruta"
      />
      <PanelPlanes
        v-else-if="pestana === 'planes'"
        :entidad-id="id"
      />
      <PanelObligaciones
        v-else
        :entidad-id="id"
      />
    </template>
  </section>
</template>

<style scoped src="./administracion.css"></style>
