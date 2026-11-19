<script setup lang="ts">
/**
 * Estado de cuenta de un bien en la cartera de la PH: saldo, vencido, anticipos y referencia de
 * pago; las obligaciones (concepto, periodo, valor, lo aplicado y los ajustes, saldo y
 * vencimiento) y los pagos aplicados. Los saldos los calcula el backend: aquí solo se
 * muestran. Sirve a la administración y al portal del propietario; las acciones sobre cada
 * obligación van en el slot `acciones` (p. ej. una nota crédito).
 */
import { computed } from 'vue'
import type { EstadoCuenta, Obligacion } from '@/api/tipos'
import { comparar, moneda, sumar } from '@/formato/decimales'
import { fechaCalendario } from '@/formato/fechas'
import HudInsignia from './HudInsignia.vue'
import HudTabla from './HudTabla.vue'

const props = withDefaults(defineProps<{ estado: EstadoCuenta; soloPendientes?: boolean }>(), { soloPendientes: false })
const slots = defineSlots<{ acciones?: (p: { obligacion: Obligacion }) => unknown }>()

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const periodo = (p: string) => `${MESES[Number(p.slice(5, 7)) - 1] ?? ''} ${p.slice(0, 4)}`
const vencida = (o: Obligacion) => o.vencimiento < props.estado.corte && comparar(o.saldo, '0') > 0
const filas = computed(() =>
  props.estado.obligaciones
    .filter((o) => o.estado === 'vigente' && (!props.soloPendientes || comparar(o.saldo, '0') > 0))
    .sort((a, b) => a.vencimiento.localeCompare(b.vencimiento)),
)
const conceptoDe = (obligacionId: string) => props.estado.obligaciones.find((o) => o.id === obligacionId)
const columnas = computed(() => [
  { clave: 'concepto', titulo: 'Concepto' },
  { clave: 'valor', titulo: 'Valor', alinear: 'fin' as const },
  { clave: 'abonos', titulo: 'Pagado y ajustes', alinear: 'fin' as const },
  { clave: 'saldo', titulo: 'Saldo', alinear: 'fin' as const },
  { clave: 'vencimiento', titulo: 'Vence' },
  ...(slots.acciones ? [{ clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const }] : []),
])
const abonos = (o: Obligacion) => moneda(sumar(o.aplicado, o.ajustes))
</script>

<template>
  <div class="estado-cuenta">
    <dl class="resumen">
      <div>
        <dt>Saldo</dt>
        <dd class="grande">
          {{ moneda(estado.saldo) }}
        </dd>
      </div>
      <div>
        <dt>Vencido</dt>
        <dd :class="{ mora: comparar(estado.vencido, '0') > 0 }">
          {{ moneda(estado.vencido) }}
        </dd>
      </div>
      <div v-if="comparar(estado.anticipos, '0') > 0">
        <dt>Anticipos</dt>
        <dd>{{ moneda(estado.anticipos) }}</dd>
      </div>
      <div>
        <dt>Corte</dt>
        <dd>{{ fechaCalendario(estado.corte) }}</dd>
      </div>
      <div v-if="estado.bien.referencia_pago">
        <dt>Referencia de pago</dt>
        <dd><strong>{{ estado.bien.referencia_pago }}</strong></dd>
      </div>
    </dl>

    <p
      v-if="filas.length === 0"
      class="vacio"
    >
      {{ soloPendientes ? 'No hay obligaciones pendientes.' : 'Aún no hay obligaciones.' }}
    </p>
    <HudTabla
      v-else
      :filas="filas"
      :columnas="columnas"
      clave="id"
      :titulo="`Obligaciones de ${estado.bien.codigo}`"
    >
      <template #celda-concepto="{ fila }">
        <span class="concepto">
          <strong>{{ fila.concepto_nombre }}</strong>
          <small>{{ periodo(fila.periodo) }}{{ fila.descripcion ? ` · ${fila.descripcion}` : '' }}</small>
        </span>
      </template>
      <template #celda-valor="{ fila }">
        <span class="cifra">{{ moneda(fila.valor) }}</span>
      </template>
      <template #celda-abonos="{ fila }">
        <span class="cifra">{{ abonos(fila) }}</span>
      </template>
      <template #celda-saldo="{ fila }">
        <strong class="cifra">{{ moneda(fila.saldo) }}</strong>
      </template>
      <template #celda-vencimiento="{ fila }">
        <span class="vence">
          {{ fechaCalendario(fila.vencimiento) }}
          <HudInsignia
            v-if="vencida(fila)"
            tono="aviso"
          >Vencida</HudInsignia>
        </span>
      </template>
      <template #celda-acciones="{ fila }">
        <slot
          name="acciones"
          :obligacion="fila"
        />
      </template>
    </HudTabla>

    <section
      v-if="estado.pagos.length"
      class="pagos"
      :aria-label="`Pagos aplicados de ${estado.bien.codigo}`"
    >
      <h3>Pagos aplicados</h3>
      <ul>
        <li
          v-for="p in estado.pagos"
          :key="`${p.recibo_id}-${p.obligacion_id}`"
        >
          <span>{{ fechaCalendario(p.fecha) }} · {{ conceptoDe(p.obligacion_id)?.concepto_nombre ?? 'Obligación' }}</span>
          <strong class="cifra">{{ moneda(p.valor) }}</strong>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.estado-cuenta {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.resumen {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 160px), 1fr));
  gap: 10px 16px;
  margin: 0;
}

dt {
  color: var(--texto-3);
  font-size: 13px;
}

dd {
  margin: 2px 0 0;
  font-family: var(--fuente-mono);
}

.grande {
  font-size: 22px;
}

.mora {
  color: var(--ambar);
}

.concepto {
  display: grid;
  text-align: left;
}

small,
.vacio {
  color: var(--texto-3);
}

.vacio {
  margin: 0;
}

.cifra {
  font-family: var(--fuente-mono);
  white-space: nowrap;
}

.vence {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.pagos h3 {
  margin: 0 0 8px;
  font-size: 17px;
}

.pagos ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pagos li {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 12px;
}
</style>
