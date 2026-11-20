<script setup lang="ts">
/** Tasas de referencia (interés bancario corriente) por vigencia: base de la mora de la cartera. */
import { computed, onMounted, ref } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { TasaReferencia } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { leerDecimal, porcentaje } from '@/formato/decimales'
import { hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { crearTasaReferencia, tasasReferencia } from '../api-normativa'
import EditorTablaNormativa from './EditorTablaNormativa.vue'
import InsigniaVigencia from './InsigniaVigencia.vue'

const entidad = useEntidad()
const hoy = hoyEn(entidad.zonaHoraria)
const tasas = ref<TasaReferencia[]>([])
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)
const anio = ref('')
const resultado = ref<string | null>(null)
const vacio = () => ({ desde: '', hasta: '', tasa: '', resolucion: '', fuente: 'Superintendencia Financiera' })
const nueva = ref(vacio())

const COLUMNAS = [
  { clave: 'tasa_efectiva_anual', titulo: 'Tasa efectiva anual', alinear: 'fin' as const },
  { clave: 'resolucion', titulo: 'Resolución' },
  { clave: 'vigencia', titulo: 'Vigencia' },
]
const filas = computed(() =>
  [...tasas.value].sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde)).filter((t) => !anio.value || t.vigente_desde.startsWith(anio.value)),
)
const errorFechas = computed(() => (nueva.value.desde && nueva.value.hasta && nueva.value.hasta < nueva.value.desde ? 'El fin va después del inicio.' : null))
const completa = computed(() => {
  const n = nueva.value
  return !!(n.desde && n.hasta && !errorFechas.value && leerDecimal(n.tasa, 4) && n.resolucion.trim() && n.fuente.trim())
})

const crear = useAccion((clave) =>
  crearTasaReferencia(
    { vigente_desde: nueva.value.desde, vigente_hasta: nueva.value.hasta, tasa_efectiva_anual: leerDecimal(nueva.value.tasa, 4) ?? '0', resolucion: nueva.value.resolucion.trim(), fuente: nueva.value.fuente.trim() },
    clave,
  ),
)

async function cargar() {
  estado.value = 'cargando'
  try {
    tasas.value = await tasasReferencia()
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
    estado.value = 'error'
  }
}

async function enviar(cerrar: () => void) {
  if (!completa.value) return
  const r = await crear.ejecutar()
  if (!r.ok) return
  tasas.value = [...tasas.value, r.valor]
  resultado.value = 'Tasa registrada.'
  nueva.value = vacio()
  cerrar()
}

onMounted(cargar)
</script>

<template>
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
  <EditorTablaNormativa
    v-else
    v-model:anio="anio"
    titulo="Tasas de referencia"
    descripcion="Interés bancario corriente certificado (consumo y ordinario). Las PH calculan la mora con la vigente."
    :anios="tasas.map((t) => Number(t.vigente_desde.slice(0, 4)))"
    accion="Nueva tasa"
  >
    <template #formulario="{ cerrar }">
      <form
        class="filtros"
        novalidate
        @submit.prevent="enviar(cerrar)"
      >
        <HudFecha
          v-model="nueva.desde"
          etiqueta="Vigente desde"
        />
        <HudFecha
          v-model="nueva.hasta"
          etiqueta="Vigente hasta"
          :minimo="nueva.desde || undefined"
          :error="errorFechas"
        />
        <HudCampo
          v-model="nueva.tasa"
          etiqueta="Tasa efectiva anual (%)"
          modo-entrada="decimal"
        />
        <HudCampo
          v-model="nueva.resolucion"
          etiqueta="Resolución"
        />
        <HudCampo
          v-model="nueva.fuente"
          etiqueta="Fuente"
        />
        <div>
          <HudBoton
            tipo="submit"
            :deshabilitado="!completa"
            :cargando="crear.cargando.value"
          >
            Registrar tasa
          </HudBoton>
        </div>
      </form>
      <p
        v-if="crear.error.value"
        class="error"
        role="alert"
      >
        {{ crear.error.value }}
      </p>
    </template>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <HudEstado
      v-if="filas.length === 0"
      estado="vacio"
      mensaje="No hay tasas registradas para ese año."
    />
    <HudTabla
      v-else
      :filas="filas"
      :columnas="COLUMNAS"
      clave="id"
      titulo="Tasas de referencia"
    >
      <template #celda-tasa_efectiva_anual="{ fila }">
        <span class="cifra">{{ porcentaje(fila.tasa_efectiva_anual, 2) }}</span>
      </template>
      <template #celda-resolucion="{ fila }">
        <span class="crece">
          <span>{{ fila.resolucion }}</span>
          <small>{{ fila.fuente }}</small>
        </span>
      </template>
      <template #celda-vigencia="{ fila }">
        <InsigniaVigencia
          :version="fila"
          :hoy="hoy"
        />
      </template>
    </HudTabla>
  </EditorTablaNormativa>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
