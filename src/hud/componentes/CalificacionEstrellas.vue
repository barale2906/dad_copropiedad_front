<script setup lang="ts">
/**
 * Calificación de 1 a 5 en estrellas (solo lectura): el lector de pantalla oye «4,5 de 5» y el
 * número de reseñas; las estrellas son decorativas. Sin promedio muestra «Sin reseñas».
 */
import { computed } from 'vue'
import { calificacionLegible } from '@/formato/directorio'
import { comparar, restar } from '@/formato/decimales'
import IEstrella from '~icons/tabler/star'
import IEstrellaLlena from '~icons/tabler/star-filled'
import IEstrellaMedia from '~icons/tabler/star-half-filled'

const props = withDefaults(
  defineProps<{
    /** Promedio como texto decimal (`"4.5"`) o una calificación entera (1–5). */
    valor: string | number | null | undefined
    /** Número de reseñas; si se omite no se muestra. */
    resenas?: number
  }>(),
  { resenas: undefined },
)

const texto = computed(() => (props.valor == null ? null : calificacionLegible(String(props.valor))))
/** Cada estrella: llena, media (desde ,5) o vacía. */
const estrellas = computed(() =>
  [1, 2, 3, 4, 5].map((n) => {
    if (props.valor == null) return 'vacia'
    const v = String(props.valor)
    if (comparar(v, String(n)) >= 0) return 'llena'
    return comparar(restar(String(n), v), '0.5') <= 0 ? 'media' : 'vacia'
  }),
)
const cuantas = computed(() => (props.resenas === undefined ? '' : `${props.resenas} ${props.resenas === 1 ? 'reseña' : 'reseñas'}`))
const etiqueta = computed(() =>
  texto.value ? `Calificación ${texto.value} de 5${cuantas.value ? `, ${cuantas.value}` : ''}` : 'Sin reseñas',
)
</script>

<template>
  <span
    class="calificacion"
    role="img"
    :aria-label="etiqueta"
  >
    <span
      class="estrellas"
      aria-hidden="true"
    >
      <template
        v-for="(e, i) in estrellas"
        :key="i"
      >
        <IEstrellaLlena v-if="e === 'llena'" />
        <IEstrellaMedia v-else-if="e === 'media'" />
        <IEstrella
          v-else
          class="vacia"
        />
      </template>
    </span>
    <span aria-hidden="true">
      <template v-if="texto">{{ texto }}<small v-if="cuantas"> · {{ cuantas }}</small></template>
      <small v-else>Sin reseñas</small>
    </span>
  </span>
</template>

<style scoped>
.calificacion {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.estrellas {
  display: inline-flex;
  color: var(--ambar);
}

.vacia {
  color: var(--texto-3);
}

small {
  color: var(--texto-3);
}
</style>
