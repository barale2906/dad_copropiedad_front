<script setup lang="ts">
/**
 * Un contrato del empleado en su ficha: fechas, línea de tiempo de versiones, saldo de
 * vacaciones y, si no está terminado, modificar las condiciones (versión nueva), prorrogar (solo
 * término fijo) y terminar con la **simulación** previa del costo. Emite `cambio` para que la
 * ficha se vuelva a pedir.
 */
import { computed, onMounted, ref } from 'vue'
import type { Administradora, ContratoConVersiones, MotivoTerminacion, SaldoVacaciones, SimulacionTerminacion as Simulacion } from '@/api/tipos'
import { mensajeDeError } from '@/api/errores'
import { useAccion } from '@/composables/useAccion'
import { opcionesDe } from '@/composables/textos-acceso'
import { numero } from '@/formato/decimales'
import { fechaCalendario, sumarDias } from '@/formato/fechas'
import { MOTIVO_TERMINACION, TIPO_CONTRATO } from '@/formato/nomina'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { modificarContrato, prorrogar, simularTerminacion, terminar, vacaciones as pedirVacaciones } from '../api'
import { condicionesDe, faltantesCondiciones, limpiarCondiciones, minimoNuevaVersion, terminado, versionVigente } from '../reglas'
import FormCondiciones from './FormCondiciones.vue'
import LineaTiempoVersiones from './LineaTiempoVersiones.vue'
import SimulacionTerminacion from './SimulacionTerminacion.vue'

const props = withDefaults(
  defineProps<{
    entidadId: string
    contrato: ContratoConVersiones
    administradoras: Administradora[]
    centros?: { valor: string; etiqueta: string }[]
    hoy: string
    puedeGestionar: boolean
    verSalarios: boolean
  }>(),
  { centros: () => [] },
)
const emit = defineEmits<{ cambio: [mensaje: string] }>()

const k = computed(() => props.contrato.contrato)
const cerrado = computed(() => terminado(props.contrato))
const vigente = computed(() => versionVigente(props.contrato, props.hoy))
const fijo = computed(() => k.value.tipo === 'termino_fijo')
const saldo = ref<SaldoVacaciones | null>(null)
const errorSaldo = ref<string | null>(null)

// Versión nueva
const editando = ref(false)
const desde = ref('')
const condiciones = ref(vigente.value ? condicionesDe(vigente.value) : null)
const aviso = ref<string | null>(null)
const version = useAccion((_c, f: string) => {
  const c = condiciones.value
  if (!c) throw new Error('Sin condiciones')
  return modificarContrato(props.entidadId, k.value.id, f, limpiarCondiciones(c, props.centros.length > 0))
}, { alConflicto: () => emit('cambio', '') })

function abrirVersion() {
  desde.value = minimoNuevaVersion(props.contrato)
  condiciones.value = vigente.value ? condicionesDe(vigente.value) : null
  aviso.value = null
  version.reiniciar()
  editando.value = true
}

async function guardarVersion() {
  const f = condiciones.value ? faltantesCondiciones(condiciones.value) : []
  if (f.length) {
    aviso.value = `Falta ${f.join(', ')}.`
    return
  }
  const r = await version.ejecutar(desde.value)
  if (!r.ok) return
  editando.value = false
  emit('cambio', `Las condiciones nuevas rigen desde el ${fechaCalendario(desde.value)}.`)
}

// Prórroga
const prorrogando = ref(false)
const nuevoFin = ref('')
const prorroga = useAccion((_c, f: string) => prorrogar(props.entidadId, k.value.id, f), { alConflicto: () => emit('cambio', '') })

function abrirProrroga() {
  nuevoFin.value = k.value.fecha_fin ? sumarDias(k.value.fecha_fin, 1) : props.hoy
  prorroga.reiniciar()
  prorrogando.value = true
}

