<script setup lang="ts">
/**
 * Facturas de venta: listado por estado y periodo (las notas débito debajo de su factura),
 * factura nueva (`:id = nueva`) y detalle (`:id`). Con y sin contabilidad es la misma vista.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { EstadoFacturaVenta, FacturaVenta } from '@/api/tipos'
import { moneda } from '@/formato/decimales'
import { numeroFacturaVenta } from '@/formato/facturacion'
import { fechaCalendario } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { useTercerosConocidos } from '@/stores/terceros'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { facturas as pedirFacturas } from '../api'
import DetalleFactura from '../componentes/DetalleFactura.vue'
import NuevaFactura from '../componentes/NuevaFactura.vue'
import { agruparNotasDebito, ESTADO_FACTURA } from '../reglas'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const terceros = useTercerosConocidos()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const facturaId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (f = '') => ({ name: 'modulo', params: { ...route.params, accion: 'facturas', id: f }, query: {} })
const gestiona = computed(() => entidad.tienePermiso('facturacion.facturas.gestionar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<FacturaVenta[]>([])
const filtros = ref<{ estado: EstadoFacturaVenta | ''; desde: string; hasta: string }>({ estado: '', desde: '', hasta: '' })
const opcionesEstado = (Object.keys(ESTADO_FACTURA) as EstadoFacturaVenta[]).map((valor) => ({ valor, etiqueta: ESTADO_FACTURA[valor].texto }))

const filas = computed(() =>
  agruparNotasDebito(lista.value).map((f) => ({
    ...f,
    numeroTexto: f.esNota ? `↳ Nota débito ${numeroFacturaVenta(f)}` : numeroFacturaVenta(f),
    cliente: terceros.nombre(f.persona_id, 'Cliente'),
    vence: fechaCalendario(f.vencimiento),
  })),
)
const COLUMNAS = [
  { clave: 'numeroTexto', titulo: 'Factura' },
  { clave: 'cliente', titulo: 'Cliente' },
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'vence', titulo: 'Vence' },
  { clave: 'total', titulo: 'Total', alinear: 'fin' as const },
  { clave: 'estado', titulo: 'Estado' },
]

watch(lista, (l) => void terceros.resolver(id.value, l.map((f) => f.persona_id)))

async function cargar() {
  estado.value = 'cargando'
  try {
    const f = filtros.value
    lista.value = await pedirFacturas(id.value, { estado: f.estado || undefined, desde: f.desde || undefined, hasta: f.hasta || undefined })
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

async function creada(f: FacturaVenta) {
  await router.replace(ruta(f.id))
}

watch([facturaId, filtros], () => !facturaId.value && void cargar(), { immediate: true, deep: true })
</script>

<template>
  <section aria-labelledby="titulo-facturas">
    <template v-if="facturaId">
      <RouterLink
        class="volver"
        :to="ruta()"
      >
        <IVolver aria-hidden="true" /> Volver a las facturas
      </RouterLink>
      <h1 id="titulo-facturas">
        {{ facturaId === 'nueva' ? 'Factura nueva' : 'Factura de venta' }}
      </h1>
      <NuevaFactura
        v-if="facturaId === 'nueva'"
        @creada="creada"
      />
      <DetalleFactura
        v-else
        :factura-id="facturaId"
        @borrada="router.replace(ruta())"
      />
    </template>

    <template v-else>
      <header class="encabezado">
        <div>
          <h1 id="titulo-facturas">
            Facturas de venta
          </h1>
          <p class="texto-2">
            Borrador → emitida (número interno) → factura electrónica, si la entidad la tiene.
          </p>
        </div>
        <HudBoton
          v-if="gestiona"
          :a="ruta('nueva')"
        >
          <IMas aria-hidden="true" /> Factura nueva
        </HudBoton>
      </header>

      <div class="filtros">
        <HudSelector
          v-model="filtros.estado"
          etiqueta="Estado"
          vacio="Todos"
          :opciones="opcionesEstado"
        />
        <HudFecha
          v-model="filtros.desde"
          etiqueta="Desde"
          :maximo="filtros.hasta || undefined"
        />
        <HudFecha
          v-model="filtros.hasta"
          etiqueta="Hasta"
          :minimo="filtros.desde || undefined"
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
        v-else-if="filas.length === 0"
        estado="vacio"
        :mensaje="filtros.estado || filtros.desde || filtros.hasta ? 'Ninguna factura coincide con los filtros.' : 'Aún no hay facturas de venta.'"
      />
      <HudTabla
        v-else
        :filas="filas"
        :columnas="COLUMNAS"
        clave="id"
        titulo="Facturas de venta"
      >
        <template #celda-numeroTexto="{ fila }">
          <RouterLink :to="ruta(fila.id)">
            {{ fila.numeroTexto }}
          </RouterLink>
        </template>
        <template #celda-total="{ fila }">
          <span class="cifra">{{ moneda(fila.total) }}</span>
        </template>
        <template #celda-estado="{ fila }">
          <HudInsignia :tono="ESTADO_FACTURA[fila.estado].tono">
            {{ ESTADO_FACTURA[fila.estado].texto }}
          </HudInsignia>
        </template>
      </HudTabla>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
