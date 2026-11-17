<script setup lang="ts">
/**
 * Busca una persona de la PH por nombre o documento y emite la elegida. Necesita `personas.ver`.
 */
import { ref } from 'vue'
import type { Persona } from '@/api/tipos'
import { useListado } from '@/composables/useListado'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import IBuscar from '~icons/tabler/search'
import { buscarPersonas } from '../api-proteccion'

const props = withDefaults(defineProps<{ copropiedadId: string; etiqueta?: string }>(), { etiqueta: 'Buscar persona' })
const emit = defineEmits<{ elegir: [persona: Persona] }>()

const filtros = ref({ q: '' })
const resultados = useListado(
  (despues, f: { q: string }) =>
    f.q.trim().length < 2 ? Promise.resolve({ datos: [], siguiente: null }) : buscarPersonas(props.copropiedadId, f.q, despues),
  { filtros },
)
</script>

<template>
  <div class="buscar-persona">
    <HudCampo
      v-model="filtros.q"
      :etiqueta="etiqueta"
      tipo="search"
      autocompletar="off"
      ayuda="Nombre (sin tildes) o número de documento; al menos 2 caracteres."
    >
      <template #antes>
        <IBuscar
          class="icono"
          aria-hidden="true"
        />
      </template>
    </HudCampo>
    <template v-if="filtros.q.trim().length >= 2">
      <HudEstado
        v-if="resultados.estado.value === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="resultados.estado.value === 'error'"
        estado="error"
        :mensaje="resultados.error.value ?? undefined"
        @reintentar="resultados.recargar()"
      />
      <p
        v-else-if="resultados.estado.value === 'vacio'"
        class="vacio"
      >
        Ninguna persona coincide.
      </p>
      <ul
        v-else
        class="resultados"
        :aria-label="`Resultados de ${etiqueta}`"
      >
        <li
          v-for="p in resultados.filas.value"
          :key="p.id"
        >
          <button
            type="button"
            @click="emit('elegir', p)"
          >
            <strong>{{ p.nombre }}</strong>
            <small>{{ p.tipo_documento ?? '' }} {{ p.documento ?? 'Sin documento' }}</small>
          </button>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.buscar-persona {
  display: grid;
  gap: 8px;
}

.icono,
small,
.vacio {
  color: var(--texto-3);
}

.vacio {
  margin: 0;
}

.resultados {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.resultados button {
  display: grid;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--linea);
  background: var(--superficie);
  color: var(--texto);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.resultados button:hover,
.resultados button:focus-visible {
  border-color: var(--cian);
  background: var(--cian-tenue);
}
</style>
