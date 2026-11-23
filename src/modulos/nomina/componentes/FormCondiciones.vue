<script setup lang="ts">
/**
 * Condiciones de un contrato laboral (una versión): cargo, salario, jornada, afiliaciones y
 * forma de pago. Los campos cambian según el tipo de contrato y de salario (el aprendiz va con
 * apoyo de sostenimiento y su etapa; la jornada parcial, con sus horas; la transferencia, con
 * la cuenta). Se usa en el alta, en un contrato nuevo y en una versión nueva.
 */
import { computed } from 'vue'
import type { Administradora, CondicionesContrato, TipoAdministradora, TipoContratoLaboral } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { CLASE_RIESGO, ETAPA_APRENDIZAJE, JORNADA, MEDIO_PAGO, PERIODICIDAD, TIPO_CUENTA, TIPO_SALARIO } from '@/formato/nomina'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { camposCondiciones } from '../reglas'

const props = withDefaults(
  defineProps<{
    tipoContrato: TipoContratoLaboral
    administradoras: Administradora[]
    /** Centros de costo (solo con la contabilidad contratada). */
    centros?: { valor: string; etiqueta: string }[]
    /** Sin `nomina.salarios.ver` el salario y la cuenta llegan vacíos: hay que escribirlos de nuevo. */
    salarioOculto?: boolean
  }>(),
  { centros: () => [], salarioOculto: false },
)
const c = defineModel<CondicionesContrato>({ required: true })

const campos = computed(() => camposCondiciones(props.tipoContrato, c.value.tipo_salario, c.value.jornada, c.value.medio_pago))
const aprendiz = computed(() => props.tipoContrato === 'aprendizaje')
const salarios = computed(() => opcionesDe(TIPO_SALARIO).filter((o) => o.valor !== 'apoyo_sostenimiento'))
const de = (tipo: TipoAdministradora) =>
  props.administradoras.filter((a) => a.tipo === tipo && a.activa).map((a) => ({ valor: a.id, etiqueta: `${a.nombre} (${a.codigo})` }))

/** Enlace de un campo opcional (`null` en la petición, vacío en el selector). */
function opcional<K extends 'afp_id' | 'cesantias_id' | 'ccf_id' | 'arl_id' | 'centro_costo_id' | 'clase_riesgo' | 'etapa_aprendizaje'>(k: K) {
  return computed({
    get: () => (c.value[k] ?? '') as NonNullable<CondicionesContrato[K]> | '',
    set: (v) => (c.value = { ...c.value, [k]: v === '' ? null : v }),
  })
}
const afp = opcional('afp_id')
const cesantias = opcional('cesantias_id')
const ccf = opcional('ccf_id')
const arl = opcional('arl_id')
const centro = opcional('centro_costo_id')
const riesgo = opcional('clase_riesgo')
const etapa = opcional('etapa_aprendizaje')

function campo<K extends keyof CondicionesContrato>(k: K) {
  return computed({ get: () => c.value[k], set: (v) => (c.value = { ...c.value, [k]: v }) })
}
const cargo = campo('cargo')
const salario = campo('salario')
const tipoSalario = campo('tipo_salario')
const jornada = campo('jornada')
const periodicidad = campo('periodicidad')
const medio = campo('medio_pago')
const pensionado = campo('pensionado')
const eps = campo('eps_id')
const horas = computed({ get: () => c.value.horas_semanales ?? '', set: (v: string) => (c.value = { ...c.value, horas_semanales: v || null }) })

function enCuenta<K extends 'banco' | 'tipo' | 'numero'>(k: K) {
  return computed({
    get: () => c.value.cuenta?.[k] ?? (k === 'tipo' ? 'ahorros' : ''),
    set: (v) => (c.value = { ...c.value, cuenta: { banco: '', tipo: 'ahorros', numero: '', ...c.value.cuenta, [k]: v } }),
  })
}
const banco = enCuenta('banco')
const tipoCuenta = enCuenta('tipo')
const numeroCuenta = enCuenta('numero')
</script>

<template>
  <div class="campos">
    <div class="filtros">
      <HudCampo
        v-model="cargo"
        etiqueta="Cargo"
        requerido
      />
      <HudCampoMonto
        v-model="salario"
        :etiqueta="aprendiz ? 'Apoyo de sostenimiento mensual' : 'Salario mensual'"
        :ayuda="salarioOculto ? 'Su rol no ve el salario vigente: escríbalo de nuevo.' : undefined"
        requerido
      />
      <HudSelector
        v-if="!aprendiz"
        v-model="tipoSalario"
        etiqueta="Tipo de salario"
        :opciones="salarios"
      />
      <HudSelector
        v-if="campos.etapaAprendizaje"
        v-model="etapa"
        etiqueta="Etapa del aprendizaje"
        :opciones="opcionesDe(ETAPA_APRENDIZAJE)"
      />
      <HudSelector
        v-model="jornada"
        etiqueta="Jornada"
        :opciones="opcionesDe(JORNADA)"
      />
      <HudCampo
        v-if="campos.horasSemanales"
        v-model="horas"
        etiqueta="Horas semanales"
        modo-entrada="decimal"
        requerido
      />
      <HudSelector
        v-model="periodicidad"
        etiqueta="Periodicidad del pago"
        :opciones="opcionesDe(PERIODICIDAD)"
      />
    </div>

    <fieldset>
      <legend class="rotulo">
        Afiliaciones
      </legend>
      <div class="filtros">
        <HudSelector
          v-model="eps"
          etiqueta="EPS"
          vacio="Elija la EPS"
          :opciones="de('eps')"
          requerido
        />
        <HudSelector
          v-model="afp"
          etiqueta="Fondo de pensiones"
          vacio="Sin fondo"
          :opciones="de('afp')"
        />
        <HudSelector
          v-model="cesantias"
          etiqueta="Fondo de cesantías"
          vacio="Sin fondo"
          :opciones="de('cesantias')"
        />
        <HudSelector
          v-model="ccf"
          etiqueta="Caja de compensación"
          vacio="Sin caja"
          :opciones="de('ccf')"
        />
        <HudSelector
          v-model="arl"
          etiqueta="ARL"
          vacio="Sin ARL"
          :opciones="de('arl')"
        />
        <HudSelector
          v-model="riesgo"
          etiqueta="Clase de riesgo"
          vacio="Sin clase"
          :opciones="opcionesDe(CLASE_RIESGO)"
        />
      </div>
      <label class="casilla">
        <input
          v-model="pensionado"
          type="checkbox"
        >
        Ya está pensionado (no cotiza a pensión)
      </label>
    </fieldset>

    <fieldset>
      <legend class="rotulo">
        Pago
      </legend>
      <div class="filtros">
        <HudSelector
          v-model="medio"
          etiqueta="Medio de pago"
          :opciones="opcionesDe(MEDIO_PAGO)"
        />
        <template v-if="campos.cuenta">
          <HudCampo
            v-model="banco"
            etiqueta="Banco"
            requerido
          />
          <HudSelector
            v-model="tipoCuenta"
            etiqueta="Tipo de cuenta"
            :opciones="opcionesDe(TIPO_CUENTA)"
          />
          <HudCampo
            v-model="numeroCuenta"
            etiqueta="Número de la cuenta"
            modo-entrada="numeric"
            requerido
          />
        </template>
        <HudSelector
          v-if="centros.length"
          v-model="centro"
          etiqueta="Centro de costo"
          vacio="Sin centro de costo"
          :opciones="centros"
        />
      </div>
    </fieldset>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
<style scoped>
fieldset {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  border: 0;
}
</style>
