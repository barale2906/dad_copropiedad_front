<script setup lang="ts">
/**
 * Un sorteo de parqueaderos con su prueba de transparencia: el **compromiso** (huella de la
 * semilla) se publica al crearlo y la **semilla** se revela al ejecutarlo, para que cualquiera
 * verifique que no cambió. Inscribir bienes y ejecutar (con `sorteos.gestionar`).
 */
import { computed, ref, watch } from 'vue'
import type { AsignacionParqueadero, Sorteo } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fecha } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import { ejecutarSorteo, inscribirEnSorteo } from '../api'
import { useZonasComunes } from '../store'
import ElegirBien from './ElegirBien.vue'

const props = defineProps<{ sorteo: Sorteo }>()
const emit = defineEmits<{ cambio: [sorteo: Sorteo] }>()

const entidad = useEntidad()
const zonas = useZonasComunes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const gestiona = computed(() => entidad.tienePermiso('sorteos.gestionar'))
const abierto = computed(() => props.sorteo.estado === 'abierto')

const asignaciones = ref<AsignacionParqueadero[]>([])
const resultado = ref<string | null>(null)

const codigoParqueadero = (rid: string) => zonas.recurso(rid)?.parqueadero?.codigo ?? zonas.nombreRecurso(rid)

// Inscribir
const inscribiendo = ref(false)
const bienId = ref('')
const discapacidad = ref(false)
const inscribir = useAccion(() => inscribirEnSorteo(id.value, props.sorteo.id, bienId.value, discapacidad.value))

function abrirInscribir() {
  bienId.value = ''
  discapacidad.value = false
  inscribir.reiniciar()
  inscribiendo.value = true
}

async function enviarInscripcion() {
  if (!bienId.value || !(await inscribir.ejecutar()).ok) return
  inscribiendo.value = false
  emit('cambio', { ...props.sorteo, inscritos: [...props.sorteo.inscritos, bienId.value] })
  resultado.value = `${zonas.codigoBien(bienId.value)} quedó inscrito.`
}

// Ejecutar
const ejecutando = ref(false)
const ejecutar = useAccion(() => ejecutarSorteo(id.value, props.sorteo.id))

function abrirEjecutar() {
  ejecutar.reiniciar()
  ejecutando.value = true
}

async function confirmarEjecucion() {
  const r = await ejecutar.ejecutar()
  if (!r.ok) return
  ejecutando.value = false
  asignaciones.value = r.valor.asignaciones
  emit('cambio', r.valor.sorteo)
  resultado.value = 'Sorteo ejecutado: la semilla quedó publicada junto con el resultado.'
}

watch(
  () => [...props.sorteo.inscritos, ...(props.sorteo.resultado ?? [])],
  (ids) => zonas.resolverBienes(id.value, ids, entidad.tienePermiso('bienes_privados.ver')),
  { immediate: true },
)
</script>

