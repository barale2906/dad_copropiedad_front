<script setup lang="ts">
/**
 * Comprobantes: lista entre dos fechas con filtros (tipo y estado), borradores arriba. Con
 * `:id` (o `nuevo`) monta el detalle con el editor.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { Comprobante, EstadoComprobante } from '@/api/tipos'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import IMas from '~icons/tabler/plus'
import { comprobantes as pedirComprobantes } from '../api'
import DetalleComprobante from '../componentes/DetalleComprobante.vue'
import { ESTADO_COMPROBANTE } from '../reglas'

const route = useRoute()
const entidad = useEntidad()
const plan = usePlanCuentas()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const comprobanteId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (c: string) => ({ name: 'modulo', params: { ...route.params, accion: 'comprobantes', id: c }, query: {} })

const hoy = hoyEn(entidad.zonaHoraria)
const desde = ref(`${hoy.slice(0, 8)}01`)
const hasta = ref(hoy)
const estadoFiltro = ref<EstadoComprobante | ''>('')
const tipoFiltro = ref('')
const opcionesEstado = (Object.keys(ESTADO_COMPROBANTE) as EstadoComprobante[]).map((valor) => ({ valor, etiqueta: ESTADO_COMPROBANTE[valor].texto }))
const opcionesTipo = computed(() => plan.tipos.map((t) => ({ valor: t.id, etiqueta: `${t.codigo} · ${t.nombre}` })))

const lista = ref<Comprobante[]>([])
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const filas = computed(() =>
  [...lista.value]
    .sort((a, b) => (a.estado === b.estado ? b.fecha.localeCompare(a.fecha) : a.estado === 'borrador' ? -1 : 1))
    .map((c) => ({ ...c, numeroTexto: c.numero ? `${c.tipo}-${c.numero}` : `${c.tipo} (borrador)`, fechaTexto: fechaCalendario(c.fecha) })),
)
const COLUMNAS = [
  { clave: 'fechaTexto', titulo: 'Fecha' },
  { clave: 'numeroTexto', titulo: 'Comprobante' },
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'estado', titulo: 'Estado' },
]

async function cargar() {
  if (comprobanteId.value) return
  estado.value = 'cargando'
  try {
    lista.value = await pedirComprobantes(id.value, {
      desde: desde.value || undefined,
      hasta: hasta.value || undefined,
      estado: estadoFiltro.value || undefined,
      tipo_comprobante_id: tipoFiltro.value || undefined,
    })
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch([desde, hasta, estadoFiltro, tipoFiltro, comprobanteId], () => void cargar())
onMounted(() => {
  void cargar()
  void plan.asegurar().catch(() => undefined)
})
</script>

<template>
  <section aria-labelledby="titulo-comprobantes">
    <DetalleComprobante
      v-if="comprobanteId"
      :comprobante-id="comprobanteId === 'nuevo' ? null : comprobanteId"
      titulo-id="titulo-comprobantes"
    />
    <template v-else>
      <header class="encabezado">
        <h1 id="titulo-comprobantes">
          Comprobantes
        </h1>
        <HudBoton
          v-if="entidad.tienePermiso('contabilidad.comprobantes.crear')"
          :a="ruta('nuevo')"
        >
          <IMas aria-hidden="true" /> Nuevo comprobante
        </HudBoton>
      </header>
      <div class="filtros">
        <HudFecha
          v-model="desde"
          etiqueta="Desde"
        />
        <HudFecha
          v-model="hasta"
          etiqueta="Hasta"
        />
        <HudSelector
          v-model="tipoFiltro"
          etiqueta="Tipo"
          vacio="Todos"
          :opciones="opcionesTipo"
        />
        <HudSelector
          v-model="estadoFiltro"
          etiqueta="Estado"
          vacio="Todos"
          :opciones="opcionesEstado"
        />
      </div>
      <HudEstado
        v-if="estado === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="estado === 'error'"
        estado="error"
        :mensaje="error ?? undefined"
        @reintentar="cargar"
      />
      <HudEstado
        v-else-if="!filas.length"
        estado="vacio"
        mensaje="No hay comprobantes con esos filtros."
      />
      <HudTabla
        v-else
        :filas="filas"
        :columnas="COLUMNAS"
        clave="id"
        titulo="Comprobantes"
      >
        <template #celda-numeroTexto="{ fila }">
          <RouterLink :to="ruta(fila.id)">
            {{ fila.numeroTexto }}
          </RouterLink>
        </template>
        <template #celda-estado="{ fila }">
          <HudInsignia :tono="ESTADO_COMPROBANTE[fila.estado].tono">
            {{ ESTADO_COMPROBANTE[fila.estado].texto }}
          </HudInsignia>
          <small v-if="fila.revertido_por"> · revertido</small>
          <small v-if="fila.revierte_a"> · reverso</small>
        </template>
      </HudTabla>
    </template>
  </section>
</template>

<style scoped src="./contabilidad.css"></style>
