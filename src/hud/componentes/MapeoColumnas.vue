<script setup lang="ts">
/**
 * Relacionar las columnas de un archivo (extracto, planilla) con los campos que se esperan. Con
 * los encabezados leídos, cada campo elige una columna de la lista; sin ellos (p. ej. un XLSX que
 * el navegador no lee), se escribe el nombre de la columna. Genérico: lo usan la conciliación y,
 * más adelante, el recaudo por referencia y otras importaciones.
 */
import { computed } from 'vue'
import HudCampo from './HudCampo.vue'
import HudSelector from './HudSelector.vue'

export interface CampoMapeo {
  clave: string
  etiqueta: string
  obligatorio?: boolean
  ayuda?: string
}

const props = withDefaults(defineProps<{ campos: CampoMapeo[]; columnas?: string[]; etiqueta?: string }>(), {
  columnas: () => [],
  etiqueta: 'Columnas del archivo',
})
const mapeo = defineModel<Record<string, string>>({ required: true })

const opciones = computed(() => props.columnas.map((c) => ({ valor: c, etiqueta: c })))
/** Columnas elegidas para más de un campo (se avisa: suele ser un error). */
const repetidas = computed(() => {
  const usadas = Object.values(mapeo.value).filter(Boolean)
  return [...new Set(usadas.filter((c, i) => usadas.indexOf(c) !== i))]
})

function cambiar(clave: string, valor: string) {
  mapeo.value = { ...mapeo.value, [clave]: valor }
}
</script>

<template>
  <fieldset class="mapeo">
    <legend>{{ etiqueta }}</legend>
    <div class="campos-mapeo">
      <template
        v-for="c in campos"
        :key="c.clave"
      >
        <HudSelector
          v-if="opciones.length"
          :model-value="mapeo[c.clave] ?? ''"
          :etiqueta="`${c.etiqueta}${c.obligatorio ? '' : ' (opcional)'}`"
          :ayuda="c.ayuda"
          vacio="—"
          :opciones="opciones"
          @update:model-value="(v) => cambiar(c.clave, v)"
        />
        <HudCampo
          v-else
          :model-value="mapeo[c.clave] ?? ''"
          :etiqueta="`${c.etiqueta}${c.obligatorio ? '' : ' (opcional)'}`"
          :ayuda="c.ayuda ?? 'Nombre de la columna tal como aparece en el archivo.'"
          @update:model-value="(v) => cambiar(c.clave, v)"
        />
      </template>
    </div>
    <p
      v-if="repetidas.length"
      class="aviso"
      role="status"
    >
      La columna «{{ repetidas.join('», «') }}» está elegida para más de un campo.
    </p>
  </fieldset>
</template>

<style scoped>
.mapeo {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

legend {
  margin-bottom: 6px;
  color: var(--texto-2);
}

.campos-mapeo {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 12px;
}

.aviso {
  margin: 0;
  padding: 8px 12px;
  border-left: 3px solid var(--ambar);
  color: var(--texto);
}
</style>