async function guardarProrroga() {
  const r = await prorroga.ejecutar(nuevoFin.value)
  if (!r.ok) return
  prorrogando.value = false
  emit('cambio', `Contrato prorrogado hasta el ${fechaCalendario(nuevoFin.value)}.`)
}

// Terminación con simulación previa
const terminando = ref(false)
const fechaFin = ref('')
const motivo = ref<MotivoTerminacion | ''>('')
const simulacion = ref<Simulacion | null>(null)
const simular = useAccion((_c, f: string, m: MotivoTerminacion) => simularTerminacion(props.entidadId, k.value.id, f, m))
const terminacion = useAccion((_c, f: string, m: MotivoTerminacion) => terminar(props.entidadId, k.value.id, f, m), { alConflicto: () => emit('cambio', '') })
const listoParaTerminar = computed(() => !!fechaFin.value && !!motivo.value)
const erroresTerminacion = computed(() => [simular.error.value, terminacion.error.value].filter(Boolean))

function abrirTerminacion() {
  fechaFin.value = props.hoy
  motivo.value = fijo.value ? 'vencimiento_termino' : ''
  simulacion.value = null
  simular.reiniciar()
  terminacion.reiniciar()
  terminando.value = true
}

async function calcular() {
  if (!motivo.value) return
  const r = await simular.ejecutar(fechaFin.value, motivo.value)
  if (r.ok) simulacion.value = r.valor
}

async function guardarTerminacion() {
  if (!motivo.value) return
  const r = await terminacion.ejecutar(fechaFin.value, motivo.value)
  if (!r.ok) return
  terminando.value = false
  emit('cambio', `Contrato terminado el ${fechaCalendario(fechaFin.value)}. Liquide el periodo de esa fecha: trae las cesantías, la prima, las vacaciones y la indemnización.`)
}

async function cargarSaldo() {
  try {
    saldo.value = await pedirVacaciones(props.entidadId, k.value.id, k.value.fecha_terminacion ?? props.hoy)
  } catch (e) {
    errorSaldo.value = mensajeDeError(e)
  }
}

onMounted(cargarSaldo)
</script>

