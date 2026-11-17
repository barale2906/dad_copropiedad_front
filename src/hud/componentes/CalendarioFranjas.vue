<script setup lang="ts">
/**
 * Calendario de franjas libres por día (en la zona de la entidad). Para reservar muestra los
 * inicios posibles de una reserva de `duracion` minutos cada `paso` minutos y emite el elegido
 * (`v-model`); en solo lectura muestra las franjas libres. Genérico: lo reutilizan las citas con
 * la administración y los planes de mantenimiento. No calcula disponibilidad: la recibe.
 */
import { computed } from 'vue'
import { diaSemana, horaEn } from '@/formato/fechas'
import { type Franja, iniciosPosibles, porDia } from '@/formato/franjas'

const props = withDefaults(
  defineProps<{
    /** Días de calendario (`YYYY-MM-DD`) a mostrar, aunque no tengan franjas. */
    dias: string[]
    franjas: Franja[]
    zona: string
    paso?: number
    duracion?: number
    soloLectura?: boolean
    /** Nombre accesible del calendario. */
    titulo?: string
  }>(),
  { paso: 30, duracion: 60, soloLectura: false, titulo: 'Franjas disponibles' },
)
const elegido = defineModel<string | null>({ default: null })

const inicios = computed(() => porDia(iniciosPosibles(props.franjas, props.paso, props.duracion), (x) => x, props.zona))
const libres = computed(() => porDia(props.franjas, (f) => f.inicio, props.zona))
const vacio = computed(() => (props.soloLectura ? libres.value.size : inicios.value.size) === 0)
</script>

<template>
  <section
    class="calendario-franjas"
    :aria-label="titulo"
  >
    <p
      v-if="vacio"
      class="vacio"
    >
      No hay franjas libres en estos días.
    </p>
    <div class="dias">
      <section
        v-for="d in dias"
        :key="d"
        class="dia"
        :aria-label="diaSemana(d)"
      >
        <h3>{{ diaSemana(d) }}</h3>
        <ul v-if="soloLectura && libres.get(d)?.length">
          <li
            v-for="f in libres.get(d)"
            :key="f.inicio"
            class="libre"
          >
            {{ horaEn(f.inicio, zona) }} – {{ horaEn(f.fin, zona) }}
          </li>
        </ul>
        <ul
          v-else-if="!soloLectura && inicios.get(d)?.length"
          class="inicios"
        >
          <li
            v-for="i in inicios.get(d)"
            :key="i"
          >
            <button
              type="button"
              :aria-pressed="elegido === i"
              @click="elegido = i"
            >
              {{ horaEn(i, zona) }}
            </button>
          </li>
        </ul>
        <p
          v-else
          class="sin"
        >
          Sin franjas
        </p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.calendario-franjas {
  display: grid;
  gap: 10px;
}

.dias {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
  gap: 10px;
}

.dia {
  padding: 10px;
  border: 1px solid var(--linea);
  background: var(--superficie);
}

h3 {
  margin: 0 0 8px;
  font-size: 15px;
  text-transform: capitalize;
}

ul {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.inicios button {
  min-width: 88px;
  min-height: 40px;
  padding: 0 10px;
  border: 1px solid var(--linea);
  background: none;
  color: var(--texto);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: background var(--rapido), border-color var(--rapido);
}

.inicios button:hover,
.inicios button:focus-visible {
  border-color: var(--cian);
}

.inicios button[aria-pressed='true'] {
  border-color: var(--cian);
  background: var(--cian-tenue);
  color: var(--cian);
  font-weight: 600;
}

.libre {
  padding: 4px 8px;
  border-left: 3px solid var(--verde);
  font-size: 14px;
}

.sin,
.vacio {
  margin: 0;
  color: var(--texto-3);
  font-size: 14px;
}
</style>
