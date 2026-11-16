<script setup lang="ts">
/**
 * Carga masiva de usuarios: plantilla → subir CSV/XLSX → vista previa con errores por fila →
 * confirmar (todo o nada).
 */
import { computed, ref, useId } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Importacion, VistaPreviaUsuarios } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import FlujoDosPasos, { type PasoFlujo } from '@/hud/componentes/FlujoDosPasos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import IDescargar from '~icons/tabler/download'
import { confirmarImportacion, descargarPlantilla, importarUsuarios } from '../api'

const props = defineProps<{ entidadId: string }>()
const emit = defineEmits<{ aplicada: [] }>()

const id = useId()
const paso = ref<PasoFlujo>('editar')
const archivo = ref<File | null>(null)
const previa = ref<VistaPreviaUsuarios | null>(null)
const aplicada = ref<Importacion | null>(null)
const errorArchivo = ref<string | null>(null)
const errorPlantilla = ref<string | null>(null)

const subir = useAccion((_clave, planilla: File) => importarUsuarios(props.entidadId, planilla), {
  alExito: (r) => {
    previa.value = r
    paso.value = 'revisar'
  },
})
const confirmar = useAccion((clave) => confirmarImportacion(props.entidadId, previa.value?.importacion.id ?? '', clave), {
  alExito: (r) => {
    aplicada.value = r
    paso.value = 'hecho'
    emit('aplicada')
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
    errorArchivo.value = 'Elija la planilla con los usuarios.'
    return
  }
  void subir.ejecutar(archivo.value)
}

async function plantilla() {
  errorPlantilla.value = null
  try {
    await descargarPlantilla(props.entidadId)
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
  <FlujoDosPasos
    v-model:paso="paso"
    :cargando="subir.cargando.value || confirmar.cargando.value"
    :error="error"
    :bloqueado="conErrores"
    accion="Crear los usuarios"
    @previsualizar="previsualizar"
    @confirmar="confirmar.ejecutar()"
    @reiniciar="reiniciar"
  >
    <template #formulario>
      <p class="ayuda">
        Columnas: <code>nombre</code>, <code>correo</code> y <code>rol</code> (código), y opcionales
        <code>usuario</code>, <code>telefono</code> y <code>documento</code>.
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
          :for="id"
          class="rotulo"
        >Planilla (CSV o XLSX)</label>
        <input
          :id="id"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          @change="elegir"
        >
      </div>
    </template>

    <template #vista-previa>
      <template v-if="previa">
        <p>
          {{ previa.importacion.filas_validas }} de {{ previa.importacion.total_filas }} filas son
          válidas.
        </p>
        <section
          v-if="previa.importacion.errores.length"
          class="errores"
          aria-labelledby="titulo-errores"
        >
          <h3 id="titulo-errores">
            Corrija estas filas y vuelva a subir la planilla
          </h3>
          <ul>
            <li
              v-for="e in previa.importacion.errores"
              :key="`${e.fila}-${e.mensaje}`"
            >
              Fila {{ e.fila }}: {{ e.mensaje }}
            </li>
          </ul>
        </section>
        <section
          v-if="previa.filas.length"
          aria-labelledby="titulo-validas"
        >
          <h3 id="titulo-validas">
            Filas válidas
          </h3>
          <ul class="validas">
            <li
              v-for="f in previa.filas"
              :key="f.fila"
            >
              Fila {{ f.fila }} · rol <strong>{{ f.rol }}</strong>
            </li>
          </ul>
        </section>
      </template>
    </template>

    <template #hecho>
      <p v-if="aplicada">
        Se crearon o vincularon {{ aplicada.resumen.usuarios }} usuarios
        ({{ aplicada.resumen.cuentas_nuevas }} cuentas nuevas). A cada uno le llegó un código o un
        aviso al correo.
      </p>
    </template>
  </FlujoDosPasos>
</template>

<style scoped>
.ayuda {
  margin: 0;
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

h3 {
  margin-bottom: 8px;
  font-size: 16px;
}

.errores {
  padding: 12px;
  border-left: 3px solid var(--magenta);
  background: color-mix(in srgb, var(--magenta) 8%, transparent);
}

ul {
  margin: 0;
  padding-left: 20px;
}

.validas {
  max-height: 240px;
  overflow-y: auto;
  color: var(--texto-2);
}

.error {
  margin: 0;
  color: var(--magenta);
}
</style>
