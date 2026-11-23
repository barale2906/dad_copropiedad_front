<script setup lang="ts">
/**
 * Registrar una novedad de un contrato. El formulario cambia según su medida: las de horas y
 * las de valor llevan una fecha y su cantidad; las de días, el primero y el último día (las
 * vacaciones disfrutadas van en días calendario). Las dominicales solo en domingo o festivo, y
 * en las fechas de un periodo aprobado ya no se registran.
 */
import { computed, ref, watch } from 'vue'
import type { NuevaNovedad, TipoNovedad } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { esDomingo, esDominical, esSensible, medidaDe, TIPO_NOVEDAD } from '@/formato/nomina'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'

const props = withDefaults(
  defineProps<{
    /** Contratos vigentes a los que se les puede registrar (empleado y contrato). */
    contratos: { valor: string; etiqueta: string }[]
    /** ¿La fecha cae en un periodo aprobado o pagado? */
    cerrada?: (fecha: string) => boolean
    /** Sin `personas.datos_sensibles.ver` no se ofrecen las incapacidades ni las licencias de maternidad o paternidad. */
    verSensibles?: boolean
    fechaInicial?: string
    cargando?: boolean
    error?: string | null
  }>(),
  { cerrada: () => false, verSensibles: false, fechaInicial: '', cargando: false, error: null },
)
const emit = defineEmits<{ registrar: [contratoId: string, datos: NuevaNovedad] }>()

const contrato = ref(props.contratos.length === 1 ? (props.contratos[0]?.valor ?? '') : '')
const tipo = ref<TipoNovedad | ''>('')
const desde = ref(props.fechaInicial)
const hasta = ref(props.fechaInicial)
const cantidad = ref('')
const descripcion = ref('')
const aviso = ref<string | null>(null)

const tipos = computed(() => opcionesDe(TIPO_NOVEDAD).filter((o) => props.verSensibles || !esSensible(o.valor)))
const medida = computed(() => (tipo.value ? medidaDe(tipo.value) : null))
const dominicalMal = computed(() => !!tipo.value && esDominical(tipo.value) && !!desde.value && !esDomingo(desde.value))
const fechasCerradas = computed(() => (!!desde.value && props.cerrada(desde.value)) || (medida.value === 'dias' && !!hasta.value && props.cerrada(hasta.value)))

watch(desde, (d) => {
  if (!hasta.value || hasta.value < d) hasta.value = d
})

function faltantes(): string[] {
  const f: string[] = []
  if (!contrato.value) f.push('el empleado')
  if (!tipo.value) f.push('el tipo')
  if (!desde.value) f.push('la fecha')
  if (medida.value === 'dias' && (!hasta.value || hasta.value < desde.value)) f.push('el último día (no antes del primero)')
  if (medida.value && medida.value !== 'dias' && !cantidad.value.trim()) f.push(medida.value === 'horas' ? 'las horas' : 'el valor')
  return f
}

function enviar() {
  const f = faltantes()
  if (f.length || !tipo.value) {
    aviso.value = `Falta ${f.join(', ')}.`
    return
  }
  aviso.value = null
  const dias = medida.value === 'dias'
  emit('registrar', contrato.value, {
    tipo: tipo.value,
    desde: desde.value,
    hasta: dias ? hasta.value : null,
    cantidad: dias ? null : cantidad.value.trim(),
    descripcion: descripcion.value.trim() || null,
  })
}
</script>

<template>
  <form
    class="campos"
    @submit.prevent="enviar"
  >
    <div class="filtros">
      <HudSelector
        v-model="contrato"
        etiqueta="Empleado"
        vacio="Elija el empleado"
        :opciones="contratos"
      />
      <HudSelector
        v-model="tipo"
        etiqueta="Tipo de novedad"
        vacio="Elija el tipo"
        :opciones="tipos"
      />
      <HudFecha
        v-model="desde"
        :etiqueta="medida === 'dias' ? 'Primer día' : 'Fecha'"
        requerido
      />
      <HudFecha
        v-if="medida === 'dias'"
        v-model="hasta"
        etiqueta="Último día"
        :minimo="desde || undefined"
        requerido
      />
      <HudCampo
        v-if="medida === 'horas'"
        v-model="cantidad"
        etiqueta="Horas"
        modo-entrada="decimal"
        ayuda="De 0 a 24 en el día"
        requerido
      />
      <HudCampoMonto
        v-if="medida === 'valor'"
        v-model="cantidad"
        etiqueta="Valor"
        requerido
      />
    </div>
    <HudCampo
      v-model="descripcion"
      etiqueta="Descripción (opcional)"
    />
    <p
      v-if="tipo === 'vacaciones'"
      class="texto-2"
    >
      Las vacaciones disfrutadas se cuentan en días calendario.
    </p>
    <p
      v-if="dominicalMal"
      class="aviso"
      role="alert"
    >
      Esta novedad es de un domingo o festivo: revise la fecha (si es festivo, puede registrarla).
    </p>
    <p
      v-if="fechasCerradas"
      class="aviso"
      role="alert"
    >
      Esas fechas son de un periodo ya aprobado: ahí ya no se registran novedades.
    </p>
    <p
      v-if="aviso"
      class="aviso"
      role="alert"
    >
      {{ aviso }}
    </p>
    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
    <div class="botones">
      <HudBoton
        tipo="submit"
        :cargando="cargando"
        :deshabilitado="fechasCerradas"
      >
        Registrar la novedad
      </HudBoton>
    </div>
  </form>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