<template>
  <HudPanel :etiqueta="`Contrato ${TIPO_CONTRATO[k.tipo].toLowerCase()}`">
    <header class="encabezado">
      <h2>{{ TIPO_CONTRATO[k.tipo] }}</h2>
      <HudInsignia :tono="cerrado ? 'neutro' : 'exito'">
        {{ cerrado ? 'Terminado' : 'Vigente' }}
      </HudInsignia>
    </header>
    <dl class="datos">
      <div>
        <dt>Inicio</dt>
        <dd>{{ fechaCalendario(k.fecha_inicio) }}</dd>
      </div>
      <div v-if="k.fecha_fin">
        <dt>Vence</dt>
        <dd>{{ fechaCalendario(k.fecha_fin) }}</dd>
      </div>
      <div v-if="k.descripcion_obra">
        <dt>Obra o labor</dt>
        <dd>{{ k.descripcion_obra }}</dd>
      </div>
      <div v-if="k.fecha_terminacion">
        <dt>Terminado</dt>
        <dd>{{ fechaCalendario(k.fecha_terminacion) }}{{ k.motivo_terminacion ? ` · ${MOTIVO_TERMINACION[k.motivo_terminacion]}` : '' }}</dd>
      </div>
      <div v-if="saldo">
        <dt>Vacaciones pendientes</dt>
        <dd>{{ numero(saldo.pendientes) }} días <small>(causados {{ numero(saldo.causados) }}, disfrutados {{ numero(saldo.disfrutados) }})</small></dd>
      </div>
    </dl>
    <p
      v-if="errorSaldo"
      class="error"
    >
      {{ errorSaldo }}
    </p>

    <h3 class="rotulo">
      Historial de condiciones
    </h3>
    <LineaTiempoVersiones
      :versiones="contrato.versiones"
      :vigente-id="vigente?.id ?? null"
      :etiqueta="`Versiones del contrato ${TIPO_CONTRATO[k.tipo].toLowerCase()}`"
    />

    <div
      v-if="puedeGestionar && !cerrado"
      class="botones"
    >
      <HudBoton
        variante="secundario"
        @click="abrirVersion"
      >
        Modificar condiciones
      </HudBoton>
      <HudBoton
        v-if="fijo"
        variante="secundario"
        @click="abrirProrroga"
      >
        Prorrogar
      </HudBoton>
      <HudBoton
        variante="fantasma"
        @click="abrirTerminacion"
      >
        Terminar el contrato
      </HudBoton>
    </div>

    <HudDialogo
      v-model:abierto="editando"
      titulo="Modificar las condiciones"
    >
      <form
        class="campos"
        @submit.prevent="guardarVersion"
      >
        <p class="texto-2">
          Es una versión nueva: las anteriores no cambian. Rige desde una fecha posterior a la última.
        </p>
        <HudFecha
          v-model="desde"
          etiqueta="Rige desde"
          :minimo="minimoNuevaVersion(contrato)"
          requerido
        />
        <FormCondiciones
          v-if="condiciones"
          v-model="condiciones"
          :tipo-contrato="k.tipo"
          :administradoras="administradoras"
          :centros="centros"
          :salario-oculto="!verSalarios"
        />
        <p
          v-if="aviso"
          class="aviso"
          role="alert"
        >
          {{ aviso }}
        </p>
        <p
          v-if="version.error.value"
          class="error"
          role="alert"
        >
          {{ version.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="editando = false"
        >
          Volver
        </HudBoton>
        <HudBoton
          :cargando="version.cargando.value"
          @click="guardarVersion"
        >
          Guardar la versión
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="prorrogando"
      titulo="Prorrogar el contrato"
    >
      <HudFecha
        v-model="nuevoFin"
        etiqueta="Nueva fecha de terminación"
        :minimo="k.fecha_fin ? sumarDias(k.fecha_fin, 1) : undefined"
        requerido
      />
      <p
        v-if="prorroga.error.value"
        class="error"
        role="alert"
      >
        {{ prorroga.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="prorrogando = false"
        >
          Volver
        </HudBoton>
        <HudBoton
          :cargando="prorroga.cargando.value"
          :deshabilitado="!nuevoFin"
          @click="guardarProrroga"
        >
          Prorrogar
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="terminando"
      titulo="Terminar el contrato"
    >
      <div class="campos">
        <div class="filtros">
          <HudFecha
            v-model="fechaFin"
            etiqueta="Fecha de terminación"
            requerido
            @update:model-value="simulacion = null"
          />
          <HudSelector
            v-model="motivo"
            etiqueta="Motivo"
            vacio="Elija el motivo"
            :opciones="opcionesDe(MOTIVO_TERMINACION)"
            @update:model-value="simulacion = null"
          />
        </div>
        <HudBoton
          v-if="verSalarios"
          variante="secundario"
          :cargando="simular.cargando.value"
          :deshabilitado="!listoParaTerminar"
          @click="calcular"
        >
          Simular el costo
        </HudBoton>
        <SimulacionTerminacion
          v-if="simulacion"
          :simulacion="simulacion"
        />
        <p class="aviso">
          Después de registrarla, liquide el periodo de esa fecha: ahí llegan las prestaciones y la indemnización.
        </p>
        <p
          v-for="e in erroresTerminacion"
          :key="e ?? ''"
          class="error"
          role="alert"
        >
          {{ e }}
        </p>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="terminando = false"
        >
          Volver
        </HudBoton>
        <HudBoton
          :cargando="terminacion.cargando.value"
          :deshabilitado="!listoParaTerminar"
          @click="guardarTerminacion"
        >
          Registrar la terminación
        </HudBoton>
      </template>
    </HudDialogo>
  </HudPanel>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
<style scoped>
h3 {
  margin: 0;
}
</style>
