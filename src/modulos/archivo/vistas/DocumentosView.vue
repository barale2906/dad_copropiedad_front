<script setup lang="ts">
/**
 * Archivo de la entidad: subir documentos con su clasificación (público, interno, personal o
 * sensible) y abrirlos con un enlace firmado de vida corta. Muestra lo subido en esta sesión.
 */
import { computed, ref, useTemplateRef } from 'vue'
import { abrirArchivo, subirArchivo } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { ClasificacionArchivo } from '@/api/tipos'
import { fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import ISubir from '~icons/tabler/upload'
import { ACEPTA, CLASIFICACION, nombreTipo, puedeAbrir, tamanoLegible } from '../archivo'
import { useArchivoSubido } from '../store'

const entidad = useEntidad()
const subidos = useArchivoSubido()
const selector = useTemplateRef<HTMLInputElement>('selector')

const entidadId = computed(() => entidad.activa?.entidad_id ?? '')
const puedeSubir = computed(() => entidad.tienePermiso('archivos.subir'))
const lista = computed(() => subidos.de(entidadId.value))

const clasificacion = ref<ClasificacionArchivo>('interno')
const subiendo = ref(false)
const error = ref<string | null>(null)
const resultado = ref<string | null>(null)

const opciones = (Object.keys(CLASIFICACION) as ClasificacionArchivo[]).map((valor) => ({
  valor,
  etiqueta: CLASIFICACION[valor].texto,
}))

const COLUMNAS = [
  { clave: 'nombre', titulo: 'Archivo' },
  { clave: 'clasificacion', titulo: 'Clasificación' },
  { clave: 'creado_en', titulo: 'Subido' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
]

async function elegidos(e: Event) {
  const archivos = [...((e.target as HTMLInputElement).files ?? [])]
  if (selector.value) selector.value.value = ''
  if (archivos.length === 0) return
  subiendo.value = true
  error.value = resultado.value = null
  let listos = 0
  try {
    for (const archivo of archivos) {
      subidos.agregar(entidadId.value, await subirArchivo(entidadId.value, archivo, clasificacion.value))
      listos++
    }
    resultado.value = listos === 1 ? 'Archivo guardado.' : `${listos} archivos guardados.`
  } catch (err) {
    error.value = `${listos ? `Se guardaron ${listos}; ` : ''}${mensajeDeError(err)}`
  } finally {
    subiendo.value = false
  }
}

async function abrir(id: string) {
  error.value = null
  try {
    await abrirArchivo(entidadId.value, id)
  } catch (err) {
    error.value = mensajeDeError(err)
  }
}
</script>

<template>
  <section
    class="documentos"
    aria-labelledby="titulo-documentos"
  >
    <header>
      <h1 id="titulo-documentos">
        Documentos
      </h1>
      <p class="texto-2">
        Guarde los soportes de la entidad. Se abren con un enlace seguro que vence en 5 minutos.
      </p>
    </header>

    <HudPanel
      v-if="puedeSubir"
      etiqueta="Subir archivos"
    >
      <div class="subir">
        <HudSelector
          v-model="clasificacion"
          etiqueta="Clasificación"
          :opciones="opciones"
          :ayuda="CLASIFICACION[clasificacion].ayuda"
        />
        <input
          ref="selector"
          type="file"
          class="solo-lector"
          :accept="ACEPTA"
          multiple
          tabindex="-1"
          aria-hidden="true"
          @change="elegidos"
        >
        <HudBoton
          :cargando="subiendo"
          @click="selector?.click()"
        >
          <ISubir aria-hidden="true" /> Elegir archivos
        </HudBoton>
      </div>
      <p class="texto-3">
        PDF o imágenes (JPEG, PNG, WebP, HEIC). El tipo se verifica por el contenido.
      </p>
    </HudPanel>

    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>

    <HudPanel etiqueta="Subidos en esta sesión">
      <p
        v-if="lista.length === 0"
        class="texto-2"
      >
        Aún no ha subido archivos en esta sesión. Los documentos ya guardados se abren desde el
        módulo al que pertenecen (ficha, tickets, reservas…).
      </p>
      <HudTabla
        v-else
        :filas="lista"
        :columnas="COLUMNAS"
        clave="id"
        titulo="Archivos subidos en esta sesión"
      >
        <template #celda-nombre="{ fila }">
          <span class="archivo">
            <strong>{{ fila.nombre }}</strong>
            <small>{{ nombreTipo(fila.tipo) }} · {{ tamanoLegible(fila.tamano_bytes) }}</small>
            <small
              class="huella"
              :title="`SHA-256 ${fila.sha256}`"
            >SHA-256 {{ fila.sha256.slice(0, 12) }}…</small>
          </span>
        </template>
        <template #celda-clasificacion="{ fila }">
          <HudInsignia :tono="CLASIFICACION[fila.clasificacion].tono">
            {{ CLASIFICACION[fila.clasificacion].texto }}
          </HudInsignia>
        </template>
        <template #celda-creado_en="{ fila }">
          {{ fechaHora(fila.creado_en, entidad.zonaHoraria) }}
        </template>
        <template #celda-acciones="{ fila }">
          <HudBoton
            v-if="puedeAbrir(fila.clasificacion, entidad.tienePermiso)"
            variante="fantasma"
            @click="abrir(fila.id)"
          >
            Abrir<span class="solo-lector"> {{ fila.nombre }}</span>
          </HudBoton>
          <span
            v-else
            class="texto-3"
          >Requiere permiso para datos personales</span>
        </template>
      </HudTabla>
    </HudPanel>
  </section>
</template>

<style scoped>
.documentos {
  display: grid;
  gap: 16px;
}

h1 {
  font-size: clamp(26px, 3.5vw, 34px);
}

.texto-2,
.texto-3 {
  margin: 4px 0 0;
}

.texto-2 {
  color: var(--texto-2);
}

.texto-3 {
  color: var(--texto-3);
  font-size: 14px;
}

.subir {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
}

.subir > :first-child {
  flex: 1 1 240px;
}

.subir :deep(.hud-boton) {
  margin-top: 26px;
}

.archivo {
  display: grid;
  text-align: left;
}

small {
  color: var(--texto-3);
  overflow-wrap: anywhere;
}

.huella {
  font-family: var(--fuente-mono);
  font-size: 12px;
}

.ok,
.error {
  margin: 0;
}

.ok {
  padding: 10px 14px;
  border-left: 3px solid var(--verde);
  background: color-mix(in srgb, var(--verde) 10%, transparent);
}

.error {
  color: var(--magenta);
}
</style>
