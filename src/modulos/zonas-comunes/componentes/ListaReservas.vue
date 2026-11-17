<script setup lang="ts">
/**
 * Tabla de reservas (tarjetas en móvil) con recurso, horario en la zona de la PH, bien, estado
 * y pago. Las acciones van en el slot `acciones` (cada vista ofrece las suyas). Resuelve los
 * códigos de los bienes en el store.
 */
import { computed, watch } from 'vue'
import type { Reserva } from '@/api/tipos'
import { comparar, moneda } from '@/formato/decimales'
import { fecha, horaEn } from '@/formato/fechas'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import { ESTADO_PAGO, ESTADO_RESERVA } from '../reservas'
import { useZonasComunes } from '../store'

const props = withDefaults(defineProps<{ reservas: Reserva[]; titulo: string; mostrarBien?: boolean }>(), { mostrarBien: true })
defineSlots<{ acciones?: (p: { fila: Reserva }) => unknown }>()

const entidad = useEntidad()
const zonas = useZonasComunes()
const bienes = useBienes()
const zona = computed(() => entidad.zonaHoraria)

const columnas = computed(() => [
  { clave: 'recurso', titulo: 'Zona' },
  { clave: 'horario', titulo: 'Cuándo' },
  ...(props.mostrarBien ? [{ clave: 'bien', titulo: 'Bien' }] : []),
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
])

watch(
  () => props.reservas,
  (lista) => {
    if (props.mostrarBien) {
      bienes.resolver(lista.map((r) => r.bien_privado_id))
    }
  },
  { immediate: true },
)
</script>

<template>
  <HudTabla
    :filas="reservas"
    :columnas="columnas"
    clave="id"
    :titulo="titulo"
  >
    <template #celda-recurso="{ fila }">
      <span class="celda">
        <strong>{{ zonas.nombreRecurso(fila.recurso_id) }}</strong>
        <small v-if="comparar(fila.valor, '0') > 0">{{ moneda(fila.valor) }}</small>
      </span>
    </template>
    <template #celda-horario="{ fila }">
      <span class="celda">
        <span>{{ fecha(fila.inicio, zona) }}</span>
        <small>{{ horaEn(fila.inicio, zona) }} – {{ horaEn(fila.fin, zona) }}</small>
      </span>
    </template>
    <template #celda-bien="{ fila }">
      {{ bienes.codigo(fila.bien_privado_id) }}
    </template>
    <template #celda-estado="{ fila }">
      <span class="insignias">
        <HudInsignia :tono="ESTADO_RESERVA[fila.estado].tono">{{ ESTADO_RESERVA[fila.estado].texto }}</HudInsignia>
        <HudInsignia
          v-if="ESTADO_PAGO[fila.estado_pago]"
          :tono="ESTADO_PAGO[fila.estado_pago]!.tono"
        >
          {{ ESTADO_PAGO[fila.estado_pago]!.texto }}
        </HudInsignia>
      </span>
    </template>
    <template #celda-acciones="{ fila }">
      <span class="acciones"><slot
        name="acciones"
        :fila="fila"
      /></span>
    </template>
  </HudTabla>
</template>

<style scoped>
.celda {
  display: grid;
  text-align: left;
}

small {
  color: var(--texto-3);
}

.insignias,
.acciones {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.acciones {
  justify-content: flex-end;
}
</style>
