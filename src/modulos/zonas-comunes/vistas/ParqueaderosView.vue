<script setup lang="ts">
/**
 * Parqueaderos: cupos con su asignación vigente; crear un cupo, asignarlo a un bien privado por
 * un periodo y liberarlo (con `parqueaderos.asignar`).
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { NaturalezaParqueadero, OrigenAsignacionParqueadero, Parqueadero, TipoParqueadero } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { aUtc, fecha } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import { asignarParqueadero, crearParqueadero, liberarParqueadero, listarParqueaderos } from '../api'
import ElegirBien from '../componentes/ElegirBien.vue'
import { NATURALEZA_PARQUEADERO, ORIGEN_ASIGNACION, TIPO_PARQUEADERO } from '../recursos'
import { useZonasComunes } from '../store'

const entidad = useEntidad()
const zonas = useZonasComunes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const puedeAsignar = computed(() => entidad.tienePermiso('parqueaderos.asignar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<Parqueadero[]>([])
const resultado = ref<string | null>(null)
const elegido = ref<Parqueadero | null>(null)

/** Filas con `id` (la tabla necesita una clave de texto), ordenadas por código. */
const ordenados = computed(() =>
  lista.value
    .map((p) => ({ ...p, id: p.recurso.id }))
    .sort((a, b) => (a.recurso.parqueadero?.codigo ?? '').localeCompare(b.recurso.parqueadero?.codigo ?? '')),
)
const opciones = <T extends string>(m: Record<T, string>) => (Object.keys(m) as T[]).map((valor) => ({ valor, etiqueta: m[valor] }))

