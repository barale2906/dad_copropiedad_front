<script setup lang="ts">
/** Libros de propietarios y de residentes (Ley 675, art. 51) a una fecha de corte: ver o descargar. */
import { computed, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { FilaLibroPropietarios, FilaLibroResidentes } from '@/api/tipos'
import { coeficiente } from '@/formato/decimales'
import { hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import IDescargar from '~icons/tabler/download'
import { descargarLibro, libroPropietarios, libroResidentes } from '../api'
import { CALIDAD } from '../censo'
import { TIPO_TITULARIDAD } from '../titulares'

type Libro = 'propietarios' | 'residentes'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')

const libro = ref<Libro>('propietarios')
const corte = ref(hoyEn(entidad.zonaHoraria))
const estado = ref<'inicio' | 'cargando' | 'listo' | 'error'>('inicio')
const error = ref<string | null>(null)
const propietarios = ref<FilaLibroPropietarios[]>([])
const residentes = ref<FilaLibroResidentes[]>([])
const descargando = ref(false)
const huella = ref<string | null>(null)

const OPCIONES = [
  { valor: 'propietarios' as const, etiqueta: 'Propietarios' },
  { valor: 'residentes' as const, etiqueta: 'Residentes' },
]
const COLUMNAS_PROPIETARIOS = [
  { clave: 'codigo', titulo: 'Bien' },
  { clave: 'nombre', titulo: 'Propietario' },
  { clave: 'derecho', titulo: 'Derecho' },
  { clave: 'coeficiente', titulo: 'Coeficiente', alinear: 'fin' as const },
]
const COLUMNAS_RESIDENTES = [
  { clave: 'codigo', titulo: 'Bien' },
  { clave: 'nombre', titulo: 'Residente' },
  { clave: 'calidad', titulo: 'Calidad' },
]
const filasP = computed(() => propietarios.value.map((f, i) => ({ ...f, id: String(i) })))
const filasR = computed(() => residentes.value.map((f, i) => ({ ...f, id: String(i) })))

async function consultar() {
  estado.value = 'cargando'
  huella.value = null
  try {
    if (libro.value === 'propietarios') propietarios.value = await libroPropietarios(id.value, corte.value)
    else residentes.value = await libroResidentes(id.value, corte.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

async function bajar(formato: 'csv' | 'pdf') {
  descargando.value = true
  error.value = null
  try {
    huella.value = (await descargarLibro(id.value, libro.value, corte.value, formato)).sha256
  } catch (e) {
    error.value = mensajeDeError(e)
  } finally {
    descargando.value = false
  }
}
</script>

<template>
  <section
    class="libros"
    aria-labelledby="titulo-libros"
  >
    <header>
      <h1 id="titulo-libros">
        Libros art. 51
      </h1>
      <p class="texto-2">
        Libro de propietarios y de residentes a una fecha de corte (Ley 675 de 2001).
      </p>
    </header>
    <form
      class="barra"
      @submit.prevent="consultar"
    >
      <HudSelector
        v-model="libro"
        etiqueta="Libro"
        :opciones="OPCIONES"
      />
      <HudFecha
        v-model="corte"
        etiqueta="Fecha de corte"
        requerido
      />
      <HudBoton tipo="submit">
        Consultar
      </HudBoton>
      <HudBoton
        variante="secundario"
        :cargando="descargando"
        @click="bajar('csv')"
      >
        <IDescargar aria-hidden="true" /> CSV
      </HudBoton>
      <HudBoton
        variante="secundario"
        :cargando="descargando"
        @click="bajar('pdf')"
      >
        <IDescargar aria-hidden="true" /> PDF
      </HudBoton>
    </form>
    <p
      v-if="huella"
      class="huella"
      role="status"
    >
      Descargado. Huella SHA-256: <code>{{ huella }}</code>
    </p>
    <HudEstado
      v-if="estado === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="estado === 'error' || (error && estado !== 'listo')"
      estado="error"
      :mensaje="error ?? undefined"
      @reintentar="consultar"
    />
    <template v-else-if="estado === 'listo'">
      <HudTabla
        v-if="libro === 'propietarios'"
        :filas="filasP"
        :columnas="COLUMNAS_PROPIETARIOS"
        clave="id"
        titulo="Libro de propietarios"
      >
        <template #celda-nombre="{ fila }">
          {{ fila.nombre }}<small v-if="fila.documento"> · {{ fila.tipo_documento }} {{ fila.documento }}</small>
        </template>
        <template #celda-derecho="{ fila }">
          {{ TIPO_TITULARIDAD[fila.tipo] }} {{ fila.porcentaje.replace('.', ',') }} %{{ fila.es_representante ? ' · representante' : '' }}
        </template>
        <template #celda-coeficiente="{ fila }">
          {{ fila.coeficiente ? coeficiente(fila.coeficiente) : '—' }}
        </template>
      </HudTabla>
      <HudTabla
        v-else
        :filas="filasR"
        :columnas="COLUMNAS_RESIDENTES"
        clave="id"
        titulo="Libro de residentes"
      >
        <template #celda-calidad="{ fila }">
          {{ CALIDAD[fila.calidad] }}{{ fila.es_responsable ? ' · responsable' : '' }}
        </template>
      </HudTabla>
    </template>
  </section>
</template>

<style scoped>
.libros {
  display: grid;
  gap: 16px;
}

h1 {
  font-size: clamp(24px, 3.5vw, 34px);
}

.texto-2 {
  margin: 4px 0 0;
  color: var(--texto-2);
}

.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
}

small {
  color: var(--texto-3);
}

.huella {
  margin: 0;
  color: var(--texto-2);
}

code {
  font-family: var(--fuente-mono);
  font-size: 13px;
  overflow-wrap: anywhere;
}
</style>
