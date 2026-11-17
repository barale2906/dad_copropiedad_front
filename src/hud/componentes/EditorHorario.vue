<script setup lang="ts">
/**
 * Editor de un horario semanal: franjas por día (con o sin festivos) y excepciones por fecha
 * (cerrado o con otro horario). Solo presenta y emite con `v-model`; se valida con
 * `validarHorario` y se envía con `normalizarHorario` (`@/formato/horario`).
 */
import { useId } from 'vue'
import type { ExcepcionHorario, Franja, Horario } from '@/api/tipos'
import HudBoton from './HudBoton.vue'
import HudCampo from './HudCampo.vue'
import HudFecha from './HudFecha.vue'
import HudSelector from './HudSelector.vue'
import IMas from '~icons/tabler/plus'
import IBorrar from '~icons/tabler/trash'
import { aHoraCorta, DIAS } from '@/formato/horario'

const horario = defineModel<Horario>({ required: true })

const id = useId()
const OPCIONES_DIA = DIAS.map((etiqueta, i) => ({ valor: String(i + 1), etiqueta }))

const franjas = () => horario.value.franjas ?? []
const excepciones = () => horario.value.excepciones ?? []

function cambiarFranja(i: number, cambio: Partial<Franja>) {
  horario.value = { ...horario.value, franjas: franjas().map((f, j) => (j === i ? { ...f, ...cambio } : f)) }
}

function agregarFranja() {
  const ultima = franjas().at(-1)
  const dia = ultima ? (ultima.dia % 7) + 1 : 1
  horario.value = {
    ...horario.value,
    franjas: [...franjas(), { dia, inicio: ultima?.inicio ?? '08:00:00', fin: ultima?.fin ?? '17:00:00', aplica_festivos: false }],
  }
}

function quitarFranja(i: number) {
  horario.value = { ...horario.value, franjas: franjas().filter((_, j) => j !== i) }
}

function cambiarExcepcion(i: number, cambio: Partial<ExcepcionHorario>) {
  horario.value = {
    ...horario.value,
    excepciones: excepciones().map((x, j) => (j === i ? { ...x, ...cambio } : x)),
  }
}

function agregarExcepcion() {
  horario.value = { ...horario.value, excepciones: [...excepciones(), { fecha: '', inicio: null, fin: null, motivo: null }] }
}

function quitarExcepcion(i: number) {
  horario.value = { ...horario.value, excepciones: excepciones().filter((_, j) => j !== i) }
}
</script>

<template>
  <div class="editor-horario">
    <fieldset>
      <legend>Atención semanal</legend>
      <p
        v-if="franjas().length === 0"
        class="vacio"
      >
        Sin franjas: no se atiende ningún día.
      </p>
      <ul>
        <li
          v-for="(f, i) in franjas()"
          :key="`f-${i}`"
          class="fila"
        >
          <HudSelector
            :model-value="String(f.dia)"
            :etiqueta="`Día de la franja ${i + 1}`"
            :opciones="OPCIONES_DIA"
            @update:model-value="cambiarFranja(i, { dia: Number($event) })"
          />
          <HudCampo
            :model-value="aHoraCorta(f.inicio)"
            etiqueta="Desde"
            tipo="time"
            @update:model-value="cambiarFranja(i, { inicio: $event })"
          />
          <HudCampo
            :model-value="aHoraCorta(f.fin)"
            etiqueta="Hasta"
            tipo="time"
            @update:model-value="cambiarFranja(i, { fin: $event })"
          />
          <label class="festivos">
            <input
              type="checkbox"
              :checked="!!f.aplica_festivos"
              @change="cambiarFranja(i, { aplica_festivos: ($event.target as HTMLInputElement).checked })"
            >
            También festivos
          </label>
          <button
            type="button"
            class="quitar"
            @click="quitarFranja(i)"
          >
            <IBorrar aria-hidden="true" /><span class="solo-lector">Quitar la franja {{ i + 1 }}</span>
          </button>
        </li>
      </ul>
      <HudBoton
        variante="secundario"
        @click="agregarFranja"
      >
        <IMas aria-hidden="true" /> Agregar franja
      </HudBoton>
    </fieldset>

    <fieldset>
      <legend :id="`${id}-exc`">
        Excepciones por fecha
      </legend>
      <p class="vacio">
        Días con otro horario o sin atención (deje las horas vacías si ese día no se atiende).
      </p>
      <ul :aria-labelledby="`${id}-exc`">
        <li
          v-for="(x, i) in excepciones()"
          :key="`x-${i}`"
          class="fila"
        >
          <HudFecha
            :model-value="x.fecha"
            :etiqueta="`Fecha de la excepción ${i + 1}`"
            @update:model-value="cambiarExcepcion(i, { fecha: $event })"
          />
          <HudCampo
            :model-value="aHoraCorta(x.inicio)"
            etiqueta="Desde"
            tipo="time"
            @update:model-value="cambiarExcepcion(i, { inicio: $event || null })"
          />
          <HudCampo
            :model-value="aHoraCorta(x.fin)"
            etiqueta="Hasta"
            tipo="time"
            @update:model-value="cambiarExcepcion(i, { fin: $event || null })"
          />
          <HudCampo
            :model-value="x.motivo ?? ''"
            etiqueta="Motivo"
            @update:model-value="cambiarExcepcion(i, { motivo: $event })"
          />
          <button
            type="button"
            class="quitar"
            @click="quitarExcepcion(i)"
          >
            <IBorrar aria-hidden="true" /><span class="solo-lector">Quitar la excepción {{ i + 1 }}</span>
          </button>
        </li>
      </ul>
      <HudBoton
        variante="secundario"
        @click="agregarExcepcion"
      >
        <IMas aria-hidden="true" /> Agregar excepción
      </HudBoton>
    </fieldset>
  </div>
</template>

<style scoped>
.editor-horario {
  display: grid;
  gap: 18px;
}

fieldset {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 4px;
  font-family: var(--fuente-display);
  font-size: 17px;
  font-weight: 600;
}

ul {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fila {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 130px), 1fr)) 44px;
  align-items: end;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--linea);
}

.festivos {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  color: var(--texto-2);
}

.festivos input {
  width: 20px;
  height: 20px;
  accent-color: var(--cian);
}

.quitar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--linea);
  background: none;
  color: var(--magenta);
  cursor: pointer;
}

.vacio {
  margin: 0;
  color: var(--texto-2);
}
</style>
