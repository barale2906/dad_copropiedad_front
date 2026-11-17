<script setup lang="ts">
/**
 * Matriz de permisos de un rol, agrupada por módulo: marcar uno a uno o el grupo completo y
 * buscar por texto. Solo presenta y emite (`v-model` con los códigos elegidos).
 *
 * Un permiso que la cuenta no puede otorgar (`puedeOtorgar`) no se puede marcar, pero sí
 * desmarcar: el backend rechaza un rol con permisos que quien lo edita no tiene.
 */
import { computed, ref } from 'vue'
import type { Permiso } from '@/api/tipos'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import IBuscar from '~icons/tabler/search'
import type { GrupoPermisos } from '../permisos'

const props = withDefaults(
  defineProps<{
    grupos: GrupoPermisos[]
    soloLectura?: boolean
    puedeOtorgar?: (p: Permiso) => boolean
  }>(),
  { soloLectura: false, puedeOtorgar: () => true },
)
const elegidos = defineModel<Permiso[]>({ required: true })

const busqueda = ref('')

const marcados = computed(() => new Set(elegidos.value))
const total = computed(() => props.grupos.reduce((n, g) => n + g.permisos.length, 0))

/** Grupos con los permisos que coinciden con la búsqueda (por texto o por código). */
const visibles = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return props.grupos
  return props.grupos
    .map((g) => ({
      ...g,
      permisos: g.permisos.filter((p) => p.etiqueta.toLowerCase().includes(q) || p.codigo.includes(q)),
    }))
    .filter((g) => g.permisos.length > 0)
})

const marcadosEn = (g: GrupoPermisos) => g.permisos.filter((p) => marcados.value.has(p.codigo)).length

function bloqueado(p: Permiso): boolean {
  return props.soloLectura || (!marcados.value.has(p) && !props.puedeOtorgar(p))
}

/** Los que se pueden marcar del grupo (los no otorgables quedan como están). */
const marcablesEn = (g: GrupoPermisos) => g.permisos.filter((p) => props.puedeOtorgar(p.codigo))

function grupoCompleto(g: GrupoPermisos): boolean {
  const m = marcablesEn(g)
  return m.length > 0 && m.every((p) => marcados.value.has(p.codigo))
}

function alternar(p: Permiso, marcar: boolean) {
  elegidos.value = marcar ? [...elegidos.value, p] : elegidos.value.filter((x) => x !== p)
}

function alternarGrupo(g: GrupoPermisos, marcar: boolean) {
  const del = new Set(marcablesEn(g).map((p) => p.codigo))
  const resto = elegidos.value.filter((p) => !del.has(p))
  elegidos.value = marcar ? [...resto, ...del] : resto
}

const valor = (e: Event) => (e.target as HTMLInputElement).checked
</script>

<template>
  <div class="matriz">
    <div class="cabecera">
      <HudCampo
        v-model="busqueda"
        etiqueta="Buscar permiso"
        tipo="search"
        autocompletar="off"
      >
        <template #antes>
          <IBuscar
            class="icono-campo"
            aria-hidden="true"
          />
        </template>
      </HudCampo>
      <p
        class="conteo"
        aria-live="polite"
      >
        {{ elegidos.length }} de {{ total }} permisos
      </p>
    </div>

    <p
      v-if="visibles.length === 0"
      class="vacio"
    >
      Ningún permiso coincide con «{{ busqueda }}».
    </p>

    <details
      v-for="g in visibles"
      :key="g.nombre"
      class="grupo"
      :open="!!busqueda || marcadosEn(g) > 0"
    >
      <summary>
        <span class="nombre">{{ g.nombre }}</span>
        <span class="cuenta">{{ marcadosEn(g) }} de {{ g.permisos.length }}</span>
      </summary>
      <fieldset :disabled="soloLectura">
        <legend class="solo-lector">
          Permisos de {{ g.nombre }}
        </legend>
        <label
          v-if="!soloLectura && marcablesEn(g).length > 1"
          class="opcion todos"
        >
          <input
            type="checkbox"
            :checked="grupoCompleto(g)"
            :indeterminate="!grupoCompleto(g) && marcadosEn(g) > 0"
            @change="alternarGrupo(g, valor($event))"
          >
          <span>Todos los de {{ g.nombre }}</span>
        </label>
        <ul>
          <li
            v-for="p in g.permisos"
            :key="p.codigo"
          >
            <label
              class="opcion"
              :class="{ bloqueada: bloqueado(p.codigo) && !soloLectura }"
            >
              <input
                type="checkbox"
                :checked="marcados.has(p.codigo)"
                :disabled="bloqueado(p.codigo)"
                @change="alternar(p.codigo, valor($event))"
              >
              <span>
                {{ p.etiqueta }}
                <small>{{ p.codigo }}</small>
                <small
                  v-if="bloqueado(p.codigo) && !soloLectura"
                  class="motivo"
                >Usted no tiene este permiso: no puede otorgarlo.</small>
              </span>
            </label>
          </li>
        </ul>
      </fieldset>
    </details>
  </div>
</template>

<style scoped>
.matriz {
  display: grid;
  gap: 10px;
}

.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px 16px;
}

.cabecera > :first-child {
  flex: 1 1 260px;
}

.conteo,
.vacio {
  margin: 0;
  color: var(--texto-2);
}

.icono-campo {
  color: var(--texto-3);
}

.grupo {
  border: 1px solid var(--linea);
  background: var(--superficie);
}

summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  padding: 8px 14px;
  cursor: pointer;
}

.nombre {
  font-family: var(--fuente-display);
  font-size: 17px;
  font-weight: 600;
}

.cuenta {
  color: var(--cian);
  font-size: 14px;
  white-space: nowrap;
}

fieldset {
  margin: 0;
  padding: 4px 14px 12px;
  border: 0;
  border-top: 1px solid var(--linea);
}

ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 2px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.opcion {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 40px;
  padding: 8px 0;
  cursor: pointer;
}

.opcion input {
  flex: none;
  width: 20px;
  height: 20px;
  margin: 1px 0 0;
  accent-color: var(--cian);
}

.opcion span {
  display: grid;
}

.todos {
  border-bottom: 1px dashed var(--linea);
  color: var(--cian);
}

small {
  color: var(--texto-3);
  font-family: var(--fuente-mono);
  font-size: 12.5px;
  overflow-wrap: anywhere;
}

.motivo {
  color: var(--ambar);
  font-family: var(--fuente);
}

.bloqueada {
  cursor: not-allowed;
}

.bloqueada > span {
  color: var(--texto-2);
}
</style>
