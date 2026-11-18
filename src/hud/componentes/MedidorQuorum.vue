<script setup lang="ts">
/**
 * Medidor de quórum: barra del coeficiente presente con la marca del umbral (más de la mitad en
 * primera convocatoria), unidades y asistentes. Si hay quórum lo dice el backend (`hay-quorum`);
 * el medidor solo lo muestra. Sirve en la conducción, la proyección y la papeleta.
 */
import { computed } from 'vue'
import { porcentaje } from '@/formato/decimales'

const props = withDefaults(
  defineProps<{
    /** Coeficiente presente en porcentaje, texto decimal («52.30»). */
    porcentajeCoeficiente: string
    unidadesPresentes: number
    unidadesTotal: number
    asistentes: number
    hayQuorum: boolean
    /** Umbral en porcentaje («50») o `null` si decide cualquier número. */
    umbral?: string | null
    grande?: boolean
  }>(),
  { umbral: null, grande: false },
)

const ancho = computed(() => `${Math.min(100, Math.max(0, Number.parseFloat(props.porcentajeCoeficiente) || 0))}%`)
const marca = computed(() => (props.umbral === null ? null : `${Number.parseFloat(props.umbral)}%`))
const estado = computed(() => (props.hayQuorum ? 'Hay quórum' : props.umbral === null ? 'Sin quórum todavía' : `Falta quórum (más del ${props.umbral} %)`))
</script>

<template>
  <div
    class="medidor"
    :class="{ grande, ok: hayQuorum }"
  >
    <div class="cabecera">
      <strong class="cifra">{{ porcentaje(porcentajeCoeficiente) }}</strong>
      <span
        class="estado"
        role="status"
      >{{ estado }}</span>
    </div>
    <div
      class="barra"
      role="meter"
      :aria-valuenow="Number.parseFloat(porcentajeCoeficiente) || 0"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuetext="`${porcentaje(porcentajeCoeficiente)} del coeficiente presente. ${estado}`"
      aria-label="Quórum por coeficiente"
    >
      <span
        class="relleno"
        :style="{ width: ancho }"
      />
      <span
        v-if="marca"
        class="umbral"
        :style="{ left: marca }"
        aria-hidden="true"
      />
    </div>
    <p class="detalle">
      {{ unidadesPresentes }} de {{ unidadesTotal }} unidades · {{ asistentes }} asistente{{ asistentes === 1 ? '' : 's' }}
    </p>
  </div>
</template>

<style scoped>
.medidor {
  display: grid;
  gap: 8px;
}

.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.cifra {
  font-family: var(--fuente-display);
  font-size: clamp(28px, 6vw, 40px);
}

.grande .cifra {
  font-size: clamp(48px, 10vw, 96px);
}

.estado {
  color: var(--ambar);
  font-weight: 600;
}

.ok .estado {
  color: var(--verde);
}

.barra {
  position: relative;
  height: 18px;
  border: 1px solid var(--linea-fuerte);
  background: var(--superficie);
  overflow: hidden;
}

.grande .barra {
  height: 32px;
}

.relleno {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--ambar);
  transition: width var(--normal);
}

.ok .relleno {
  background: var(--verde);
}

.umbral {
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 3px;
  background: var(--texto);
}

.detalle {
  margin: 0;
  color: var(--texto-2);
}
</style>
