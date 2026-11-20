<script setup lang="ts">
/** Consumo de facturación electrónica: documentos transmitidos por entidad y tipo en un periodo. */
import { computed, ref, watch } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { ConsumoDocumentos, TipoDocumentoElectronico } from '@/api/tipos'
import { numero } from '@/formato/decimales'
import { hoyEn } from '@/formato/fechas'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { consumo } from '../api-cobros'

const entidad = useEntidad()
const hoy = hoyEn(entidad.zonaHoraria)
const desde = ref(`${hoy.slice(0, 8)}01`)
const hasta = ref(hoy)
const filas = ref<ConsumoDocumentos[]>([])
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)

const TIPO: Record<TipoDocumentoElectronico, string> = {
  factura: 'Facturas',
  nota_credito: 'Notas crédito',
  nota_debito: 'Notas débito',
  documento_soporte: 'Documentos soporte',
  nota_ajuste_ds: 'Notas de ajuste al documento soporte',
}
const COLUMNAS = [
  { clave: 'nombre', titulo: 'Entidad' },
  { clave: 'tipo', titulo: 'Documento' },
  { clave: 'cantidad', titulo: 'Cantidad', alinear: 'fin' as const },
]
const conClave = computed(() => filas.value.map((f) => ({ ...f, id: `${f.entidad_id}-${f.tipo}` })))
const total = computed(() => filas.value.reduce((t, f) => t + f.cantidad, 0))
const errorFechas = computed(() => (desde.value && hasta.value && desde.value > hasta.value ? 'La fecha inicial va antes de la final.' : null))

async function cargar() {
  if (!desde.value || !hasta.value || errorFechas.value) return
  estado.value = 'cargando'
  try {
    filas.value = await consumo(desde.value, hasta.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
    estado.value = 'error'
  }
}

watch([desde, hasta], () => void cargar(), { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-consumo">
    <header>
      <h1 id="titulo-consumo">
        Consumo de facturación electrónica
      </h1>
      <p class="texto-2">
        Documentos validados, enviados o en contingencia por entidad. Es la base para cobrar los paquetes.
      </p>
    </header>
    <div class="filtros">
      <HudFecha
        v-model="desde"
        etiqueta="Desde"
        :maximo="hasta || undefined"
      />
      <HudFecha
        v-model="hasta"
        etiqueta="Hasta"
        :minimo="desde || undefined"
        :error="errorFechas"
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
      :referencia="referencia"
      @reintentar="cargar()"
    />
    <HudEstado
      v-else-if="filas.length === 0"
      estado="vacio"
      mensaje="No se transmitieron documentos en ese periodo."
    />
    <template v-else>
      <p class="texto-2 cifra">
        Total del periodo: <strong>{{ numero(String(total), 0) }}</strong> documentos.
      </p>
      <HudTabla
        :filas="conClave"
        :columnas="COLUMNAS"
        clave="id"
        titulo="Documentos por entidad"
      >
        <template #celda-tipo="{ fila }">
          {{ TIPO[fila.tipo] }}
        </template>
        <template #celda-cantidad="{ fila }">
          <span class="cifra">{{ numero(String(fila.cantidad), 0) }}</span>
        </template>
      </HudTabla>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
