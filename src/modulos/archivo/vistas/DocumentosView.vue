<script setup lang="ts">
/**
 * Archivo de la entidad: lo guardado (filtrable por clasificación, nombre y fechas, por cursor),
 * subir documentos con su clasificación y abrirlos con un enlace firmado de vida corta.
 */
import { computed, ref, useTemplateRef } from 'vue'
import { abrirArchivo, listarArchivos, subirArchivo } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { Archivo, ClasificacionArchivo } from '@/api/tipos'
import { useListado } from '@/composables/useListado'
import { fechaCalendario, fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudFiltros from '@/hud/componentes/HudFiltros.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import ISubir from '~icons/tabler/upload'
import {
  ACEPTA,
  aConsulta,
  CLASIFICACION,
  clasificacionesVisibles,
  type FiltrosPantalla,
  nombreTipo,
  puedeAbrir,
  tamanoLegible,
} from '../archivo'

const entidad = useEntidad()
const selector = useTemplateRef<HTMLInputElement>('selector')

const entidadId = computed(() => entidad.activa?.entidad_id ?? '')
const puedeSubir = computed(() => entidad.tienePermiso('archivos.subir'))
const puedeVer = computed(() => entidad.tienePermiso('archivos.ver'))

const VACIOS: FiltrosPantalla = { clasificacion: '', q: '', desde: '', hasta: '' }
const filtros = ref<FiltrosPantalla>({ ...VACIOS })

const archivos = useListado(
  (despues, f: FiltrosPantalla) => listarArchivos(entidadId.value, despues, aConsulta(f, entidad.zonaHoraria)),
  { filtros, inmediato: puedeVer.value },
)

const clasificacion = ref<ClasificacionArchivo>('interno')
const subiendo = ref(false)
const error = ref<string | null>(null)
const resultado = ref<string | null>(null)

const opciones = (Object.keys(CLASIFICACION) as ClasificacionArchivo[]).map((valor) => ({
  valor,
  etiqueta: CLASIFICACION[valor].texto,
}))
const opcionesFiltro = computed(() => [
  { valor: '', etiqueta: 'Todas' },
  ...clasificacionesVisibles(entidad.tienePermiso).map((valor) => ({ valor, etiqueta: CLASIFICACION[valor].texto })),
])

const activos = computed(() => {
  const f = filtros.value
  return [
    f.clasificacion && { clave: 'clasificacion', etiqueta: `Clasificación: ${CLASIFICACION[f.clasificacion].texto}` },
    f.q.trim() && { clave: 'q', etiqueta: `Nombre: ${f.q.trim()}` },
    f.desde && { clave: 'desde', etiqueta: `Desde ${fechaCalendario(f.desde)}` },
    f.hasta && { clave: 'hasta', etiqueta: `Hasta ${fechaCalendario(f.hasta)}` },
  ].filter((x): x is { clave: keyof FiltrosPantalla; etiqueta: string } => !!x)
})

const COLUMNAS = [
  { clave: 'nombre', titulo: 'Archivo' },
  { clave: 'clasificacion', titulo: 'Clasificación' },
  { clave: 'creado_en', titulo: 'Subido' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
]

function quitar(clave: string) {
  const k = clave as keyof FiltrosPantalla
  filtros.value = { ...filtros.value, [k]: VACIOS[k] }
}

async function elegidos(e: Event) {
  const elegidos = [...((e.target as HTMLInputElement).files ?? [])]
  if (selector.value) selector.value.value = ''
  if (elegidos.length === 0) return
  subiendo.value = true
  error.value = resultado.value = null
  const guardados: Archivo[] = []
  try {
    for (const archivo of elegidos) guardados.push(await subirArchivo(entidadId.value, archivo, clasificacion.value))
    resultado.value = guardados.length === 1 ? 'Archivo guardado.' : `${guardados.length} archivos guardados.`
  } catch (err) {
    error.value = `${guardados.length ? `Se guardaron ${guardados.length}; ` : ''}${mensajeDeError(err)}`
  } finally {
    subiendo.value = false
    if (guardados.length && puedeVer.value) void archivos.recargar()
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

    <template v-if="puedeVer">
      <HudFiltros
        :activos="activos"
        @quitar="quitar"
        @limpiar="filtros = { ...VACIOS }"
      >
        <HudCampo
          v-model="filtros.q"
          etiqueta="Nombre"
          autocompletar="off"
        />
        <HudSelector
          v-model="filtros.clasificacion"
          etiqueta="Clasificación del archivo"
          :opciones="opcionesFiltro"
        />
        <HudFecha
          v-model="filtros.desde"
          etiqueta="Subidos desde"
          :maximo="filtros.hasta || undefined"
        />
        <HudFecha
          v-model="filtros.hasta"
          etiqueta="Subidos hasta"
          :minimo="filtros.desde || undefined"
        />
      </HudFiltros>

      <HudEstado
        v-if="archivos.estado.value === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="archivos.estado.value === 'error'"
        estado="error"
        :mensaje="archivos.error.value ?? undefined"
        :referencia="archivos.referencia.value"
        @reintentar="archivos.recargar()"
      />
      <HudEstado
        v-else-if="archivos.estado.value === 'vacio'"
        estado="vacio"
        :mensaje="activos.length ? 'Ningún archivo coincide con los filtros.' : 'Aún no hay archivos guardados.'"
      />
      <template v-else>
        <HudTabla
          :filas="archivos.filas.value"
          :columnas="COLUMNAS"
          clave="id"
          titulo="Archivos de la entidad"
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
        <HudCargarMas
          :hay-mas="archivos.hayMas.value"
          :cargando="archivos.cargando.value"
          @cargar="archivos.cargarMas()"
        />
      </template>
    </template>
    <p
      v-else
      class="texto-2"
    >
      Puede subir archivos, pero consultar el archivo de la entidad requiere el permiso «Ver archivos».
    </p>
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
