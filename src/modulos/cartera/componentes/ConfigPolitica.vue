<script setup lang="ts">
/**
 * Política de cartera: la versión vigente y una versión nueva (vencimiento, redondeo, pronto
 * pago, mora —a lo sumo 1,5 veces el interés bancario corriente—, orden de imputación y fondo
 * de imprevistos —al menos 1 % salvo suspensión de la asamblea—). Las versiones no se editan.
 */
import { computed, ref } from 'vue'
import type { OrdenImputacion, PoliticaCartera } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { comparar, esDecimal, porcentaje } from '@/formato/decimales'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { crearPolitica } from '../api'
import { IMPUTACION } from '../reglas'

const props = defineProps<{ politicas: PoliticaCartera[] }>()
const emit = defineEmits<{ creada: [] }>()

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const vigente = computed(() => props.politicas[0] ?? null)
const v = vigente.value
const form = ref({
  desde: hoyEn(entidad.zonaHoraria),
  dia: String(v?.dia_vencimiento ?? 10),
  redondeo: v?.redondeo ?? '100',
  pronto: v?.pronto_pago_porcentaje ?? '',
  diaPronto: v?.pronto_pago_dia ? String(v.pronto_pago_dia) : '',
  factor: v?.factor_mora ?? '1.5',
  imputacion: (v?.imputacion ?? 'intereses_primero') as OrdenImputacion,
  elegir: v?.permite_elegir_obligacion ?? false,
  fondo: v?.porcentaje_fondo ?? '1',
  suspendido: v?.fondo_suspendido ?? false,
})
const opcionesImputacion = (Object.keys(IMPUTACION) as OrdenImputacion[]).map((valor) => ({ valor, etiqueta: IMPUTACION[valor] }))
const problema = ref<string | null>(null)
const resultado = ref<string | null>(null)

const entero = (t: string) => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : NaN)

const crear = useAccion(() => {
  const f = form.value
  return crearPolitica(id.value, {
    vigente_desde: f.desde,
    dia_vencimiento: entero(f.dia),
    redondeo: f.redondeo,
    pronto_pago_porcentaje: f.pronto.trim() || null,
    pronto_pago_dia: f.diaPronto ? entero(f.diaPronto) : null,
    factor_mora: f.factor,
    imputacion: f.imputacion,
    permite_elegir_obligacion: f.elegir,
    porcentaje_fondo: f.fondo,
    fondo_suspendido: f.suspendido,
  })
})

async function alCrear() {
  const f = form.value
  const dia = entero(f.dia)
  problema.value = !(dia >= 1 && dia <= 28)
    ? 'El día de vencimiento va del 1 al 28.'
    : !esDecimal(f.factor) || comparar(f.factor, '1.5') > 0
      ? 'La mora no puede pasar de 1,5 veces el interés bancario corriente.'
      : !f.suspendido && (!esDecimal(f.fondo) || comparar(f.fondo, '1') < 0)
        ? 'El fondo de imprevistos es de al menos 1 % (salvo suspensión de la asamblea).'
        : null
  if (problema.value) return
  const r = await crear.ejecutar()
  if (!r.ok) return
  resultado.value = `Versión ${r.valor.version} de la política creada, vigente desde el ${fechaCalendario(r.valor.vigente_desde)}.`
  emit('creada')
}
</script>

<template>
  <div class="campos">
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <dl
      v-if="vigente"
      class="datos"
    >
      <div><dt>Versión</dt><dd>{{ vigente.version }} (desde el {{ fechaCalendario(vigente.vigente_desde) }})</dd></div>
      <div><dt>Vence</dt><dd>Día {{ vigente.dia_vencimiento }} de cada mes</dd></div>
      <div><dt>Mora</dt><dd>{{ vigente.factor_mora }} veces el interés bancario corriente</dd></div>
      <div><dt>Imputación</dt><dd>{{ IMPUTACION[vigente.imputacion] }}</dd></div>
      <div><dt>Fondo de imprevistos</dt><dd>{{ vigente.fondo_suspendido ? 'Suspendido' : porcentaje(vigente.porcentaje_fondo) }}</dd></div>
      <div v-if="vigente.pronto_pago_porcentaje"><dt>Pronto pago</dt><dd>{{ porcentaje(vigente.pronto_pago_porcentaje) }} hasta el día {{ vigente.pronto_pago_dia }}</dd></div>
    </dl>
    <form
      class="campos"
      novalidate
      aria-label="Versión nueva de la política"
      @submit.prevent="alCrear"
    >
      <div class="filtros">
        <HudFecha
          v-model="form.desde"
          etiqueta="Vigente desde"
        />
        <HudCampo
          v-model="form.dia"
          etiqueta="Día de vencimiento"
          modo-entrada="numeric"
        />
        <HudCampo
          v-model="form.redondeo"
          etiqueta="Redondear al múltiplo de"
          modo-entrada="decimal"
        />
        <HudCampo
          v-model="form.factor"
          etiqueta="Factor de mora"
          modo-entrada="decimal"
          ayuda="Veces el interés bancario corriente (máximo 1,5)."
        />
        <HudCampo
          v-model="form.pronto"
          etiqueta="Pronto pago % (opcional)"
          modo-entrada="decimal"
        />
        <HudCampo
          v-model="form.diaPronto"
          etiqueta="Pronto pago hasta el día"
          modo-entrada="numeric"
        />
        <HudSelector
          v-model="form.imputacion"
          etiqueta="Orden de imputación"
          :opciones="opcionesImputacion"
        />
        <HudCampo
          v-model="form.fondo"
          etiqueta="Fondo de imprevistos %"
          modo-entrada="decimal"
        />
      </div>
      <label class="casilla">
        <input
          v-model="form.elegir"
          type="checkbox"
        >
        Permitir elegir qué obligaciones cubre un pago
      </label>
      <label class="casilla">
        <input
          v-model="form.suspendido"
          type="checkbox"
        >
        La asamblea suspendió los aportes al fondo
      </label>
      <p
        v-if="problema ?? crear.error.value"
        class="error"
        role="alert"
      >
        {{ problema ?? crear.error.value }}
      </p>
      <div class="botones">
        <HudBoton
          tipo="submit"
          :cargando="crear.cargando.value"
        >
          Crear versión nueva
        </HudBoton>
      </div>
    </form>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
