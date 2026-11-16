<script setup lang="ts" generic="T extends object">
/**
 * Tabla densa en escritorio que pasa a tarjetas en móvil (< 760 px), con el mismo HTML de
 * tabla (accesible): en tarjetas cada celda muestra el título de su columna. Celdas por slot
 * `celda-<clave>` (recibe `fila`); orden y selección opcionales. Sin «página X de Y»: la
 * paginación es por cursor (ver `HudCargarMas`).
 */
import { computed } from 'vue'

export interface Columna {
  clave: string
  titulo: string
  alinear?: 'inicio' | 'fin'
  ordenable?: boolean
}

const props = withDefaults(
  defineProps<{
    filas: T[]
    columnas: Columna[]
    /** Propiedad única de cada fila (para la selección y el `key`). */
    clave: keyof T & string
    /** Nombre accesible de la tabla. */
    titulo: string
    orden?: { clave: string; direccion: 'asc' | 'desc' } | null
    seleccionable?: boolean
  }>(),
  { orden: null, seleccionable: false },
)
const seleccion = defineModel<string[]>('seleccion', { default: () => [] })
const emit = defineEmits<{ ordenar: [clave: string] }>()

const id = (f: T) => String(f[props.clave])
const todas = computed(() => props.filas.length > 0 && props.filas.every((f) => seleccion.value.includes(id(f))))

function alternar(f: T) {
  const i = id(f)
  seleccion.value = seleccion.value.includes(i) ? seleccion.value.filter((x) => x !== i) : [...seleccion.value, i]
}

function alternarTodas() {
  seleccion.value = todas.value ? [] : props.filas.map(id)
}

function ariaOrden(c: Columna): 'ascending' | 'descending' | 'none' | undefined {
  if (!c.ordenable) return undefined
  if (props.orden?.clave !== c.clave) return 'none'
  return props.orden.direccion === 'asc' ? 'ascending' : 'descending'
}

const valor = (f: T, clave: string): unknown => (f as Record<string, unknown>)[clave]
</script>

<template>
  <div class="hud-tabla">
    <table>
      <caption class="solo-lector">
        {{ titulo }}
      </caption>
      <thead>
        <tr>
          <th
            v-if="seleccionable"
            scope="col"
            class="marca"
          >
            <input
              type="checkbox"
              :checked="todas"
              aria-label="Seleccionar todas"
              @change="alternarTodas"
            >
          </th>
          <th
            v-for="c in columnas"
            :key="c.clave"
            scope="col"
            :class="c.alinear"
            :aria-sort="ariaOrden(c)"
          >
            <button
              v-if="c.ordenable"
              type="button"
              class="ordenar"
              @click="emit('ordenar', c.clave)"
            >
              {{ c.titulo }}
              <span
                v-if="orden?.clave === c.clave"
                aria-hidden="true"
              >{{ orden.direccion === 'asc' ? '▲' : '▼' }}</span>
            </button>
            <template v-else>
              {{ c.titulo }}
            </template>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="f in filas"
          :key="id(f)"
          :class="{ elegida: seleccion.includes(id(f)) }"
        >
          <td
            v-if="seleccionable"
            class="marca"
          >
            <input
              type="checkbox"
              :checked="seleccion.includes(id(f))"
              :aria-label="`Seleccionar ${id(f)}`"
              @change="alternar(f)"
            >
          </td>
          <td
            v-for="c in columnas"
            :key="c.clave"
            :class="c.alinear"
            :data-titulo="c.titulo"
          >
            <slot
              :name="`celda-${c.clave}`"
              :fila="f"
            >
              {{ valor(f, c.clave) ?? '—' }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.hud-tabla {
  overflow-x: auto;
  border: 1px solid var(--linea);
  background: var(--superficie);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th {
  padding: 10px 12px;
  border-bottom: 1px solid var(--linea-fuerte);
  font-family: var(--fuente-display);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-align: left;
  text-transform: uppercase;
  color: var(--texto-3);
  white-space: nowrap;
}

td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--linea);
  vertical-align: middle;
}

tbody tr:hover,
tr.elegida {
  background: var(--cian-tenue);
}

.fin {
  text-align: right;
}

.marca {
  width: 44px;
}

.marca input {
  width: 20px;
  height: 20px;
  accent-color: var(--cian);
}

.ordenar {
  display: inline-flex;
  gap: 6px;
  min-height: 40px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  cursor: pointer;
}

/* Tarjetas en móvil: misma tabla, cada fila es un bloque y cada celda lleva su título. */
@media (max-width: 760px) {
  .hud-tabla {
    border: 0;
    background: none;
  }

  thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  tbody,
  tr,
  td {
    display: block;
  }

  tr {
    margin-bottom: 12px;
    padding: 6px 4px;
    border: 1px solid var(--linea);
    border-left: 3px solid var(--linea-fuerte);
    background: var(--superficie);
  }

  td {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    border: 0;
    padding: 6px 12px;
    text-align: right;
  }

  td[data-titulo]::before {
    content: attr(data-titulo);
    font-family: var(--fuente-display);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-align: left;
    text-transform: uppercase;
    color: var(--texto-3);
  }
}
</style>
