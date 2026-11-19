<script setup lang="ts">
/**
 * Rubros de un presupuesto en borrador: nombre, concepto ordinario que lo financia, cuenta
 * contable contra la que se mide la ejecución y valor anual (se reparte en doce meses iguales;
 * el último mes absorbe el redondeo). Emite los rubros listos para la API.
 */
import { computed, ref } from 'vue'
import type { NuevoRubroPresupuesto, RubroPresupuesto } from '@/api/tipos'
import { comparar, esDecimal, moneda } from '@/formato/decimales'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SelectorCuenta from '@/hud/componentes/SelectorCuenta.vue'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import IMas from '~icons/tabler/plus'
import IQuitar from '~icons/tabler/trash'
import { repartirAnual, totalMeses } from '../reglas'
import { useCartera } from '../store'

const props = withDefaults(defineProps<{ rubros?: RubroPresupuesto[]; accion?: string; cargando?: boolean; error?: string | null }>(), {
  rubros: () => [],
  accion: 'Guardar rubros',
  cargando: false,
  error: null,
})
const emit = defineEmits<{ guardar: [rubros: NuevoRubroPresupuesto[]]; cancelar: [] }>()

const plan = usePlanCuentas()
const cartera = useCartera()
let clave = 0
const ordinarios = computed(() => cartera.conceptos.filter((c) => c.tipo === 'ordinaria' && c.activo).map((c) => ({ valor: c.id, etiqueta: `${c.codigo} · ${c.nombre}` })))
const cuentas = computed(() => plan.imputables.filter((c) => /^[56]/.test(c.codigo)).map((c) => ({ codigo: c.codigo, nombre: c.nombre })))
const nueva = () => ({ clave: ++clave, nombre: '', concepto: ordinarios.value[0]?.valor ?? '', cuenta: '', anual: '' })
const filas = ref(
  props.rubros.length
    ? props.rubros.map((r) => ({ clave: ++clave, nombre: r.nombre, concepto: r.concepto_cobro_id, cuenta: plan.porId.get(r.cuenta_contable_id)?.codigo ?? '', anual: totalMeses(r.valores_mensuales) }))
    : [nueva()],
)
const problema = ref<string | null>(null)
const total = computed(() => totalMeses(filas.value.map((f) => f.anual)))

function guardar() {
  if (filas.value.some((f) => !f.nombre.trim() || !f.concepto || !f.cuenta)) {
    problema.value = 'Cada rubro lleva nombre, concepto y cuenta.'
    return
  }
  if (filas.value.some((f) => !esDecimal(f.anual.trim()) || comparar(f.anual.trim(), '0') < 0)) {
    problema.value = 'Escriba el valor anual de cada rubro.'
    return
  }
  const sinCuenta = filas.value.find((f) => !plan.porCodigo.get(f.cuenta))
  if (sinCuenta) {
    problema.value = `La cuenta ${sinCuenta.cuenta} no existe en el plan de cuentas.`
    return
  }
  problema.value = null
  emit(
    'guardar',
    filas.value.map((f) => ({ nombre: f.nombre.trim(), concepto_cobro_id: f.concepto, cuenta_contable_id: plan.porCodigo.get(f.cuenta)?.id ?? '', valores_mensuales: repartirAnual(f.anual) })),
  )
}
</script>

<template>
  <form
    class="campos"
    novalidate
    aria-label="Rubros del presupuesto"
    @submit.prevent="guardar"
  >
    <ol
      class="lista"
      aria-label="Rubros"
    >
      <li
        v-for="(f, i) in filas"
        :key="f.clave"
      >
        <div class="filtros crece">
          <HudCampo
            v-model="f.nombre"
            :etiqueta="`Nombre del rubro ${i + 1}`"
          />
          <HudSelector
            v-model="f.concepto"
            :etiqueta="`Concepto del rubro ${i + 1}`"
            :opciones="ordinarios"
          />
          <SelectorCuenta
            v-model="f.cuenta"
            :opciones="cuentas"
            :etiqueta="`Cuenta del rubro ${i + 1}`"
          />
          <HudCampoMonto
            v-model="f.anual"
            :etiqueta="`Valor anual del rubro ${i + 1}`"
          />
        </div>
        <HudBoton
          variante="fantasma"
          :deshabilitado="filas.length <= 1"
          @click="filas.splice(i, 1)"
        >
          <IQuitar aria-hidden="true" /><span class="solo-lector">Quitar el rubro {{ i + 1 }}</span>
        </HudBoton>
      </li>
    </ol>
    <div class="botones">
      <HudBoton
        variante="secundario"
        @click="filas.push(nueva())"
      >
        <IMas aria-hidden="true" /> Agregar rubro
      </HudBoton>
    </div>
    <p class="texto-2 cifra">
      Total anual: <strong>{{ moneda(total) }}</strong> · {{ moneda(repartirAnual(total)[0] ?? '0') }} al mes
    </p>
    <p
      v-if="problema ?? error"
      class="error"
      role="alert"
    >
      {{ problema ?? error }}
    </p>
    <div class="botones">
      <HudBoton
        tipo="submit"
        :cargando="cargando"
      >
        {{ accion }}
      </HudBoton>
      <HudBoton
        variante="secundario"
        @click="emit('cancelar')"
      >
        Cancelar
      </HudBoton>
    </div>
  </form>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
