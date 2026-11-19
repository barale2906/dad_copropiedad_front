<script setup lang="ts">
/**
 * Elegir una calificación de 1 a 5 estrellas: radios nativos (flechas del teclado, lector de
 * pantalla) dibujados como estrellas, con objetivos táctiles de 40 px.
 */
import { useId } from 'vue'
import IEstrella from '~icons/tabler/star'
import IEstrellaLlena from '~icons/tabler/star-filled'

withDefaults(defineProps<{ etiqueta?: string; error?: string | null }>(), { etiqueta: 'Calificación', error: null })
const modelo = defineModel<number>({ default: 0 })

const nombre = useId()
const TEXTO = ['Muy mala', 'Mala', 'Regular', 'Buena', 'Excelente'] as const
</script>

<template>
  <fieldset
    class="elegir-calificacion"
    :aria-invalid="error ? true : undefined"
    :aria-describedby="error ? `${nombre}-error` : undefined"
  >
    <legend>{{ etiqueta }}</legend>
    <div class="estrellas">
      <label
        v-for="(t, i) in TEXTO"
        :key="t"
        :class="{ activa: modelo >= i + 1 }"
      >
        <input
          v-model="modelo"
          type="radio"
          class="solo-lector"
          :name="nombre"
          :value="i + 1"
        >
        <IEstrellaLlena
          v-if="modelo >= i + 1"
          aria-hidden="true"
        />
        <IEstrella
          v-else
          aria-hidden="true"
        />
        <span class="solo-lector">{{ i + 1 }} {{ i === 0 ? 'estrella' : 'estrellas' }}: {{ t }}</span>
      </label>
    </div>
    <p
      v-if="modelo > 0"
      class="texto"
      aria-hidden="true"
    >
      {{ TEXTO[modelo - 1] }}
    </p>
    <p
      v-if="error"
      :id="`${nombre}-error`"
      class="error"
    >
      {{ error }}
    </p>
  </fieldset>
</template>

<style scoped>
.elegir-calificacion {
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 4px;
  color: var(--texto-2);
  font-size: 14px;
}

.estrellas {
  display: flex;
  gap: 2px;
}

label {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  color: var(--texto-3);
  font-size: 26px;
  cursor: pointer;
}

label.activa {
  color: var(--ambar);
}

label:has(input:focus-visible) {
  outline: 2px solid var(--cian);
  outline-offset: 2px;
}

.texto,
.error {
  margin: 4px 0 0;
  font-size: 14px;
}

.texto {
  color: var(--texto-2);
}

.error {
  color: var(--magenta);
}
</style>
