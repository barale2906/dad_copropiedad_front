<script setup lang="ts">
/**
 * Configuración general (versionada): marco técnico, cuenta de excedente o déficit del ejercicio
 * (clase 3 con movimiento) y desde cuándo se contabiliza. Guardar crea una versión nueva.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { ConfiguracionContable, MarcoTecnico } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { opcionesDe } from '@/composables/textos-acceso'
import { fechaCalendario, fechaHora, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SelectorCuenta from '@/hud/componentes/SelectorCuenta.vue'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import { configuracion as pedirConfiguracion, guardarConfiguracion } from '../../api'
import { MARCO_TECNICO } from '../../reglas'

const props = defineProps<{ entidadId: string; editable: boolean }>()

const entidad = useEntidad()
const plan = usePlanCuentas()
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const actual = ref<ConfiguracionContable | null>(null)
const marco = ref<MarcoTecnico | ''>('grupo_2')
const cuenta = ref('')
const desde = ref(`${hoyEn(entidad.zonaHoraria).slice(0, 4)}-01-01`)
const resultado = ref<string | null>(null)
const opcionesResultado = computed(() => plan.imputables.filter((c) => c.codigo.startsWith('3')).map((c) => ({ codigo: c.codigo, nombre: c.nombre })))

const guardar = useAccion(() => guardarConfiguracion(props.entidadId, { marco_tecnico: marco.value || 'grupo_2', cuenta_resultado: cuenta.value || null, vigente_desde: desde.value }))

function usar(c: ConfiguracionContable | null) {
  actual.value = c
  if (!c) return
  marco.value = c.marco_tecnico
  cuenta.value = c.cuenta_resultado_id ? (plan.porId.get(c.cuenta_resultado_id)?.codigo ?? '') : ''
  desde.value = c.vigente_desde
}

async function alGuardar() {
  const r = await guardar.ejecutar()
  if (!r.ok) return
  usar(r.valor)
  resultado.value = `Configuración guardada (versión ${r.valor.version}).`
}

async function cargar() {
  try {
    await plan.asegurar()
    usar(await pedirConfiguracion(props.entidadId))
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
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
    @reintentar="cargar"
  />
  <form
    v-else
    class="campos"
    @submit.prevent="alGuardar"
  >
    <p class="texto-2">
      <template v-if="actual">
        Versión {{ actual.version }} vigente desde {{ fechaCalendario(actual.vigente_desde) }} (creada el {{ fechaHora(actual.creada_en, entidad.zonaHoraria) }}){{ actual.plantilla_origen ? `; partió de «${actual.plantilla_origen}»` : '' }}.
      </template>
      <template v-else>
        Todavía no hay configuración: guárdela o aplique una plantilla.
      </template>
    </p>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <div class="filtros">
      <HudSelector
        v-model="marco"
        etiqueta="Marco técnico"
        :opciones="opcionesDe(MARCO_TECNICO)"
      />
      <HudFecha
        v-model="desde"
        etiqueta="Contabiliza desde"
      />
    </div>
    <SelectorCuenta
      v-model="cuenta"
      :opciones="opcionesResultado"
      etiqueta="Cuenta de excedente o déficit del ejercicio"
    />
    <p
      v-if="guardar.error.value"
      class="error"
      role="alert"
    >
      {{ guardar.error.value }}
    </p>
    <div
      v-if="editable"
      class="botones"
    >
      <HudBoton
        tipo="submit"
        :cargando="guardar.cargando.value"
      >
        Guardar la configuración
      </HudBoton>
    </div>
  </form>
</template>

<style scoped src="../../vistas/contabilidad.css"></style>
