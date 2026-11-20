<script setup lang="ts">
/** Formatos de información exógena por año (cada uno con su mapeo de cuentas a columnas). */
import { computed, onMounted, ref } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { CampoExogena, FormatoExogena, LadoExogena } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { leerDecimal, moneda } from '@/formato/decimales'
import { hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { catalogoTributario, crearFormatoExogena } from '../api-normativa'
import EditorTablaNormativa from './EditorTablaNormativa.vue'

const entidad = useEntidad()
const formatos = ref<FormatoExogena[]>([])
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)
const anio = ref('')
const resultado = ref<string | null>(null)
const campoVacio = (): CampoExogena => ({ concepto: '', cuenta_prefijo: '', columna: '', lado: 'debito' })
const vacio = () => ({ anio: hoyEn(entidad.zonaHoraria).slice(0, 4), codigo: '', nombre: '', resolucion: '', cuantia: '', campos: [campoVacio()] })
const nuevo = ref(vacio())

const LADOS: { valor: LadoExogena; etiqueta: string }[] = [
  { valor: 'debito', etiqueta: 'Débitos' },
  { valor: 'credito', etiqueta: 'Créditos' },
  { valor: 'neto', etiqueta: 'Saldo neto' },
]
const COLUMNAS = [
  { clave: 'nombre', titulo: 'Formato' },
  { clave: 'cuantia_menor', titulo: 'Cuantía menor', alinear: 'fin' as const },
  { clave: 'campos', titulo: 'Campos', alinear: 'fin' as const },
]
const filas = computed(() => formatos.value.filter((f) => !anio.value || String(f.anio) === anio.value))
const completo = computed(() => {
  const n = nuevo.value
  const campos = n.campos.every((c) => c.concepto.trim() && /^\d+$/.test(c.cuenta_prefijo) && c.columna.trim())
  return /^\d{4}$/.test(n.anio) && !!n.codigo.trim() && !!n.nombre.trim() && !!n.resolucion.trim() && !!leerDecimal(n.cuantia, 0) && campos
})

const crear = useAccion((clave) => {
  const n = nuevo.value
  return crearFormatoExogena(
    {
      anio: Number(n.anio),
      codigo: n.codigo.trim(),
      nombre: n.nombre.trim(),
      resolucion: n.resolucion.trim(),
      cuantia_menor: leerDecimal(n.cuantia, 0) ?? '0',
      campos: n.campos.map((c) => ({ ...c, concepto: c.concepto.trim(), columna: c.columna.trim() })),
    },
    clave,
  )
})

async function cargar() {
  estado.value = 'cargando'
  try {
    formatos.value = (await catalogoTributario()).formatos_exogena
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
    estado.value = 'error'
  }
}

function agregarCampo() {
  nuevo.value.campos = [...nuevo.value.campos, campoVacio()]
}

function quitarCampo(i: number) {
  nuevo.value.campos = nuevo.value.campos.filter((_, j) => j !== i)
}

async function enviar(cerrar: () => void) {
  if (!completo.value || !(await crear.ejecutar()).ok) return
  resultado.value = 'Formato registrado como versión siguiente del año.'
  nuevo.value = vacio()
  cerrar()
  await cargar()
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
    titulo="Información exógena"
    descripcion="Formatos de la DIAN con el mapeo de cuentas a columnas. Por debajo de la cuantía menor se agregan en el NIT 222222222."
    :anios="formatos.map((f) => f.anio)"
    accion="Nuevo formato"
  >
    <template #formulario="{ cerrar }">
      <form
        class="campos"
        novalidate
        @submit.prevent="enviar(cerrar)"
      >
        <div class="filtros">
          <HudCampo
            v-model="nuevo.anio"
            etiqueta="Año gravable"
            modo-entrada="numeric"
            :maximo="4"
          />
          <HudCampo
            v-model="nuevo.codigo"
            etiqueta="Código del formato"
          />
          <HudCampo
            v-model="nuevo.nombre"
            etiqueta="Nombre"
          />
          <HudCampo
            v-model="nuevo.resolucion"
            etiqueta="Resolución"
          />
          <HudCampo
            v-model="nuevo.cuantia"
            etiqueta="Cuantía menor (pesos)"
            modo-entrada="numeric"
          />
        </div>
        <fieldset class="mapeo">
          <legend>Mapeo de cuentas</legend>
          <div
            v-for="(c, i) in nuevo.campos"
            :key="i"
            class="filtros"
          >
            <HudCampo
              v-model="c.concepto"
              :etiqueta="`Concepto ${i + 1}`"
            />
            <HudCampo
              v-model="c.cuenta_prefijo"
              :etiqueta="`Prefijo de cuenta ${i + 1}`"
              modo-entrada="numeric"
            />
            <HudCampo
              v-model="c.columna"
              :etiqueta="`Columna ${i + 1}`"
            />
            <HudSelector
              v-model="c.lado"
              :etiqueta="`Valor que se toma ${i + 1}`"
              :opciones="LADOS"
            />
            <div>
              <HudBoton
                v-if="nuevo.campos.length > 1"
                variante="fantasma"
                @click="quitarCampo(i)"
              >
                Quitar<span class="solo-lector"> el campo {{ i + 1 }}</span>
              </HudBoton>
            </div>
          </div>
          <div>
            <HudBoton
              variante="secundario"
              @click="agregarCampo"
            >
              Agregar campo
            </HudBoton>
          </div>
        </fieldset>
        <div>
          <HudBoton
            tipo="submit"
            :deshabilitado="!completo"
            :cargando="crear.cargando.value"
          >
            Registrar formato
          </HudBoton>
        </div>
        <p
          v-if="crear.error.value"
          class="error"
          role="alert"
        >
          {{ crear.error.value }}
        </p>
      </form>
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
      mensaje="No hay formatos para ese año."
    />
    <HudTabla
      v-else
      :filas="filas"
      :columnas="COLUMNAS"
      clave="id"
      titulo="Formatos de exógena"
    >
      <template #celda-nombre="{ fila }">
        <span class="crece">
          <strong>{{ fila.anio }} · {{ fila.codigo }} v{{ fila.version }}</strong>
          <small>{{ fila.nombre }} · {{ fila.resolucion }}</small>
        </span>
      </template>
      <template #celda-cuantia_menor="{ fila }">
        <span class="cifra">{{ moneda(fila.cuantia_menor, 0) }}</span>
      </template>
      <template #celda-campos="{ fila }">
        <span class="cifra">{{ fila.campos.length }}</span>
      </template>
    </HudTabla>
  </EditorTablaNormativa>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
.mapeo {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 6px;
  font-weight: 600;
}
</style>
