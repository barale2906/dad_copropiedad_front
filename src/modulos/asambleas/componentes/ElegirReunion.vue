<script setup lang="ts">
/**
 * Lista de reuniones en ciertos estados para entrar a una acción (conducir, votar, proyectar,
 * acta, reportes) cuando la ruta llega sin `:id`.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { EstadoReunion } from '@/api/tipos'
import { useListado } from '@/composables/useListado'
import { fechaHora } from '@/formato/fechas'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import { useEntidad } from '@/stores/entidad'
import { listarReuniones } from '../api'
import { ESTADO_REUNION } from '../reglas'

const props = defineProps<{
  /** Acción a la que lleva cada reunión. */
  accion: string
  estados: EstadoReunion[]
  /** Nombre accesible de la lista. */
  etiqueta: string
  vacio: string
}>()

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)

const listado = useListado(async (despues) => {
  const p = await listarReuniones(id.value, despues)
  return { ...p, datos: p.datos.filter((r) => props.estados.includes(r.estado)) }
})
const ruta = (r: string) => ({ name: 'modulo', params: { ...route.params, accion: props.accion, id: r }, query: {} })
</script>

<template>
  <HudEstado
    v-if="listado.estado.value === 'cargando'"
    estado="cargando"
  />
  <HudEstado
    v-else-if="listado.estado.value === 'error'"
    estado="error"
    :mensaje="listado.error.value ?? undefined"
    @reintentar="listado.recargar()"
  />
  <HudEstado
    v-else-if="listado.filas.value.length === 0"
    estado="vacio"
    :mensaje="vacio"
  />
  <template v-else>
    <ul
      class="lista"
      :aria-label="etiqueta"
    >
      <li
        v-for="x in listado.filas.value"
        :key="x.id"
      >
        <HudInsignia :tono="ESTADO_REUNION[x.estado].tono">
          {{ ESTADO_REUNION[x.estado].texto }}
        </HudInsignia>
        <span class="crece">
          <RouterLink
            :to="ruta(x.id)"
            class="fila"
          ><strong>{{ x.titulo }}</strong></RouterLink>
          <small>{{ fechaHora(x.fecha_programada, zona) }}</small>
        </span>
      </li>
    </ul>
    <HudCargarMas
      :hay-mas="listado.hayMas.value"
      :cargando="listado.cargando.value"
      @cargar="listado.cargarMas()"
    />
  </template>
</template>

<style scoped src="../vistas/asambleas.css"></style>
