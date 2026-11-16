<script setup lang="ts">
/**
 * Barra de filtros de un listado. Los campos van en el slot; los filtros aplicados se muestran
 * como chips que se pueden quitar. En móvil se colapsa tras un botón «Filtros (n)».
 */
import { ref, useId } from 'vue'
import IFiltro from '~icons/tabler/filter'
import IX from '~icons/tabler/x'

export interface FiltroActivo {
  clave: string
  etiqueta: string
}

defineProps<{ activos: FiltroActivo[] }>()
const emit = defineEmits<{ quitar: [clave: string]; limpiar: [] }>()

const abierto = ref(false)
const id = useId()
</script>

<template>
  <div class="hud-filtros">
    <button
      type="button"
      class="alternar"
      :aria-expanded="abierto"
      :aria-controls="id"
      @click="abierto = !abierto"
    >
      <IFiltro aria-hidden="true" /> Filtros<span v-if="activos.length"> ({{ activos.length }})</span>
    </button>
    <div
      :id="id"
      class="campos"
      :class="{ abierto }"
    >
      <slot />
    </div>
    <ul
      v-if="activos.length"
      class="chips"
      aria-label="Filtros aplicados"
    >
      <li
        v-for="f in activos"
        :key="f.clave"
      >
        <button
          type="button"
          class="chip"
          @click="emit('quitar', f.clave)"
        >
          {{ f.etiqueta }} <IX aria-hidden="true" /><span class="solo-lector">Quitar filtro</span>
        </button>
      </li>
      <li>
        <button
          type="button"
          class="limpiar"
          @click="emit('limpiar')"
        >
          Limpiar todo
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.hud-filtros {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.alternar {
  display: none;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 14px;
  justify-self: start;
  border: 1px solid var(--linea-fuerte);
  background: none;
  color: var(--cian);
  font-family: var(--fuente-display);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}

.campos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 12px;
  align-items: end;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chip,
.limpiar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--linea-fuerte);
  background: var(--cian-tenue);
  color: var(--texto);
  font-size: 14px;
  cursor: pointer;
}

.limpiar {
  background: none;
  color: var(--texto-2);
  border-color: transparent;
  text-decoration: underline;
}

@media (max-width: 760px) {
  .alternar {
    display: inline-flex;
  }

  .campos:not(.abierto) {
    display: none;
  }
}
</style>
