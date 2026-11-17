<script setup lang="ts">
/**
 * Importar bienes privados desde una planilla: descargar la plantilla → subir CSV o XLSX →
 * vista previa con errores por fila → confirmar (todo o nada). Crea agrupaciones, bienes,
 * titulares y un cuadro de coeficientes **borrador**.
 */
import { computed, ref, useId } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Importacion, VistaPreviaBienes } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { coeficiente } from '@/formato/decimales'
import FlujoDosPasos, { type PasoFlujo } from '@/hud/componentes/FlujoDosPasos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import TablaErroresImportacion from '@/hud/componentes/TablaErroresImportacion.vue'
import { useEntidad } from '@/stores/entidad'
import IDescargar from '~icons/tabler/download'
import { confirmarImportacionBienes, descargarPlantillaBienes, importarBienes } from '../api'
import { TIPO_BIEN } from '../bienes'

const entidad = useEntidad()
const idEntidad = computed(() => entidad.activa?.entidad_id ?? '')
const idCampo = useId()

const paso = ref<PasoFlujo>('editar')
const archivo = ref<File | null>(null)
const previa = ref<VistaPreviaBienes | null>(null)
const aplicada = ref<Importacion | null>(null)
const errorArchivo = ref<string | null>(null)
const errorPlantilla = ref<string | null>(null)

const COLUMNAS = [
  { clave: 'fila', titulo: 'Fila', alinear: 'fin' as const },
  { clave: 'codigo', titulo: 'Bien' },
  { clave: 'agrupacion', titulo: 'Agrupación' },
  { clave: 'coeficiente', titulo: 'Coeficiente', alinear: 'fin' as const },
]
const filas = computed(() => (previa.value?.filas ?? []).map((f) => ({ ...f, id: String(f.fila) })))

const subir = useAccion((_c, planilla: File) => importarBienes(idEntidad.value, planilla), {
  alExito: (r) => {
    previa.value = r
    paso.value = 'revisar'
  },
})
const confirmar = useAccion((clave) => confirmarImportacionBienes(idEntidad.value, previa.value?.importacion.id ?? '', clave), {
  alExito: (r) => {
    aplicada.value = r
    paso.value = 'hecho'
  },
})
const conErrores = computed(() => previa.value?.importacion.estado !== 'validada')
const error = computed(() => errorArchivo.value ?? subir.error.value ?? confirmar.error.value)

function elegir(e: Event) {
  archivo.value = (e.target as HTMLInputElement).files?.[0] ?? null
  errorArchivo.value = null
}

function previsualizar() {
  if (!archivo.value) {
    errorArchivo.value = 'Elija la planilla con los bienes.'
    return
  }
  void subir.ejecutar(archivo.value)
}

async function plantilla() {
  errorPlantilla.value = null
  try {
    await descargarPlantillaBienes(idEntidad.value)
  } catch (e) {
    errorPlantilla.value = mensajeDeError(e)
  }
}

function reiniciar() {
  archivo.value = null
  previa.value = null
  aplicada.value = null
  subir.reiniciar()
  confirmar.reiniciar()
  paso.value = 'editar'
}
</script>

<template>
  <section
    class="importar"
    aria-labelledby="titulo-importar"
  >
    <header>
      <h1 id="titulo-importar">
        Importar planilla
      </h1>
      <p class="texto-2">
        Cargue de una vez los bienes privados, sus propietarios y sus coeficientes.
      </p>
    </header>
    <FlujoDosPasos
      v-model:paso="paso"
      :cargando="subir.cargando.value || confirmar.cargando.value"
      :error="error"
      :bloqueado="conErrores"
      accion="Crear los bienes"
      @previsualizar="previsualizar"
      @confirmar="confirmar.ejecutar()"
      @reiniciar="reiniciar"
    >
      <template #formulario>
        <p class="texto-2">
          Columnas: <code>codigo</code>, <code>tipo</code>, <code>agrupacion</code>, <code>coeficiente</code> (decimal con
          punto), <code>titular</code> y <code>documento</code>. Los copropietarios van en filas seguidas.
        </p>
        <HudBoton
          variante="secundario"
          @click="plantilla"
        >
          <IDescargar aria-hidden="true" /> Descargar plantilla
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
          >Planilla (CSV o XLSX)</label>
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
          <template v-else>
            <p class="texto-2">
              Se crearán {{ previa.importacion.resumen.bienes_privados }} bienes,
              {{ previa.importacion.resumen.agrupaciones_nuevas }} agrupaciones nuevas y
              {{ previa.importacion.resumen.titulares }} titulares. Los coeficientes quedan en un cuadro
              <strong>borrador</strong> para revisar y activar.
            </p>
            <HudTabla
              :filas="filas"
              :columnas="COLUMNAS"
              clave="id"
              titulo="Bienes que se crearán"
            >
              <template #celda-codigo="{ fila }">
                {{ fila.codigo }} · {{ TIPO_BIEN[fila.tipo] }}
              </template>
              <template #celda-agrupacion="{ fila }">
                {{ fila.agrupacion ?? '—' }}{{ fila.agrupacion_nueva ? ' (nueva)' : '' }}
              </template>
              <template #celda-coeficiente="{ fila }">
                {{ fila.coeficiente ? coeficiente(fila.coeficiente) : '—' }}
              </template>
            </HudTabla>
          </template>
        </template>
      </template>

      <template #hecho>
        <p v-if="aplicada">
          Listo: se crearon {{ aplicada.resumen.bienes_privados }} bienes y {{ aplicada.resumen.titulares }} titulares.
          Revise y active el cuadro de coeficientes en <strong>Coeficientes</strong>.
        </p>
      </template>
    </FlujoDosPasos>
  </section>
</template>

<style scoped>
.importar {
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

code {
  font-family: var(--fuente-mono);
  color: var(--cian);
}

.archivo {
  display: grid;
  gap: 6px;
}

.archivo input {
  min-height: 44px;
  font-size: 16px;
}

.error {
  margin: 0;
  color: var(--magenta);
}
</style>
