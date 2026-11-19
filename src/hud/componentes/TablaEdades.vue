<script setup lang="ts">
/**
 * Cartera por edades (corriente, 1–30, 31–60, 61–90 y más de 90 días) con su total. Sirve a la
 * cartera de la PH y a la cartera de clientes: recibe las filas ya calculadas por el backend
 * (montos como texto decimal). El nombre de cada fila se puede volver enlace con el slot
 * `nombre`. Los ceros se muestran vacíos para que se vea dónde está la mora.
 */
import { computed } from 'vue'
import { moneda } from '@/formato/decimales'
import HudTabla from './HudTabla.vue'

export interface FilaEdades {
  clave: string
  nombre: string
  corriente: string
  de_1_a_30: string
  de_31_a_60: string
  de_61_a_90: string
  mas_de_90: string
  total: string
}

const props = withDefaults(defineProps<{ filas: FilaEdades[]; total?: FilaEdades | null; titulo?: string; encabezado?: string }>(), {
  total: null,
  titulo: 'Cartera por edades',
  encabezado: 'Unidad',
})
defineSlots<{ nombre?: (p: { fila: FilaEdades }) => unknown }>()

const TRAMOS = [
  { clave: 'corriente', titulo: 'Corriente' },
  { clave: 'de_1_a_30', titulo: '1 a 30 días' },
  { clave: 'de_31_a_60', titulo: '31 a 60' },
  { clave: 'de_61_a_90', titulo: '61 a 90' },
  { clave: 'mas_de_90', titulo: 'Más de 90' },
] as const

const columnas = computed(() => [
  { clave: 'nombre', titulo: props.encabezado },
  ...TRAMOS.map((t) => ({ clave: t.clave, titulo: t.titulo, alinear: 'fin' as const })),
  { clave: 'total', titulo: 'Total', alinear: 'fin' as const },
])
const filasConTotal = computed(() => (props.total ? [...props.filas, { ...props.total, clave: '__total' }] : props.filas))
const monto = (t: string) => (/^-?0(\.0+)?$/.test(t) ? '' : moneda(t))
</script>

<template>
  <HudTabla
    :filas="filasConTotal"
    :columnas="columnas"
    clave="clave"
    :titulo="titulo"
  >
    <template #celda-nombre="{ fila }">
      <strong v-if="fila.clave === '__total'">{{ fila.nombre }}</strong>
      <slot
        v-else
        name="nombre"
        :fila="fila"
      >
        {{ fila.nombre }}
      </slot>
    </template>
    <template
      v-for="t in TRAMOS"
      :key="t.clave"
      #[`celda-${t.clave}`]="{ fila }"
    >
      <span
        class="cifra"
        :class="{ mora: t.clave !== 'corriente' && monto(fila[t.clave]) }"
      >{{ monto(fila[t.clave]) }}</span>
    </template>
    <template #celda-total="{ fila }">
      <strong class="cifra">{{ moneda(fila.total) }}</strong>
    </template>
  </HudTabla>
</template>

<style scoped>
.cifra {
  font-family: var(--fuente-mono);
  white-space: nowrap;
}

.mora {
  color: var(--ambar);
}
</style>
