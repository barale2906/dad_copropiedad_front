<script setup lang="ts">
/**
 * Fecha (`AAAA-MM-DD`) o fecha y hora local (`AAAA-MM-DDTHH:mm`) con el selector nativo del
 * navegador. La hora se entiende en la zona de la entidad: conviértala con `aUtc()` antes de
 * enviarla al backend.
 */
import { useId } from 'vue'

withDefaults(
  defineProps<{
    etiqueta: string
    conHora?: boolean
    minimo?: string
    maximo?: string
    error?: string | null
    ayuda?: string
    requerido?: boolean
  }>(),
  { conHora: false, minimo: undefined, maximo: undefined, error: null, ayuda: undefined, requerido: false },
)
const valor = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <div
    class="hud-fecha"
    :class="{ conError: !!error }"
  >
    <label
      :for="id"
      class="rotulo"
    >{{ etiqueta }}</label>
    <input
      :id="id"
      v-model="valor"
      :type="conHora ? 'datetime-local' : 'date'"
      :min="minimo"
      :max="maximo"
      :required="requerido"
      :aria-invalid="!!error || undefined"
      :aria-describedby="error || ayuda ? `${id}-msg` : undefined"
    >
    <p
      v-if="error || ayuda"
      :id="`${id}-msg`"
      class="mensaje"
      :role="error ? 'alert' : undefined"
    >
      {{ error ?? ayuda }}
    </p>
  </div>
</template>

<style scoped>
.hud-fecha {
  display: grid;
  gap: 6px;
}

input {
  min-height: 46px;
  padding: 0 12px;
  border: 1px solid var(--linea);
  border-left: 3px solid var(--linea-fuerte);
  background: rgb(5 10 20 / 70%);
  color: var(--texto);
  color-scheme: dark;
  font-size: 16px;
}

input:focus-visible {
  outline: none;
  border-color: var(--cian);
  box-shadow: 0 0 0 3px rgb(56 232 255 / 12%);
}

.mensaje {
  margin: 0;
  font-size: 13px;
  color: var(--texto-3);
}

.conError input {
  border-color: var(--magenta);
}

.conError .mensaje {
  color: var(--magenta);
}
</style>
