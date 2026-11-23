<script setup lang="ts">
/**
 * Historial de las condiciones de un contrato como línea de tiempo: cada versión rige desde su
 * fecha y nunca se edita (un cambio es una versión nueva). Sin `nomina.salarios.ver` el salario
 * llega en `null` y no se muestra.
 */
import { computed } from 'vue'
import type { VersionContrato } from '@/api/tipos'
import { moneda } from '@/formato/decimales'
import { fechaCalendario } from '@/formato/fechas'
import { JORNADA, MEDIO_PAGO, PERIODICIDAD, TIPO_SALARIO } from '@/formato/nomina'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'

const props = defineProps<{ versiones: VersionContrato[]; vigenteId?: string | null; etiqueta: string }>()

const orden = computed(() => [...props.versiones].sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde)))
const detalle = (v: VersionContrato) =>
  [TIPO_SALARIO[v.tipo_salario], JORNADA[v.jornada] + (v.horas_semanales ? ` (${v.horas_semanales} h)` : ''), PERIODICIDAD[v.periodicidad], MEDIO_PAGO[v.medio_pago]].join(' · ')
</script>

<template>
  <ol
    class="linea"
    :aria-label="etiqueta"
  >
    <li
      v-for="v in orden"
      :key="v.id"
      :class="{ vigente: v.id === vigenteId }"
    >
      <span
        class="punto"
        aria-hidden="true"
      />
      <div class="contenido">
        <p class="fecha">
          Desde el {{ fechaCalendario(v.vigente_desde) }}
          <HudInsignia
            v-if="v.id === vigenteId"
            tono="exito"
          >
            Vigente
          </HudInsignia>
        </p>
        <p>
          <strong>{{ v.cargo }}</strong>
          <span
            v-if="v.salario"
            class="cifra"
          > · {{ moneda(v.salario) }}</span>
        </p>
        <small>{{ detalle(v) }}</small>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.linea {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  position: relative;
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: 10px;
  padding-bottom: 14px;
}

li::before {
  position: absolute;
  top: 14px;
  bottom: 0;
  left: 6px;
  width: 2px;
  background: var(--linea);
  content: '';
}

li:last-child::before {
  display: none;
}

.punto {
  width: 14px;
  height: 14px;
  margin-top: 4px;
  border: 2px solid var(--linea-fuerte);
  border-radius: 50%;
  background: var(--superficie);
}

.vigente .punto {
  border-color: var(--cian);
  background: var(--cian);
}

.contenido p {
  margin: 0;
}

.fecha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--texto-2);
  font-size: 14px;
}

small {
  color: var(--texto-3);
}

.cifra {
  font-family: var(--fuente-mono);
}
</style>
