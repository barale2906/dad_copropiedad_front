<script setup lang="ts" generic="V extends string">
/**
 * Lista desplegable sobre el `<select>` nativo (accesible, con el selector propio del celular).
 * Para listas largas con búsqueda se usará un buscador propio (p. ej. terceros, plan 11).
 */
import { useId } from 'vue'

export interface OpcionSelector<V extends string> {
  valor: V
  etiqueta: string
  deshabilitada?: boolean
}

withDefaults(
  defineProps<{
    etiqueta: string
    opciones: OpcionSelector<V>[]
    /** Texto de la opción vacía; si se omite, no hay opción vacía. */
    vacio?: string
    error?: string | null
    ayuda?: string
    requerido?: boolean
  }>(),
  { vacio: undefined, error: null, ayuda: undefined, requerido: false },
)
const valor = defineModel<V | ''>({ required: true })
const id = useId()
</script>

<template>
  <div
    class="hud-selector"
    :class="{ conError: !!error }"
  >
    <label
      :for="id"
      class="rotulo"
    >{{ etiqueta }}</label>
    <select
      :id="id"
      v-model="valor"
      :required="requerido"
      :aria-invalid="!!error || undefined"
      :aria-describedby="error || ayuda ? `${id}-msg` : undefined"
    >
      <option
        v-if="vacio !== undefined"
        value=""
      >
        {{ vacio }}
      </option>
      <option
        v-for="o in opciones"
        :key="o.valor"
        :value="o.valor"
        :disabled="o.deshabilitada"
      >
        {{ o.etiqueta }}
      </option>
    </select>
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
.hud-selector {
  display: grid;
  gap: 6px;
}

select {
  min-height: 46px;
  padding: 0 12px;
  border: 1px solid var(--linea);
  border-left: 3px solid var(--linea-fuerte);
  background: rgb(5 10 20 / 70%);
  color: var(--texto);
  font-size: 16px;
}

select:focus-visible {
  outline: none;
  border-color: var(--cian);
  box-shadow: 0 0 0 3px rgb(56 232 255 / 12%);
}

option {
  background: var(--superficie-solida);
}

.mensaje {
  margin: 0;
  font-size: 13px;
  color: var(--texto-3);
}

.conError select {
  border-color: var(--magenta);
}

.conError .mensaje {
  color: var(--magenta);
}
</style>
