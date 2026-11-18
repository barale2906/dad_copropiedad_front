<script setup lang="ts">
/**
 * A quién va un mensaje masivo (comunicados, campañas del censo): toda la copropiedad,
 * propietarios, residentes, o una lista de torres, roles o bienes. `v-model` = `{ tipo, ids }`.
 * Genérico: el padre le pasa las torres, los roles y la búsqueda de bienes.
 */
import { computed, ref, watch } from 'vue'
import IQuitar from '~icons/tabler/x'
import HudSelector from './HudSelector.vue'
import SelectorBien, { type OpcionBien } from './SelectorBien.vue'

export type TipoAudienciaHud = 'todos' | 'propietarios' | 'residentes' | 'agrupaciones' | 'bienes' | 'roles'
export interface AudienciaHud {
  tipo: TipoAudienciaHud
  ids?: string[]
}
export interface OpcionAudiencia {
  id: string
  nombre: string
}

const props = withDefaults(
  defineProps<{
    agrupaciones?: OpcionAudiencia[]
    roles?: OpcionAudiencia[]
    buscarBien?: (q: string) => Promise<OpcionBien[]>
    /** Códigos de bienes ya conocidos (para mostrar los elegidos). */
    codigos?: Record<string, string>
    error?: string | null
  }>(),
  { agrupaciones: () => [], roles: () => [], buscarBien: undefined, codigos: () => ({}), error: null },
)
const audiencia = defineModel<AudienciaHud>({ required: true })

const TEXTOS: Record<TipoAudienciaHud, string> = {
  todos: 'Toda la copropiedad',
  propietarios: 'Propietarios',
  residentes: 'Residentes',
  agrupaciones: 'Torres o etapas',
  bienes: 'Bienes privados',
  roles: 'Roles',
}

const elegidos = ref<Record<string, string>>({})
const bienEnCurso = ref('')
const opcionesTipo = computed(() =>
  (Object.keys(TEXTOS) as TipoAudienciaHud[])
    .filter((t) => (t !== 'agrupaciones' || props.agrupaciones.length) && (t !== 'roles' || props.roles.length) && (t !== 'bienes' || props.buscarBien))
    .map((valor) => ({ valor, etiqueta: TEXTOS[valor] })),
)
const lista = computed(() => (audiencia.value.tipo === 'agrupaciones' ? props.agrupaciones : audiencia.value.tipo === 'roles' ? props.roles : []))
const ids = computed(() => audiencia.value.ids ?? [])
const tipo = computed({
  get: () => audiencia.value.tipo,
  set: (t: TipoAudienciaHud | '') => {
    if (t) audiencia.value = { tipo: t, ids: [] }
  },
})

function alternar(id: string, si: boolean) {
  const actuales = ids.value.filter((x) => x !== id)
  audiencia.value = { ...audiencia.value, ids: si ? [...actuales, id] : actuales }
}

function agregarBien(b: OpcionBien) {
  elegidos.value = { ...elegidos.value, [b.id]: b.codigo }
  if (!ids.value.includes(b.id)) audiencia.value = { ...audiencia.value, ids: [...ids.value, b.id] }
  bienEnCurso.value = ''
}

const codigo = (id: string) => elegidos.value[id] ?? props.codigos[id] ?? 'Bien'

watch(
  () => audiencia.value.tipo,
  () => {
    bienEnCurso.value = ''
  },
)
</script>

<template>
  <div class="selector-audiencia">
    <HudSelector
      v-model="tipo"
      etiqueta="Destinatarios"
      :opciones="opcionesTipo"
      :error="audiencia.tipo === 'todos' || audiencia.tipo === 'propietarios' || audiencia.tipo === 'residentes' ? error : null"
    />

    <fieldset
      v-if="lista.length"
      class="opciones"
    >
      <legend>Elija {{ audiencia.tipo === 'roles' ? 'los roles' : 'las torres o etapas' }}</legend>
      <label
        v-for="o in lista"
        :key="o.id"
      >
        <input
          type="checkbox"
          :checked="ids.includes(o.id)"
          @change="alternar(o.id, ($event.target as HTMLInputElement).checked)"
        > {{ o.nombre }}
      </label>
    </fieldset>

    <template v-if="audiencia.tipo === 'bienes' && buscarBien">
      <SelectorBien
        v-model="bienEnCurso"
        etiqueta="Bien"
        :buscar="buscarBien"
        @elegido="agregarBien"
      />
      <ul
        v-if="ids.length"
        class="chips"
        aria-label="Bienes elegidos"
      >
        <li
          v-for="b in ids"
          :key="b"
        >
          {{ codigo(b) }}
          <button
            type="button"
            @click="alternar(b, false)"
          >
            <IQuitar aria-hidden="true" /><span class="solo-lector">Quitar {{ codigo(b) }}</span>
          </button>
        </li>
      </ul>
    </template>

    <p
      v-if="error && lista.length + (audiencia.tipo === 'bienes' ? 1 : 0) > 0"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.selector-audiencia {
  display: grid;
  gap: 10px;
}

.opciones {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));
  gap: 6px;
  margin: 0;
  padding: 0;
  border: 0;
}

.opciones legend {
  margin-bottom: 6px;
  color: var(--texto-2);
  font-size: 14px;
}

.opciones label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 6px 10px;
  border: 1px solid var(--linea);
  cursor: pointer;
}

.opciones input {
  width: 20px;
  height: 20px;
  accent-color: var(--cian);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chips li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 10px;
  border: 1px solid var(--cian);
}

.chips button {
  display: inline-grid;
  place-items: center;
  min-width: 40px;
  min-height: 40px;
  border: 0;
  background: none;
  color: var(--texto-2);
  cursor: pointer;
}

.error {
  margin: 0;
  color: var(--magenta);
}
</style>
