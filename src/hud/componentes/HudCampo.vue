<script setup lang="ts">
import { useId } from 'vue'

defineProps<{
  etiqueta: string
  tipo?: string
  autocompletar?: string
  error?: string | null
  ayuda?: string
  modoEntrada?: 'text' | 'numeric' | 'decimal' | 'email'
  requerido?: boolean
  maximo?: number
  /** Texto de varias líneas (motivos, observaciones). */
  multilinea?: boolean
  /** Al salir del campo (p. ej. para dar formato al valor). */
  alSalir?: () => void
  /** La etiqueta queda solo para lectores de pantalla (celdas de una tabla densa). */
  etiquetaOculta?: boolean
}>()

const valor = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <div
    class="hud-campo"
    :class="{ conError: !!error }"
  >
    <label
      :for="id"
      :class="etiquetaOculta ? 'solo-lector' : 'rotulo'"
    >{{ etiqueta }}</label>
    <div class="marco">
      <slot name="antes" />
      <textarea
        v-if="multilinea"
        :id="id"
        v-model="valor"
        rows="3"
        :required="requerido"
        :maxlength="maximo"
        :aria-invalid="!!error || undefined"
        :aria-describedby="error || ayuda ? `${id}-msg` : undefined"
        @blur="alSalir?.()"
      />
      <input
        v-else
        :id="id"
        v-model="valor"
        :type="tipo ?? 'text'"
        :autocomplete="autocompletar"
        :inputmode="modoEntrada"
        :required="requerido"
        :maxlength="maximo"
        :aria-invalid="!!error || undefined"
        :aria-describedby="error || ayuda ? `${id}-msg` : undefined"
        @blur="alSalir?.()"
      >
      <slot name="despues" />
    </div>
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
.hud-campo {
  display: grid;
  gap: 6px;
}

.marco {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 0 12px;
  background: rgb(5 10 20 / 70%);
  border: 1px solid var(--linea);
  border-left: 3px solid var(--linea-fuerte);
  transition:
    border-color var(--rapido),
    box-shadow var(--rapido);
}

.marco:focus-within {
  border-color: var(--cian);
  box-shadow: 0 0 0 3px rgb(56 232 255 / 12%);
}

input {
  flex: 1;
  min-width: 0;
  height: 44px;
  border: 0;
  background: transparent;
  outline: none;
  font-size: 16px; /* evita el zoom automático de iOS */
}

textarea {
  flex: 1;
  min-width: 0;
  min-height: 84px;
  padding: 10px 0;
  border: 0;
  background: transparent;
  outline: none;
  font-size: 16px;
  resize: vertical;
}

input::placeholder {
  color: var(--texto-3);
}

.conError .marco {
  border-color: var(--magenta);
}

.mensaje {
  margin: 0;
  font-size: 13px;
  color: var(--texto-3);
}

.conError .mensaje {
  color: var(--magenta);
}
</style>