const COLUMNAS = [
  { clave: 'codigo', titulo: 'Cupo' },
  { clave: 'naturaleza', titulo: 'Naturaleza' },
  { clave: 'asignacion', titulo: 'Asignado a' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
]

// Crear cupo
const creando = ref(false)
const codigo = ref('')
const tipoVehiculo = ref<TipoParqueadero>('carro')
const naturaleza = ref<NaturalezaParqueadero>('comunal')
const ubicacion = ref('')
const intentadoCrear = ref(false)
const crear = useAccion((clave) =>
  crearParqueadero(id.value, { codigo: codigo.value.trim(), tipo_vehiculo: tipoVehiculo.value, naturaleza: naturaleza.value, ubicacion: ubicacion.value.trim() || null }, clave),
)

function abrirCrear() {
  codigo.value = ubicacion.value = ''
  intentadoCrear.value = false
  crear.reiniciar()
  creando.value = true
}

async function enviarCrear() {
  intentadoCrear.value = true
  if (!codigo.value.trim()) return
  const r = await crear.ejecutar()
  if (!r.ok) return
  creando.value = false
  lista.value = [...lista.value, { recurso: r.valor, asignacion: null }]
  zonas.recordarRecurso(r.valor)
  resultado.value = `Parqueadero ${codigo.value.trim()} creado.`
}

// Asignar
const asignando = ref(false)
const bienId = ref('')
const origen = ref<OrigenAsignacionParqueadero>('manual')
const desde = ref('')
const hasta = ref('')
const intentadoAsignar = ref(false)
const asignar = useAccion((clave) =>
  asignarParqueadero(
    id.value,
    elegido.value?.recurso.id ?? '',
    {
      bien_privado_id: bienId.value,
      origen: origen.value,
      desde: desde.value ? aUtc(`${desde.value}T00:00`, zona.value) : null,
      hasta: hasta.value ? aUtc(`${hasta.value}T23:59`, zona.value) : null,
    },
    clave,
  ),
)

function abrirAsignar(p: Parqueadero) {
  elegido.value = p
  bienId.value = desde.value = hasta.value = ''
  origen.value = 'manual'
  intentadoAsignar.value = false
  asignar.reiniciar()
  asignando.value = true
}

async function enviarAsignar() {
  intentadoAsignar.value = true
  if (!bienId.value) return
  const r = await asignar.ejecutar()
  if (!r.ok) return
  asignando.value = false
  lista.value = lista.value.map((p) => (p.recurso.id === r.valor.recurso_id ? { ...p, asignacion: r.valor } : p))
  resultado.value = `Parqueadero asignado a ${zonas.codigoBien(r.valor.bien_privado_id)}.`
}

// Liberar
const liberando = ref(false)
const liberar = useAccion(() => liberarParqueadero(id.value, elegido.value?.asignacion?.id ?? ''))

function abrirLiberar(p: Parqueadero) {
  elegido.value = p
  liberar.reiniciar()
  liberando.value = true
}

async function confirmarLiberar() {
  const p = elegido.value
  if (!p || !(await liberar.ejecutar()).ok) return
  liberando.value = false
  lista.value = lista.value.map((x) => (x.recurso.id === p.recurso.id ? { ...x, asignacion: null } : x))
  resultado.value = `Parqueadero ${p.recurso.parqueadero?.codigo ?? ''} liberado.`
}

watch(lista, (l) =>
  zonas.resolverBienes(id.value, l.flatMap((p) => (p.asignacion ? [p.asignacion.bien_privado_id] : [])), entidad.tienePermiso('bienes_privados.ver')),
)

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = await listarParqueaderos(id.value)
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
    class="parqueaderos"
    aria-labelledby="titulo-parqueaderos"
  >
    <header class="encabezado">
      <h1 id="titulo-parqueaderos">
        Parqueaderos
      </h1>
      <HudBoton
        v-if="puedeAsignar"
        @click="abrirCrear"
      >
        <IMas aria-hidden="true" /> Nuevo cupo
      </HudBoton>
    </header>

    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

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
    <HudEstado
      v-else-if="lista.length === 0"
      estado="vacio"
      mensaje="Aún no hay parqueaderos registrados."
    />
    <HudTabla
      v-else
      :filas="ordenados"
      :columnas="COLUMNAS"
      clave="id"
      titulo="Parqueaderos de la copropiedad"
    >
      <template #celda-codigo="{ fila }">
        <span class="celda">
          <strong>{{ fila.recurso.parqueadero?.codigo ?? fila.recurso.nombre }}</strong>
          <small>{{ fila.recurso.parqueadero ? TIPO_PARQUEADERO[fila.recurso.parqueadero.tipo_vehiculo] : '' }}{{ fila.recurso.ubicacion ? ` · ${fila.recurso.ubicacion}` : '' }}</small>
        </span>
      </template>
      <template #celda-naturaleza="{ fila }">
        {{ fila.recurso.parqueadero ? NATURALEZA_PARQUEADERO[fila.recurso.parqueadero.naturaleza] : '—' }}
      </template>
      <template #celda-asignacion="{ fila }">
        <span
          v-if="fila.asignacion"
          class="celda"
        >
          <strong>{{ zonas.codigoBien(fila.asignacion.bien_privado_id) }}</strong>
          <small>
            {{ ORIGEN_ASIGNACION[fila.asignacion.origen] }} · desde {{ fecha(fila.asignacion.desde, zona) }}{{ fila.asignacion.hasta ? ` hasta ${fecha(fila.asignacion.hasta, zona)}` : '' }}
          </small>
        </span>
        <HudInsignia
          v-else
          tono="neutro"
        >
          Libre
        </HudInsignia>
      </template>
      <template #celda-acciones="{ fila }">
        <template v-if="puedeAsignar">
          <HudBoton
            v-if="fila.asignacion"
            variante="fantasma"
            @click="abrirLiberar(fila)"
          >
            Liberar<span class="solo-lector"> {{ fila.recurso.parqueadero?.codigo }}</span>
          </HudBoton>
          <HudBoton
            v-else
            variante="secundario"
            @click="abrirAsignar(fila)"
          >
            Asignar<span class="solo-lector"> {{ fila.recurso.parqueadero?.codigo }}</span>
          </HudBoton>
        </template>
      </template>
    </HudTabla>

    <HudDialogo
      v-model:abierto="creando"
      titulo="Nuevo cupo de parqueadero"
    >
      <form
        id="formulario-cupo"
        class="campos"
        novalidate
        @submit.prevent="enviarCrear"
      >
        <HudCampo
          v-model="codigo"
          etiqueta="Código"
          :error="intentadoCrear && !codigo.trim() ? 'Escriba el código del cupo.' : null"
          requerido
        />
        <HudSelector
          v-model="tipoVehiculo"
          etiqueta="Vehículo"
          :opciones="opciones(TIPO_PARQUEADERO)"
        />
        <HudSelector
          v-model="naturaleza"
          etiqueta="Naturaleza"
          :opciones="opciones(NATURALEZA_PARQUEADERO)"
        />
        <HudCampo
          v-model="ubicacion"
          etiqueta="Ubicación (opcional)"
        />
        <p
          v-if="crear.error.value"
          class="error"
          role="alert"
        >
          {{ crear.error.value }}
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
          form="formulario-cupo"
          :cargando="crear.cargando.value"
        >
          Crear
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="asignando"
      :titulo="`Asignar ${elegido?.recurso.parqueadero?.codigo ?? 'el parqueadero'}`"
    >
      <div class="campos">
        <ElegirBien
          v-model="bienId"
          etiqueta="Bien"
          solo-busqueda
          :error="intentadoAsignar && !bienId ? 'Elija el bien.' : null"
        />
        <form
          id="formulario-asignar-cupo"
          class="campos"
          @submit.prevent="enviarAsignar"
        >
          <HudSelector
            v-model="origen"
            etiqueta="Origen"
            :opciones="opciones(ORIGEN_ASIGNACION)"
          />
          <HudFecha
            v-model="desde"
            etiqueta="Desde (opcional)"
            ayuda="Vacío = desde hoy."
          />
          <HudFecha
            v-model="hasta"
            etiqueta="Hasta (opcional)"
            :minimo="desde || undefined"
          />
          <p
            v-if="asignar.error.value"
            class="error"
            role="alert"
          >
            {{ asignar.error.value }}
          </p>
        </form>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="asignando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-asignar-cupo"
          :cargando="asignar.cargando.value"
        >
          Asignar
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="liberando"
      titulo="Liberar el parqueadero"
    >
      <p>
        El cupo {{ elegido?.recurso.parqueadero?.codigo }} quedará libre desde ahora.
      </p>
      <p
        v-if="liberar.error.value"
        class="error"
        role="alert"
      >
        {{ liberar.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="liberando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="liberar.cargando.value"
          @click="confirmarLiberar"
        >
          Liberar
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped>
.parqueaderos,
.campos {
  display: grid;
  gap: 16px;
}

.encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

h1 {
  font-size: clamp(24px, 3.5vw, 34px);
}

.celda {
  display: grid;
  text-align: left;
}

small {
  color: var(--texto-3);
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
