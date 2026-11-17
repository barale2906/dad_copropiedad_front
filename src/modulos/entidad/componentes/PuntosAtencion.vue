<script setup lang="ts">
/**
 * Puntos de atención de la PH (oficina, portería, recepción) con su horario: listado, registrar
 * uno nuevo y reemplazar su horario (con `copropiedad.datos.editar`).
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Horario, PuntoAtencion, TipoPuntoAtencion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaCalendario } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import IMas from '~icons/tabler/plus'
import { cambiarHorario, crearPuntoAtencion, puntosAtencion } from '../api'
import { TIPO_PUNTO } from '../ficha'
import { normalizarHorario, resumirHorario, validarHorario } from '@/formato/horario'
import EditorHorario from '@/hud/componentes/EditorHorario.vue'

const props = defineProps<{ copropiedadId: string; editable: boolean }>()

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const puntos = ref<PuntoAtencion[]>([])

/** Diálogo abierto: un punto nuevo o el horario de uno existente. */
const editando = ref<{ modo: 'nuevo' } | { modo: 'horario'; punto: PuntoAtencion } | null>(null)
const abierto = computed({
  get: () => editando.value !== null,
  set: (si: boolean) => {
    if (!si) editando.value = null
  },
})
const tipo = ref<TipoPuntoAtencion>('oficina_administracion')
const nombre = ref('')
const ubicacion = ref('')
const telefono = ref('')
const horario = ref<Horario>({ franjas: [], excepciones: [] })
const intentado = ref(false)

const opcionesTipo = (Object.keys(TIPO_PUNTO) as TipoPuntoAtencion[]).map((valor) => ({ valor, etiqueta: TIPO_PUNTO[valor] }))
const erroresHorario = computed(() => (intentado.value ? validarHorario(horario.value) : []))
const errorNombre = computed(() => (intentado.value && !nombre.value.trim() ? 'Escriba el nombre del punto.' : null))
const titulo = computed(() =>
  editando.value?.modo === 'horario' ? `Horario de ${editando.value.punto.nombre}` : 'Agregar punto de atención',
)

const crear = useAccion((clave) =>
  crearPuntoAtencion(
    props.copropiedadId,
    {
      tipo: tipo.value,
      nombre: nombre.value.trim(),
      ubicacion: ubicacion.value.trim() || null,
      telefono: telefono.value.trim() || null,
      horario: normalizarHorario(horario.value),
    },
    clave,
  ),
)
const guardarHorario = useAccion((_clave, puntoId: string) =>
  cambiarHorario(props.copropiedadId, puntoId, normalizarHorario(horario.value)),
)
const accion = computed(() => (editando.value?.modo === 'horario' ? guardarHorario : crear))

function abrirNuevo() {
  tipo.value = 'oficina_administracion'
  nombre.value = ubicacion.value = telefono.value = ''
  horario.value = { franjas: [], excepciones: [] }
  intentado.value = false
  crear.reiniciar()
  editando.value = { modo: 'nuevo' }
}

function abrirHorario(p: PuntoAtencion) {
  // Copia profunda: el horario es reactivo (structuredClone no acepta proxies) y no debe
  // cambiar en la tarjeta hasta guardar.
  horario.value = {
    franjas: (p.horario.franjas ?? []).map((f) => ({ ...f })),
    excepciones: (p.horario.excepciones ?? []).map((x) => ({ ...x })),
  }
  intentado.value = false
  guardarHorario.reiniciar()
  editando.value = { modo: 'horario', punto: p }
}

async function enviar() {
  intentado.value = true
  const e = editando.value
  if (!e || validarHorario(horario.value).length) return
  if (e.modo === 'nuevo') {
    if (!nombre.value.trim()) return
    const r = await crear.ejecutar()
    if (!r.ok) return
    puntos.value = [...puntos.value, r.valor]
  } else {
    const r = await guardarHorario.ejecutar(e.punto.id)
    if (!r.ok) return
    const nuevo = normalizarHorario(horario.value)
    puntos.value = puntos.value.map((p) => (p.id === e.punto.id ? { ...p, horario: nuevo } : p))
  }
  editando.value = null
}

