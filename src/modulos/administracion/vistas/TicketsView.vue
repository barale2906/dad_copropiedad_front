<script setup lang="ts">
/** PQRS: bandeja con filtros y semáforo, el detalle (`:id`) y la configuración de plazos. */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { EstadoTicket, PrioridadTicket, Ticket } from '@/api/tipos'
import { PRIORIDAD_TICKET, TIPO_TICKET } from '@/composables/textos-gestion'
import { useListado } from '@/composables/useListado'
import { usePestana } from '@/composables/usePestana'
import { fecha } from '@/formato/fechas'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SemaforoVencimiento from '@/hud/componentes/SemaforoVencimiento.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import { type FiltroTickets, listarTickets } from '../api'
import ConfigTickets from '../componentes/ConfigTickets.vue'
import DetalleTicket from '../componentes/DetalleTicket.vue'
import { ESTADO_TICKET, ticketPendiente } from '../reglas'

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const ticketId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const PESTANAS = computed(() => [
  { id: 'bandeja', texto: 'Bandeja' } as const,
  ...(entidad.tienePermiso('tickets.configurar') ? [{ id: 'configuracion', texto: 'Plazos y categorías' } as const] : []),
])
const pestana = usePestana([{ id: 'bandeja' }, { id: 'configuracion' }] as const)

const filtroEstado = ref<EstadoTicket | ''>('')
const filtroPrioridad = ref<PrioridadTicket | ''>('')
const vencidos = ref(route.query.vencidos === '1')
const mios = ref(false)
const filtros = computed<FiltroTickets>(() => ({
  estado: filtroEstado.value || undefined,
  prioridad: filtroPrioridad.value || undefined,
  vencidos: vencidos.value,
  mios: mios.value,
}))
const opcionesEstado = (Object.keys(ESTADO_TICKET) as EstadoTicket[]).map((valor) => ({ valor, etiqueta: ESTADO_TICKET[valor].texto }))
const opcionesPrioridad = (Object.keys(PRIORIDAD_TICKET) as PrioridadTicket[]).map((valor) => ({ valor, etiqueta: PRIORIDAD_TICKET[valor].texto }))
const listado = useListado((despues, f: FiltroTickets) => listarTickets(id.value, despues, f), { filtros, retardo: 0 })
const ruta = (t = '') => ({ name: 'modulo', params: { ...route.params, id: t }, query: {} })
const ordenados = computed<Ticket[]>(() =>
  [...listado.filas.value].sort((a, b) => Number(b.vencido) - Number(a.vencido) || (a.vence_en ?? '9').localeCompare(b.vence_en ?? '9')),
)
</script>

<template>
  <section aria-labelledby="titulo-tickets">
    <template v-if="ticketId">
      <RouterLink
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Bandeja de PQRS
      </RouterLink>
      <DetalleTicket
        :entidad-id="id"
        :ticket-id="ticketId"
      />
    </template>
    <template v-else>
      <h1 id="titulo-tickets">
        PQRS y tickets
      </h1>
      <HudPestanas
        v-if="PESTANAS.length > 1"
        :pestanas="PESTANAS"
        etiqueta="PQRS"
      />
      <ConfigTickets
        v-if="pestana === 'configuracion' && entidad.tienePermiso('tickets.configurar')"
        :entidad-id="id"
      />
      <template v-else>
        <div class="filtros">
          <HudSelector
            v-model="filtroEstado"
            etiqueta="Estado"
            vacio="Todos"
            :opciones="opcionesEstado"
          />
          <HudSelector
            v-model="filtroPrioridad"
            etiqueta="Prioridad"
            vacio="Todas"
            :opciones="opcionesPrioridad"
          />
          <label class="casilla">
            <input
              v-model="vencidos"
              type="checkbox"
            > Solo vencidos
          </label>
          <label class="casilla">
            <input
              v-model="mios"
              type="checkbox"
            > Asignados a mí
          </label>
        </div>
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
          mensaje="No hay PQRS con esos filtros."
        />
        <template v-else>
          <ul
            class="lista"
            aria-label="PQRS"
          >
            <li
              v-for="t in ordenados"
              :key="t.id"
              :class="{ urgente: t.vencido }"
            >
              <HudInsignia :tono="ESTADO_TICKET[t.estado].tono">
                {{ ESTADO_TICKET[t.estado].texto }}
              </HudInsignia>
              <span class="crece">
                <RouterLink
                  :to="ruta(t.id)"
                  class="fila"
                >
                  <strong>{{ t.asunto }}</strong>
                </RouterLink>
                <small>{{ t.numero }} · {{ TIPO_TICKET[t.tipo] }} · {{ PRIORIDAD_TICKET[t.prioridad].texto }} · {{ fecha(t.creado_en, zona) }}</small>
              </span>
              <SemaforoVencimiento
                v-if="ticketPendiente(t.estado)"
                :vence-en="t.vence_en"
                :vencido="t.vencido"
              />
            </li>
          </ul>
          <HudCargarMas
            :hay-mas="listado.hayMas.value"
            :cargando="listado.cargando.value"
            @cargar="listado.cargarMas()"
          />
        </template>
      </template>
    </template>
  </section>
</template>

<style scoped src="./administracion.css"></style>
