<script setup lang="ts">
/** Visitas: historial filtrable por estado y, con `:id`, el detalle de una visita. */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { EstadoVisita, Visita } from '@/api/tipos'
import { useListado } from '@/composables/useListado'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import { listarVisitas } from '../api'
import DetalleVisita from '../componentes/DetalleVisita.vue'
import ListaVisitas from '../componentes/ListaVisitas.vue'
import { ESTADO_VISITA } from '../reglas'

const route = useRoute()
const entidad = useEntidad()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const visitaId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))

const filtroEstado = ref<EstadoVisita | ''>('')
const filtros = computed(() => ({ estado: filtroEstado.value || undefined }))
const opcionesEstado = (Object.keys(ESTADO_VISITA) as EstadoVisita[]).map((valor) => ({ valor, etiqueta: ESTADO_VISITA[valor].texto }))
const ruta = (v = '') => ({ name: 'modulo', params: { ...route.params, id: v } })
const detalle = (v: Visita) => ruta(v.id)

const listado = useListado(
  async (despues, f: { estado?: EstadoVisita }) => {
    const p = await listarVisitas(id.value, { estado: f.estado, despues })
    await bienes.resolver(p.datos.map((v) => v.bien_privado_id))
    return p
  },
  { filtros, retardo: 0 },
)
</script>

<template>
  <section aria-labelledby="titulo-visitas">
    <template v-if="visitaId">
      <RouterLink
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Todas las visitas
      </RouterLink>
      <DetalleVisita
        :entidad-id="id"
        :visita-id="visitaId"
      />
    </template>
    <template v-else>
      <header class="encabezado">
        <h1 id="titulo-visitas">
          Visitas
        </h1>
        <HudSelector
          v-model="filtroEstado"
          etiqueta="Estado"
          vacio="Todos"
          :opciones="opcionesEstado"
        />
      </header>
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
        v-else-if="listado.estado.value === 'vacio'"
        estado="vacio"
        mensaje="No hay visitas con ese filtro."
      />
      <template v-else>
        <ListaVisitas
          :visitas="listado.filas.value"
          titulo="Visitas"
          :detalle="detalle"
        />
        <HudCargarMas
          :hay-mas="listado.hayMas.value"
          :cargando="listado.cargando.value"
          @cargar="listado.cargarMas()"
        />
      </template>
    </template>
  </section>
</template>

<style scoped src="./porteria.css"></style>
<style scoped>
.volver {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  color: var(--cian);
}
</style>
