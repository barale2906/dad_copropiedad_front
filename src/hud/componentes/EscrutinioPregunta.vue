<script setup lang="ts">
/**
 * Escrutinio de una pregunta: lo que decidió, barras por opción en la base de cómputo (con la
 * otra base al lado, como exige mostrar la ley), cupos en las elecciones y participación. El
 * backend calcula todo; aquí solo se muestra. En reservadas solo hay totales. Sin librerías de
 * gráficos: barras con CSS. Sirve en la conducción, la proyección y la papeleta.
 */
import { computed } from 'vue'
import type { Escrutinio } from '@/api/tipos'
import { coeficiente, porcentaje } from '@/formato/decimales'
import { cuposDe, participacion, textoDecision } from '@/formato/escrutinio'
import HudInsignia from './HudInsignia.vue'

const props = withDefaults(
  defineProps<{
    escrutinio: Escrutinio
    /** Votación reservada: se aclara que solo se publican los totales. */
    reservada?: boolean
    /** Votación abierta: el resultado es parcial. */
    abierta?: boolean
    /** Proyección en sala: cifras más grandes. */
    grande?: boolean
    /** Nombre accesible de la lista de opciones. */
    etiqueta?: string
  }>(),
  { reservada: false, abierta: false, grande: false, etiqueta: 'Resultados por opción' },
)

const decision = computed(() => textoDecision(props.escrutinio, props.abierta))
const porCoeficiente = computed(() => props.escrutinio.base_computo === 'coeficiente')
const eleccion = computed(() => props.escrutinio.decision.decision === 'reparto')
const filas = computed(() =>
  props.escrutinio.opciones.map((o) => {
    const pct = porCoeficiente.value ? o.porcentaje_coeficiente : o.porcentaje_unidades
    return {
      ...o,
      pct,
      ancho: `${Math.min(100, Math.max(0, Number.parseFloat(pct) || 0))}%`,
      otra: porCoeficiente.value ? `${o.votos.unidades} unidad${o.votos.unidades === 1 ? '' : 'es'}` : `${coeficiente(o.votos.coeficiente)} del coeficiente`,
      cupos: eleccion.value ? cuposDe(props.escrutinio, o.opcion_id) : null,
    }
  }).map((o) => ({ ...o, detalle: detalleDe(o) })),
)

function detalleDe(o: { otra: string; aprobada: boolean | null; aprobada_en_otra_base: boolean | null; cupos: number | null }) {
  const partes = [o.otra]
  if (o.aprobada === true) partes.push('alcanza la mayoría')
  if (o.aprobada !== null && o.aprobada_en_otra_base !== o.aprobada) partes.push(`en la otra base ${o.aprobada_en_otra_base ? 'sí' : 'no'} la alcanzaría`)
  if (o.cupos !== null) partes.push(`${o.cupos} cupo${o.cupos === 1 ? '' : 's'}`)
  return partes.join(' · ')
}
const pie = computed(() => {
  const e = props.escrutinio
  const pct = `${porcentaje(participacion(e), 1)}${porCoeficiente.value ? ' del coeficiente' : ''}`
  const reservada = props.reservada ? ' Votación reservada: solo se publican los totales.' : ''
  return `Votaron ${e.votantes.unidades} de ${e.habilitados.unidades} bienes habilitados (${pct}).${reservada}`
})
</script>

<template>
  <div
    class="escrutinio"
    :class="{ grande }"
  >
    <div class="cabecera">
      <HudInsignia :tono="decision.tono">
        {{ decision.texto }}
      </HudInsignia>
      <small>{{ porCoeficiente ? 'Por coeficiente' : 'Por unidades (un voto por bien)' }}</small>
    </div>
    <p
      v-if="escrutinio.advertencia_unidades"
      class="aviso"
    >
      Se decide por número de bienes: la Ley 675 exige coeficientes (arts. 45 y 46) y la decisión podría impugnarse (art. 49).
    </p>
    <ul
      class="opciones"
      :aria-label="etiqueta"
    >
      <li
        v-for="o in filas"
        :key="o.opcion_id"
        :class="{ ganadora: o.aprobada === true || (o.cupos ?? 0) > 0 }"
      >
        <div class="linea">
          <strong>{{ o.texto }}</strong>
          <span class="cifra">{{ porcentaje(o.pct) }}</span>
        </div>
        <span
          class="barra"
          aria-hidden="true"
        ><span
          class="relleno"
          :style="{ width: o.ancho }"
        /></span>
        <small>{{ o.detalle }}</small>
      </li>
    </ul>
    <p class="pie">
      {{ pie }}
    </p>
  </div>
</template>

<style scoped>
.escrutinio {
  display: grid;
  gap: 12px;
}

.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

small {
  color: var(--texto-2);
}

.aviso {
  margin: 0;
  padding: 8px 12px;
  border-left: 3px solid var(--ambar);
  color: var(--texto);
}

.opciones {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.opciones li {
  display: grid;
  gap: 4px;
}

.linea {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.cifra {
  font-family: var(--fuente-display);
  font-size: 20px;
  font-weight: 600;
}

.grande .cifra {
  font-size: clamp(28px, 5vw, 56px);
}

.grande .linea strong {
  font-size: clamp(20px, 3vw, 32px);
}

.barra {
  position: relative;
  display: block;
  height: 14px;
  border: 1px solid var(--linea);
  background: var(--superficie);
  overflow: hidden;
}

.grande .barra {
  height: 26px;
}

.relleno {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--cian-2);
  transition: width var(--medio);
}

.ganadora .relleno {
  background: var(--verde);
}

.pie {
  margin: 0;
  color: var(--texto-2);
}
</style>