<template>
  <div class="detalle-sorteo">
    <div class="cabecera">
      <h2>{{ sorteo.nombre }}</h2>
      <HudInsignia :tono="abierto ? 'info' : 'exito'">
        {{ abierto ? 'Abierto' : 'Ejecutado' }}
      </HudInsignia>
    </div>
    <p class="texto-2">
      Asigna {{ sorteo.recursos.length }} parqueaderos del {{ fecha(sorteo.vigencia_desde, zona) }} al
      {{ fecha(sorteo.vigencia_hasta, zona) }}. Puntos extra: {{ sorteo.criterios.puntos_discapacidad }} por movilidad
      reducida y {{ sorteo.criterios.puntos_no_favorecido }} si no ganó en el sorteo anterior.
    </p>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

    <HudPanel
      etiqueta="Prueba de transparencia"
      resaltado
    >
      <dl class="prueba">
        <div>
          <dt>Compromiso (publicado al crear)</dt>
          <dd><code>{{ sorteo.compromiso }}</code></dd>
        </div>
        <div>
          <dt>Semilla (se revela al ejecutar)</dt>
          <dd>
            <code v-if="sorteo.semilla">{{ sorteo.semilla }}</code>
            <span
              v-else
              class="texto-2"
            >Aún oculta</span>
          </dd>
        </div>
      </dl>
      <p class="texto-2">
        El compromiso es la huella de la semilla: al revelarla, cualquiera puede comprobar que es la
        misma que se fijó antes de las inscripciones y que el resultado no se manipuló.
      </p>
    </HudPanel>

    <HudPanel :etiqueta="`Inscritos (${sorteo.inscritos.length})`">
      <p
        v-if="sorteo.inscritos.length === 0"
        class="texto-2"
      >
        Aún no hay bienes inscritos.
      </p>
      <ul
        v-else
        class="chips"
        aria-label="Bienes inscritos"
      >
        <li
          v-for="b in sorteo.inscritos"
          :key="b"
        >
          {{ zonas.codigoBien(b) }}
        </li>
      </ul>
      <div
        v-if="abierto && gestiona"
        class="botones"
      >
        <HudBoton
          variante="secundario"
          @click="abrirInscribir"
        >
          Inscribir un bien
        </HudBoton>
        <HudBoton
          :deshabilitado="sorteo.inscritos.length === 0"
          @click="abrirEjecutar"
        >
          Ejecutar el sorteo
        </HudBoton>
      </div>
    </HudPanel>

    <HudPanel
      v-if="!abierto"
      etiqueta="Resultado"
    >
      <ul
        v-if="asignaciones.length"
        class="resultado"
        aria-label="Parqueaderos asignados"
      >
        <li
          v-for="a in asignaciones"
          :key="a.id"
        >
          <strong>{{ codigoParqueadero(a.recurso_id) }}</strong> → {{ zonas.codigoBien(a.bien_privado_id) }}
        </li>
      </ul>
      <ol
        v-else
        class="resultado"
        aria-label="Bienes favorecidos"
      >
        <li
          v-for="b in sorteo.resultado ?? []"
          :key="b"
        >
          {{ zonas.codigoBien(b) }}
        </li>
      </ol>
    </HudPanel>

    <HudDialogo
      v-model:abierto="inscribiendo"
      titulo="Inscribir un bien"
    >
      <div class="campos">
        <ElegirBien
          v-model="bienId"
          etiqueta="Bien"
        />
        <label class="casilla">
          <input
            v-model="discapacidad"
            type="checkbox"
          >
          Hay una persona con movilidad reducida en el bien
        </label>
        <p
          v-if="inscribir.error.value"
          class="error"
          role="alert"
        >
          {{ inscribir.error.value }}
        </p>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="inscribiendo = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="inscribir.cargando.value"
          :deshabilitado="!bienId"
          @click="enviarInscripcion"
        >
          Inscribir
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="ejecutando"
      titulo="Ejecutar el sorteo"
    >
      <p>
        Se revelará la semilla y se asignarán los parqueaderos entre los {{ sorteo.inscritos.length }} bienes
        inscritos. Después no se admiten más inscripciones ni se puede repetir.
      </p>
      <p
        v-if="ejecutar.error.value"
        class="error"
        role="alert"
      >
        {{ ejecutar.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="ejecutando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="ejecutar.cargando.value"
          @click="confirmarEjecucion"
        >
          Ejecutar
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped>
.detalle-sorteo,
.campos {
  display: grid;
  gap: 14px;
}

.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: clamp(22px, 3vw, 28px);
}

.texto-2 {
  margin: 0;
  color: var(--texto-2);
}

.prueba {
  display: grid;
  gap: 10px;
  margin: 0 0 10px;
}

dt {
  color: var(--texto-3);
  font-size: 13px;
}

dd {
  margin: 2px 0 0;
}

code {
  font-family: var(--fuente-mono);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
}

.chips li {
  padding: 4px 10px;
  border: 1px solid var(--linea);
}

.resultado {
  display: grid;
  gap: 4px;
  margin: 0;
  padding-left: 20px;
}

.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.casilla {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
}

.casilla input {
  width: 20px;
  height: 20px;
  accent-color: var(--cian);
}

.ok,
.error {
  margin: 0;
}

.ok {
  padding: 10px 14px;
  border-left: 3px solid var(--verde);
  background: color-mix(in srgb, var(--verde) 10%, transparent);
}

.error {
  color: var(--magenta);
}
</style>