async function cargar() {
  estado.value = 'cargando'
  try {
    puntos.value = await puntosAtencion(props.copropiedadId)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <div class="puntos">
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
    <p
      v-else-if="puntos.length === 0"
      class="vacio"
    >
      Aún no hay puntos de atención registrados.
    </p>
    <ul
      v-else
      class="lista"
    >
      <li
        v-for="p in puntos"
        :key="p.id"
        class="punto"
      >
        <div>
          <strong>{{ p.nombre }}</strong>
          <span class="tipo">{{ TIPO_PUNTO[p.tipo] }}</span>
        </div>
        <p
          v-if="p.ubicacion || p.telefono"
          class="texto-2"
        >
          {{ [p.ubicacion, p.telefono].filter(Boolean).join(' · ') }}
        </p>
        <ul class="horario">
          <li
            v-for="linea in resumirHorario(p.horario)"
            :key="linea"
          >
            {{ linea }}
          </li>
          <li
            v-for="x in p.horario.excepciones ?? []"
            :key="x.fecha"
            class="excepcion"
          >
            {{ fechaCalendario(x.fecha) }}: {{ x.inicio ? 'horario especial' : 'no se atiende' }}{{ x.motivo ? ` (${x.motivo})` : '' }}
          </li>
        </ul>
        <HudBoton
          v-if="editable"
          variante="fantasma"
          @click="abrirHorario(p)"
        >
          Cambiar horario<span class="solo-lector"> de {{ p.nombre }}</span>
        </HudBoton>
      </li>
    </ul>
    <HudBoton
      v-if="editable && estado === 'listo'"
      variante="secundario"
      @click="abrirNuevo"
    >
      <IMas aria-hidden="true" /> Agregar punto de atención
    </HudBoton>

    <HudDialogo
      v-model:abierto="abierto"
      :titulo="titulo"
    >
      <form
        id="formulario-punto"
        class="campos"
        novalidate
        @submit.prevent="enviar"
      >
        <template v-if="editando?.modo === 'nuevo'">
          <HudSelector
            v-model="tipo"
            etiqueta="Tipo"
            :opciones="opcionesTipo"
          />
          <HudCampo
            v-model="nombre"
            etiqueta="Nombre"
            :error="errorNombre"
            requerido
          />
          <HudCampo
            v-model="ubicacion"
            etiqueta="Ubicación (opcional)"
          />
          <HudCampo
            v-model="telefono"
            etiqueta="Teléfono (opcional)"
            tipo="tel"
          />
        </template>
        <EditorHorario v-model="horario" />
        <ul
          v-if="erroresHorario.length"
          class="error"
          role="alert"
        >
          <li
            v-for="e in erroresHorario"
            :key="e"
          >
            {{ e }}
          </li>
        </ul>
        <p
          v-if="accion.error.value"
          class="error"
          role="alert"
        >
          {{ accion.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="abierto = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-punto"
          :cargando="accion.cargando.value"
        >
          Guardar
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped>
.puntos {
  display: grid;
  gap: 12px;
  justify-items: start;
}

.lista {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 12px;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.punto {
  display: grid;
  gap: 6px;
  align-content: start;
  padding: 12px 14px;
  border: 1px solid var(--linea);
  background: var(--superficie);
}

.punto > div {
  display: grid;
}

.tipo {
  color: var(--cian);
  font-size: 14px;
}

.texto-2,
.vacio {
  margin: 0;
  color: var(--texto-2);
}

.horario {
  margin: 0;
  padding-left: 18px;
}

.excepcion {
  color: var(--ambar);
}

.campos {
  display: grid;
  gap: 14px;
}

.error {
  margin: 0;
  color: var(--magenta);
}
</style>
