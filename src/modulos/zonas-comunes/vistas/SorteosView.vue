<script setup lang="ts">
/**
 * Sorteos de parqueaderos: el listado (públicos para quien ve los bienes comunes), crear uno
 * (publica el compromiso de la semilla) y, con `:id`, su detalle con inscripciones y ejecución.
 */
import { computed, onMounted, ref } from 'vue'
import { type RouteLocationRaw, useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { Sorteo } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { aUtc, fecha } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { crearSorteo, listarSorteos } from '../api'
import DetalleSorteo from '../componentes/DetalleSorteo.vue'
import { useZonasComunes } from '../store'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const zonas = useZonasComunes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const gestiona = computed(() => entidad.tienePermiso('sorteos.gestionar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const sorteos = ref<Sorteo[]>([])

const sorteoId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const sorteo = computed(() => sorteos.value.find((s) => s.id === sorteoId.value) ?? null)
const sorteables = computed(() => zonas.recursos.filter((r) => r.tipo === 'parqueadero' && r.politica.modo === 'sorteo'))
const ruta = (sid = ''): RouteLocationRaw => ({ name: 'modulo', params: { ...route.params, id: sid } })

const COLUMNAS = [
  { clave: 'nombre', titulo: 'Sorteo' },
  { clave: 'vigencia', titulo: 'Vigencia' },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
]

// Crear
const creando = ref(false)
const nombre = ref('')
const elegidos = ref<string[]>([])
const desde = ref('')
const hasta = ref('')
const puntosDiscapacidad = ref('3')
const puntosNoFavorecido = ref('2')
const intentado = ref(false)
const errorCrear = computed(() => {
  if (!intentado.value) return null
  if (!nombre.value.trim()) return 'Escriba el nombre del sorteo.'
  if (elegidos.value.length === 0) return 'Elija al menos un parqueadero.'
  if (!desde.value || !hasta.value || hasta.value <= desde.value) return 'Indique la vigencia: «hasta» debe ser posterior a «desde».'
  return null
})
const entero = (t: string) => (/^\d+$/.test(t.trim()) ? Number.parseInt(t, 10) : 0)

const crear = useAccion((clave) =>
  crearSorteo(
    id.value,
    {
      nombre: nombre.value.trim(),
      recursos: elegidos.value,
      vigencia_desde: aUtc(`${desde.value}T00:00`, zona.value),
      vigencia_hasta: aUtc(`${hasta.value}T23:59`, zona.value),
      criterios: { puntos_discapacidad: entero(puntosDiscapacidad.value), puntos_no_favorecido: entero(puntosNoFavorecido.value) },
    },
    clave,
  ),
)

function abrirCrear() {
  nombre.value = desde.value = hasta.value = ''
  elegidos.value = sorteables.value.map((r) => r.id)
  intentado.value = false
  crear.reiniciar()
  creando.value = true
}

async function enviar() {
  intentado.value = true
  if (errorCrear.value) return
  const r = await crear.ejecutar()
  if (!r.ok) return
  creando.value = false
  sorteos.value = [r.valor, ...sorteos.value]
  await router.push(ruta(r.valor.id))
}

function actualizado(s: Sorteo) {
  sorteos.value = sorteos.value.map((x) => (x.id === s.id ? s : x))
}

async function cargar() {
  estado.value = 'cargando'
  try {
    const [lista] = await Promise.all([listarSorteos(id.value), zonas.asegurarRecursos(id.value)])
    sorteos.value = lista
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section
    class="sorteos"
    aria-labelledby="titulo-sorteos"
  >
    <header class="encabezado">
      <div>
        <RouterLink
          v-if="sorteoId"
          :to="ruta()"
          class="volver"
        >
          <IVolver aria-hidden="true" /> Todos los sorteos
        </RouterLink>
        <h1 id="titulo-sorteos">
          Sorteos de parqueaderos
        </h1>
      </div>
      <HudBoton
        v-if="gestiona && !sorteoId"
        :deshabilitado="estado !== 'listo'"
        @click="abrirCrear"
      >
        <IMas aria-hidden="true" /> Nuevo sorteo
      </HudBoton>
    </header>

    <HudEstado
      v-if="estado === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="estado === 'error'"
      estado="error"
      :mensaje="error ?? undefined"
      @reintentar="cargar"
    />
    <template v-else-if="sorteoId">
      <DetalleSorteo
        v-if="sorteo"
        :sorteo="sorteo"
        @cambio="actualizado"
      />
      <HudEstado
        v-else
        estado="vacio"
        mensaje="Ese sorteo no existe."
      />
    </template>
    <HudEstado
      v-else-if="sorteos.length === 0"
      estado="vacio"
      mensaje="Aún no hay sorteos."
    />
    <HudTabla
      v-else
      :filas="sorteos"
      :columnas="COLUMNAS"
      clave="id"
      titulo="Sorteos"
    >
      <template #celda-nombre="{ fila }">
        <span class="celda">
          <strong>{{ fila.nombre }}</strong>
          <small>{{ fila.recursos.length }} parqueaderos · {{ fila.inscritos.length }} inscritos</small>
        </span>
      </template>
      <template #celda-vigencia="{ fila }">
        {{ fecha(fila.vigencia_desde, zona) }} – {{ fecha(fila.vigencia_hasta, zona) }}
      </template>
      <template #celda-estado="{ fila }">
        <HudInsignia :tono="fila.estado === 'abierto' ? 'info' : 'exito'">
          {{ fila.estado === 'abierto' ? 'Abierto' : 'Ejecutado' }}
        </HudInsignia>
      </template>
      <template #celda-acciones="{ fila }">
        <HudBoton
          :a="ruta(fila.id)"
          variante="fantasma"
        >
          Ver<span class="solo-lector"> el sorteo {{ fila.nombre }}</span>
        </HudBoton>
      </template>
    </HudTabla>

    <HudDialogo
      v-model:abierto="creando"
      titulo="Nuevo sorteo"
    >
      <form
        id="formulario-sorteo"
        class="campos"
        novalidate
        @submit.prevent="enviar"
      >
        <HudCampo
          v-model="nombre"
          etiqueta="Nombre"
          requerido
        />
        <fieldset>
          <legend>Parqueaderos que se sortean</legend>
          <p
            v-if="sorteables.length === 0"
            class="texto-2"
          >
            No hay parqueaderos que se asignen por sorteo.
          </p>
          <label
            v-for="r in sorteables"
            :key="r.id"
            class="casilla"
          >
            <input
              v-model="elegidos"
              type="checkbox"
              :value="r.id"
            >
            {{ r.parqueadero?.codigo ?? r.nombre }}
          </label>
        </fieldset>
        <HudFecha
          v-model="desde"
          etiqueta="Vigente desde"
          requerido
        />
        <HudFecha
          v-model="hasta"
          etiqueta="Vigente hasta"
          :minimo="desde || undefined"
          requerido
        />
        <HudCampo
          v-model="puntosDiscapacidad"
          etiqueta="Puntos extra por movilidad reducida"
          modo-entrada="numeric"
        />
        <HudCampo
          v-model="puntosNoFavorecido"
          etiqueta="Puntos extra si no ganó el sorteo anterior"
          modo-entrada="numeric"
        />
        <p class="texto-2">
          Al crearlo se publica el compromiso de la semilla: la prueba de que el resultado no se puede manipular.
        </p>
        <p
          v-if="errorCrear || crear.error.value"
          class="error"
          role="alert"
        >
          {{ errorCrear ?? crear.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="creando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-sorteo"
          :cargando="crear.cargando.value"
        >
          Crear sorteo
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped>
.sorteos,
.campos {
  display: grid;
  gap: 16px;
}

.encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

h1 {
  font-size: clamp(24px, 3.5vw, 34px);
}

.volver {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  color: var(--cian);
}

.celda {
  display: grid;
  text-align: left;
}

small,
.texto-2 {
  color: var(--texto-2);
}

.texto-2,
.error {
  margin: 0;
}

.error {
  color: var(--magenta);
}

fieldset {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 6px;
  font-weight: 600;
}

.casilla {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
}

.casilla input {
  width: 20px;
  height: 20px;
  accent-color: var(--cian);
}
</style>
