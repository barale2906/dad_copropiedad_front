<script setup lang="ts">
/** Pasos de un asistente (preparar una asamblea, una importación…): el actual se marca y se puede volver a uno anterior. */
export interface Paso {
  id: string
  texto: string
}

const props = withDefaults(defineProps<{ pasos: Paso[]; actual: string; etiqueta?: string; libre?: boolean }>(), { etiqueta: 'Pasos', libre: false })
const emit = defineEmits<{ ir: [id: string] }>()

const indice = (id: string) => props.pasos.findIndex((p) => p.id === id)
const alcanzable = (id: string) => props.libre || indice(id) <= indice(props.actual)
</script>

<template>
  <nav :aria-label="etiqueta">
    <ol class="pasos">
      <li
        v-for="(p, i) in pasos"
        :key="p.id"
        :class="{ actual: p.id === actual, hecho: i < indice(actual) }"
      >
        <button
          type="button"
          :aria-current="p.id === actual ? 'step' : undefined"
          :disabled="!alcanzable(p.id)"
          @click="emit('ir', p.id)"
        >
          <span
            class="numero"
            aria-hidden="true"
          >{{ i + 1 }}</span>
          {{ p.texto }}
        </button>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.pasos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 6px 12px;
  border: 1px solid var(--linea);
  background: var(--superficie);
  color: var(--texto-2);
  font: inherit;
  cursor: pointer;
}

button:disabled {
  cursor: default;
  opacity: 0.6;
}

.numero {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-size: 13px;
}

.actual button {
  border-color: var(--cian);
  color: var(--texto);
  background: var(--cian-tenue);
}

.hecho button {
  color: var(--verde);
}
</style>
