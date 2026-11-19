<script setup lang="ts">
/**
 * Facturas electrónicas recibidas de los proveedores: cargar el XML (la misma factura no entra
 * dos veces), listarlas por estado y abrir el detalle (`:id`) para registrarlas, rechazarlas y
 * registrar sus eventos RADIAN.
 */
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { aBase64 } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { EstadoFacturaRecibida, FacturaRecibida } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda } from '@/formato/decimales'
import { fechaCalendario } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import ISubir from '~icons/tabler/upload'
import { cargarRecibida, recibidas as pedirRecibidas } from '../api'
import DetalleRecibida from '../componentes/DetalleRecibida.vue'
import { ESTADO_RECIBIDA } from '../reglas'

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const recibidaId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (r = '') => ({ name: 'modulo', params: { ...route.params, accion: 'recibidas', id: r }, query: {} })
const selector = useTemplateRef<HTMLInputElement>('selector')

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<FacturaRecibida[]>([])
const filtro = ref<EstadoFacturaRecibida | ''>('')
const resultado = ref<string | null>(null)
const opcionesEstado = (Object.keys(ESTADO_RECIBIDA) as EstadoFacturaRecibida[]).map((valor) => ({ valor, etiqueta: ESTADO_RECIBIDA[valor].texto }))
const filas = computed(() => lista.value.map((f) => ({ ...f, numeroTexto: `${f.prefijo}${f.numero}`, fechaTexto: fechaCalendario(f.fecha) })))
const COLUMNAS = [
  { clave: 'numeroTexto', titulo: 'Factura' },
  { clave: 'emisor_nombre', titulo: 'Proveedor' },
  { clave: 'fechaTexto', titulo: 'Fecha' },
  { clave: 'total', titulo: 'Total', alinear: 'fin' as const },
  { clave: 'estado', titulo: 'Estado' },
]

const cargarXml = useAccion(async (_c, archivo: File) => cargarRecibida(id.value, archivo.name, await aBase64(archivo)))

async function elegido(e: Event) {
  const archivo = (e.target as HTMLInputElement).files?.[0]
  if (selector.value) selector.value.value = ''
  if (!archivo) return
  resultado.value = null
  const r = await cargarXml.ejecutar(archivo)
  if (!r.ok) return
  resultado.value = `Se cargó la factura ${r.valor.prefijo}${r.valor.numero} de ${r.valor.emisor_nombre}.`
  await cargar()
}

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = await pedirRecibidas(id.value, filtro.value || undefined)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch([recibidaId, filtro], () => !recibidaId.value && void cargar(), { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-recibidas">
    <template v-if="recibidaId">
      <RouterLink
        class="volver"
        :to="ruta()"
      >
        <IVolver aria-hidden="true" /> Volver a las recibidas
      </RouterLink>
      <h1 id="titulo-recibidas">
        Factura recibida
      </h1>
      <DetalleRecibida :recibida-id="recibidaId" />
    </template>

    <template v-else>
      <header class="encabezado">
        <div>
          <h1 id="titulo-recibidas">
            Facturas recibidas
          </h1>
          <p class="texto-2">
            Cargue el XML que le envió el proveedor; luego regístrela como compra y registre sus eventos RADIAN.
          </p>
        </div>
        <span>
          <input
            ref="selector"
            type="file"
            class="solo-lector"
            accept=".xml,application/xml,text/xml"
            tabindex="-1"
            aria-hidden="true"
            @change="elegido"
          >
          <HudBoton
            :cargando="cargarXml.cargando.value"
            @click="selector?.click()"
          >
            <ISubir aria-hidden="true" /> Cargar XML
          </HudBoton>
        </span>
      </header>
      <p
        v-if="resultado"
        class="ok"
        role="status"
      >
        {{ resultado }}
      </p>
      <p
        v-if="cargarXml.error.value"
        class="error"
        role="alert"
      >
        {{ cargarXml.error.value }}
      </p>
      <div class="filtros">
        <HudSelector
          v-model="filtro"
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
        v-else-if="filas.length === 0"
        estado="vacio"
        :mensaje="filtro ? 'Ninguna factura recibida en ese estado.' : 'Aún no ha cargado facturas recibidas.'"
      />
      <HudTabla
        v-else
        :filas="filas"
        :columnas="COLUMNAS"
        clave="id"
        titulo="Facturas recibidas"
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
          <HudInsignia :tono="ESTADO_RECIBIDA[fila.estado].tono">
            {{ ESTADO_RECIBIDA[fila.estado].texto }}
          </HudInsignia>
        </template>
      </HudTabla>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
