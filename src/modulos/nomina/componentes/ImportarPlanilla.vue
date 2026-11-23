<script setup lang="ts">
/**
 * Importar una planilla de la nómina (empleados o novedades): descargar la plantilla → subir
 * CSV o XLSX → vista previa con los errores por fila → confirmar (todo o nada). El padre pasa
 * las llamadas; el flujo es el de las demás importaciones.
 */
import { computed, ref, useId } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Importacion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import FlujoDosPasos, { type PasoFlujo } from '@/hud/componentes/FlujoDosPasos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import TablaErroresImportacion from '@/hud/componentes/TablaErroresImportacion.vue'
import IDescargar from '~icons/tabler/download'

export interface FilaPrevia {
  fila: number
  codigo: string
  detalle: string
}

const props = defineProps<{
  /** Qué se crea (p. ej. «empleados»). */
  que: string
  columnas: string
  plantilla: () => Promise<unknown>
  subir: (archivo: File) => Promise<{ importacion: Importacion; filas: FilaPrevia[] }>
  confirmar: (importacionId: string) => Promise<Importacion>
  /** Texto del resultado con la importación aplicada. */
  hecho: (i: Importacion) => string
}>()
const emit = defineEmits<{ aplicada: [importacion: Importacion] }>()
const idCampo = useId()

const paso = ref<PasoFlujo>('editar')
const archivo = ref<File | null>(null)
const previa = ref<{ importacion: Importacion; filas: FilaPrevia[] } | null>(null)
const aplicada = ref<Importacion | null>(null)
const errorArchivo = ref<string | null>(null)
const errorPlantilla = ref<string | null>(null)
const COLUMNAS = [
  { clave: 'fila', titulo: 'Fila', alinear: 'fin' as const },
  { clave: 'codigo', titulo: 'Empleado' },
  { clave: 'detalle', titulo: 'Detalle' },
]
const filas = computed(() => (previa.value?.filas ?? []).map((f) => ({ ...f, id: String(f.fila) })))

const subida = useAccion((_c, a: File) => props.subir(a), {
  alExito: (r) => {
    previa.value = r
    paso.value = 'revisar'
  },
})
const confirmacion = useAccion(() => props.confirmar(previa.value?.importacion.id ?? ''), {
  alExito: (r) => {
    aplicada.value = r
    paso.value = 'hecho'
    emit('aplicada', r)
  },
})
const conErrores = computed(() => previa.value?.importacion.estado !== 'validada')
const error = computed(() => errorArchivo.value ?? subida.error.value ?? confirmacion.error.value)

function elegir(e: Event) {
  archivo.value = (e.target as HTMLInputElement).files?.[0] ?? null
  errorArchivo.value = null
}

function previsualizar() {
  if (!archivo.value) {
    errorArchivo.value = 'Elija la planilla.'
    return
  }
  void subida.ejecutar(archivo.value)
}

async function descargarPlantilla() {
  errorPlantilla.value = null
  try {
    await props.plantilla()
  } catch (e) {
    errorPlantilla.value = mensajeDeError(e)
  }
}

function reiniciar() {
  archivo.value = null
  previa.value = null
  aplicada.value = null
  subida.reiniciar()
  confirmacion.reiniciar()
  paso.value = 'editar'
}
</script>

<template>
  <FlujoDosPasos
    v-model:paso="paso"
    :cargando="subida.cargando.value || confirmacion.cargando.value"
    :error="error"
    :bloqueado="conErrores"
    :accion="`Crear los ${que}`"
    @previsualizar="previsualizar"
    @confirmar="confirmacion.ejecutar()"
    @reiniciar="reiniciar"
  >
    <template #formulario>
      <p class="texto-2">
        Columnas: {{ columnas }}. Separe con punto y coma.
      </p>
      <HudBoton
        variante="secundario"
        @click="descargarPlantilla"
      >
        <IDescargar aria-hidden="true" /> Descargar plantilla<span class="solo-lector"> de {{ que }}</span>
      </HudBoton>
      <p
        v-if="errorPlantilla"
        class="error"
        role="alert"
      >
        {{ errorPlantilla }}
      </p>
      <div class="archivo">
        <label
          :for="idCampo"
          class="rotulo"
        >Planilla de {{ que }} (CSV o XLSX)</label>
        <input
          :id="idCampo"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          @change="elegir"
        >
      </div>
    </template>

    <template #vista-previa>
      <template v-if="previa">
        <p>{{ previa.importacion.filas_validas }} de {{ previa.importacion.total_filas }} filas son válidas.</p>
        <TablaErroresImportacion
          v-if="previa.importacion.errores.length"
          :errores="previa.importacion.errores"
        />
        <HudTabla
          v-else
          :filas="filas"
          :columnas="COLUMNAS"
          clave="id"
          :titulo="`${que} que se crearán`"
        />
      </template>
    </template>

    <template #hecho>
      <p v-if="aplicada">
        {{ hecho(aplicada) }}
      </p>
    </template>
  </FlujoDosPasos>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
<style scoped>
.archivo {
  display: grid;
  gap: 6px;
}

.archivo input {
  min-height: 44px;
  font-size: 16px;
}
</style>
