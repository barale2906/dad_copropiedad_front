<script setup lang="ts">
/**
 * Tabla de coeficientes de un cuadro borrador con suma y diferencia frente a 1 **en vivo** (texto
 * decimal, nunca `Number()`), búsqueda y paginación en el cliente (cientos de filas). Solo
 * presenta y emite con `v-model` (bien → coeficiente).
 */
import { computed, ref, watch } from 'vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import { coeficienteValido, revisar, textoDiferencia } from '../coeficientes'

const props = withDefaults(
  defineProps<{
    /** Bienes del cuadro en orden: id y código. */
    bienes: { id: string; codigo: string }[]
    soloLectura?: boolean
    porPagina?: number
    /** Ids que el backend reporta como faltantes (se resaltan). */
    faltantes?: string[]
  }>(),
  { soloLectura: false, porPagina: 50, faltantes: () => [] },
)
const valores = defineModel<Record<string, string>>({ required: true })

const busqueda = ref('')
const pagina = ref(0)

const revision = computed(() => revisar(props.bienes.map((b) => valores.value[b.id] ?? '')))
const filtrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  return q ? props.bienes.filter((b) => b.codigo.toLowerCase().includes(q)) : props.bienes
})
const paginas = computed(() => Math.max(1, Math.ceil(filtrados.value.length / props.porPagina)))
const visibles = computed(() => filtrados.value.slice(pagina.value * props.porPagina, (pagina.value + 1) * props.porPagina))
const faltan = computed(() => new Set(props.faltantes))

function cambiar(bienId: string, valor: string) {
  valores.value = { ...valores.value, [bienId]: valor.trim().replace(',', '.') }
}

const invalido = (bienId: string) => {
  const v = valores.value[bienId] ?? ''
  return v !== '' && !coeficienteValido(v)
}

watch(busqueda, () => (pagina.value = 0))
</script>

<template>
  <div class="editor-coeficientes">
    <div
      class="totales"
      :class="{ ok: revision.valido }"
      aria-live="polite"
    >
      <span>Suma: <strong>{{ revision.suma.replace('.', ',') }}</strong></span>
      <span>{{ textoDiferencia(revision.diferencia) }}</span>
      <span v-if="revision.invalidas.length">{{ revision.invalidas.length }} valores inválidos</span>
    </div>
    <HudCampo
      v-model="busqueda"
      etiqueta="Buscar bien"
      tipo="search"
      autocompletar="off"
    />
    <div class="contenedor">
      <table>
        <caption class="solo-lector">
          Coeficientes del cuadro
        </caption>
        <thead>
          <tr>
            <th scope="col">
              Bien
            </th>
            <th scope="col">
              Coeficiente
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="b in visibles"
            :key="b.id"
            :class="{ falta: faltan.has(b.id) }"
          >
            <th scope="row">
              {{ b.codigo }}
            </th>
            <td>
              <span v-if="soloLectura">{{ (valores[b.id] ?? '—').replace('.', ',') }}</span>
              <input
                v-else
                type="text"
                inputmode="decimal"
                :value="valores[b.id] ?? ''"
                :aria-label="`Coeficiente de ${b.codigo}`"
                :aria-invalid="invalido(b.id) || undefined"
                @change="cambiar(b.id, ($event.target as HTMLInputElement).value)"
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      v-if="paginas > 1"
      class="paginacion"
    >
      <HudBoton
        variante="fantasma"
        :deshabilitado="pagina === 0"
        @click="pagina--"
      >
        Anterior
      </HudBoton>
      <span>Página {{ pagina + 1 }} de {{ paginas }}</span>
      <HudBoton
        variante="fantasma"
        :deshabilitado="pagina >= paginas - 1"
        @click="pagina++"
      >
        Siguiente
      </HudBoton>
    </div>
  </div>
</template>

<style scoped>
.editor-coeficientes {
  display: grid;
  gap: 12px;
}

.totales {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  padding: 10px 14px;
  border-left: 3px solid var(--ambar);
  background: var(--superficie-solida);
}

.totales.ok {
  border-left-color: var(--verde);
}

.contenedor {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--linea);
  text-align: left;
}

thead th {
  color: var(--texto-2);
  font-size: 13px;
}

tbody th {
  font-family: var(--fuente-mono);
  font-weight: 500;
}

input {
  width: 100%;
  max-width: 220px;
  min-height: 40px;
  padding: 0 10px;
  border: 1px solid var(--linea);
  background: var(--fondo-2);
  color: var(--texto);
  font-family: var(--fuente-mono);
  font-size: 16px;
}

input[aria-invalid='true'] {
  border-color: var(--magenta);
}

.falta th {
  color: var(--ambar);
}

.paginacion {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
</style>
