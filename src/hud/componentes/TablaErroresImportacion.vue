<script setup lang="ts">
/**
 * Errores de una planilla importada, por fila (y columna si el backend la da), en una tabla que
 * se puede recorrer con lector de pantalla. El mensaje no repite el valor de la celda. Genérica:
 * la usan todas las importaciones con vista previa.
 */
import { computed } from 'vue'

export interface ErrorDeFila {
  fila: number
  mensaje: string
  columna?: string | null
}

const props = withDefaults(defineProps<{ errores: ErrorDeFila[]; titulo?: string }>(), {
  titulo: 'Corrija estas filas y vuelva a subir la planilla',
})

const ordenados = computed(() => [...props.errores].sort((a, b) => a.fila - b.fila))
const conColumna = computed(() => props.errores.some((e) => e.columna))
</script>

<template>
  <section
    class="errores-importacion"
    aria-labelledby="titulo-errores-importacion"
  >
    <h3 id="titulo-errores-importacion">
      {{ titulo }}
    </h3>
    <div class="contenedor">
      <table>
        <caption class="solo-lector">
          {{ errores.length }} errores en la planilla
        </caption>
        <thead>
          <tr>
            <th scope="col">
              Fila
            </th>
            <th
              v-if="conColumna"
              scope="col"
            >
              Columna
            </th>
            <th scope="col">
              Qué corregir
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(e, i) in ordenados"
            :key="`${e.fila}-${i}`"
          >
            <th scope="row">
              {{ e.fila }}
            </th>
            <td v-if="conColumna">
              {{ e.columna ?? '—' }}
            </td>
            <td>{{ e.mensaje }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.errores-importacion {
  padding: 12px;
  border-left: 3px solid var(--magenta);
  background: color-mix(in srgb, var(--magenta) 8%, transparent);
}

h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

.contenedor {
  max-height: 320px;
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--linea);
  text-align: left;
  vertical-align: top;
}

thead th {
  position: sticky;
  top: 0;
  background: var(--superficie-solida);
  color: var(--texto-2);
  font-size: 13px;
}

tbody th {
  width: 4rem;
  font-family: var(--fuente-mono);
  color: var(--texto-2);
}
</style>
