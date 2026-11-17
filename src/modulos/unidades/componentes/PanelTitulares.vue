<script setup lang="ts">
/**
 * Titulares de un bien: vigentes e historial, registrar los primeros, **transferir** (venta o
 * sucesión: el dueño no se edita) y designar al representante. Los porcentajes deben sumar 100 %
 * por clase de derecho; se valida en vivo antes de enviar.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { TipoTitularidad, Titular } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fecha } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import IBorrar from '~icons/tabler/trash'
import { designarRepresentante, registrarTitulares, titulares, transferir } from '../api'
import { sumasPorClase, TIPO_TITULARIDAD, validarTitulares } from '../titulares'

const props = defineProps<{ bienId: string; codigo: string }>()

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const editable = computed(() => entidad.tienePermiso('titulares.editar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<Titular[]>([])
const resultado = ref<string | null>(null)

const vigentes = computed(() => lista.value.filter((t) => !t.titularidad.vigente_hasta))
const anteriores = computed(() => lista.value.filter((t) => t.titularidad.vigente_hasta))
const opcionesTipo = (Object.keys(TIPO_TITULARIDAD) as TipoTitularidad[]).map((valor) => ({ valor, etiqueta: TIPO_TITULARIDAD[valor] }))

// Registrar o transferir
interface Fila {
  nombre: string
  documento: string
  telefono: string
  tipo: TipoTitularidad
  porcentaje: string
  es_representante: boolean
}
const filaNueva = (): Fila => ({ nombre: '', documento: '', telefono: '', tipo: 'propietario', porcentaje: '100', es_representante: true })
const abierto = ref(false)
const filas = ref<Fila[]>([])
const intentado = ref(false)
const esTransferencia = computed(() => vigentes.value.length > 0)
const errores = computed(() => {
  if (!intentado.value) return []
  const faltan = filas.value.some((f) => !f.nombre.trim() || !f.documento.trim()) ? ['Escriba el nombre y el documento de cada titular.'] : []
  return [...faltan, ...validarTitulares(filas.value)]
})
const sumas = computed(() => sumasPorClase(filas.value))

const guardar = useAccion((clave) => {
  const lista = filas.value.map((f) => ({
    persona: { nombre: f.nombre.trim(), documento: f.documento.trim(), telefono: f.telefono.trim() || null },
    tipo: f.tipo,
    porcentaje: f.porcentaje.trim().replace(',', '.'),
    es_representante: f.es_representante,
  }))
  return esTransferencia.value ? transferir(id.value, props.bienId, lista, null, clave) : registrarTitulares(id.value, props.bienId, lista, clave)
})

function abrir() {
  filas.value = [filaNueva()]
  intentado.value = false
  guardar.reiniciar()
  abierto.value = true
}

function agregarFila() {
  filas.value = [...filas.value, { ...filaNueva(), porcentaje: '', es_representante: false }]
}

function quitarFila(i: number) {
  filas.value = filas.value.filter((_, j) => j !== i)
}

function marcarRepresentante(i: number) {
  filas.value = filas.value.map((f, j) => ({ ...f, es_representante: j === i }))
}

async function enviar() {
  intentado.value = true
  if (errores.value.length) return
  if (!(await guardar.ejecutar()).ok) return
  abierto.value = false
  resultado.value = esTransferencia.value ? `Transferencia de ${props.codigo} registrada.` : `Titulares de ${props.codigo} registrados.`
  await cargar()
}

// Representante
const representante = ref('')
const designar = useAccion(() => designarRepresentante(id.value, props.bienId, representante.value))
const opcionesRepresentante = computed(() => vigentes.value.map((t) => ({ valor: t.titularidad.persona_id, etiqueta: t.nombre })))
const actual = computed(() => vigentes.value.find((t) => t.titularidad.es_representante)?.titularidad.persona_id ?? '')

async function guardarRepresentante() {
  if (!representante.value || representante.value === actual.value) return
  if (!(await designar.ejecutar()).ok) return
  resultado.value = 'Representante actualizado.'
  await cargar()
}

watch(actual, (a) => (representante.value = a), { immediate: true })

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = await titulares(id.value, props.bienId)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <div class="titulares">
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
    <template v-else>
      <p
        v-if="vigentes.length === 0"
        class="texto-2"
      >
        {{ codigo }} aún no tiene titulares registrados.
      </p>
      <ul
        v-else
        class="lista"
        :aria-label="`Titulares vigentes de ${codigo}`"
      >
        <li
          v-for="t in vigentes"
          :key="t.titularidad.id"
        >
          <strong>{{ t.nombre }}</strong>
          <span>{{ TIPO_TITULARIDAD[t.titularidad.tipo] }} · {{ t.titularidad.porcentaje.replace('.', ',') }} %</span>
          <small>{{ t.documento ?? '' }}{{ t.telefono ? ` · ${t.telefono}` : '' }} · desde {{ fecha(t.titularidad.vigente_desde, zona) }}</small>
          <HudInsignia
            v-if="t.titularidad.es_representante"
            tono="info"
          >
            Representante
          </HudInsignia>
        </li>
      </ul>

      <div
        v-if="editable"
        class="botones"
      >
        <HudBoton
          variante="secundario"
          @click="abrir"
        >
          <IMas aria-hidden="true" /> {{ esTransferencia ? 'Registrar transferencia' : 'Registrar titulares' }}
        </HudBoton>
      </div>
      <form
        v-if="editable && vigentes.length > 1"
        class="representante"
        @submit.prevent="guardarRepresentante"
      >
        <HudSelector
          v-model="representante"
          etiqueta="Representante ante la copropiedad"
          :opciones="opcionesRepresentante"
        />
        <HudBoton
          tipo="submit"
          variante="fantasma"
          :cargando="designar.cargando.value"
          :deshabilitado="representante === actual"
        >
          Designar
        </HudBoton>
      </form>
      <details v-if="anteriores.length">
        <summary>Titulares anteriores ({{ anteriores.length }})</summary>
        <ul class="lista anteriores">
          <li
            v-for="t in anteriores"
            :key="t.titularidad.id"
          >
            {{ t.nombre }} · {{ t.titularidad.porcentaje.replace('.', ',') }} % · hasta {{ fecha(t.titularidad.vigente_hasta ?? '', zona) }}
          </li>
        </ul>
      </details>
    </template>

    <HudDialogo
      v-model:abierto="abierto"
      :titulo="esTransferencia ? `Transferencia de ${codigo}` : `Titulares de ${codigo}`"
    >
      <form
        id="formulario-titulares"
        class="campos"
        novalidate
        @submit.prevent="enviar"
      >
        <p
          v-if="esTransferencia"
          class="aviso"
        >
          Los titulares actuales dejarán de serlo (y perderán el rol de propietario) y quedarán estos.
        </p>
        <fieldset
          v-for="(f, i) in filas"
          :key="i"
          class="fila"
        >
          <legend>Titular {{ i + 1 }}</legend>
          <HudCampo
            v-model="f.nombre"
            etiqueta="Nombre completo"
            requerido
          />
          <HudCampo
            v-model="f.documento"
            etiqueta="Documento"
            requerido
          />
          <HudCampo
            v-model="f.telefono"
            etiqueta="Teléfono (opcional)"
            tipo="tel"
          />
          <HudSelector
            v-model="f.tipo"
            etiqueta="Derecho"
            :opciones="opcionesTipo"
          />
          <HudCampo
            v-model="f.porcentaje"
            etiqueta="Porcentaje"
            modo-entrada="decimal"
          />
          <label class="casilla">
            <input
              type="radio"
              name="representante"
              :checked="f.es_representante"
              @change="marcarRepresentante(i)"
            >
            Representante
          </label>
          <button
            v-if="filas.length > 1"
            type="button"
            class="quitar"
            @click="quitarFila(i)"
          >
            <IBorrar aria-hidden="true" /><span class="solo-lector">Quitar el titular {{ i + 1 }}</span>
          </button>
        </fieldset>
        <HudBoton
          variante="fantasma"
          @click="agregarFila"
        >
          <IMas aria-hidden="true" /> Agregar otro titular
        </HudBoton>
        <p
          class="sumas"
          aria-live="polite"
        >
          <span
            v-for="(suma, clase) in sumas"
            :key="clase"
          >Suma de {{ clase }}: <strong>{{ suma.replace('.', ',') }} %</strong></span>
        </p>
        <ul
          v-if="errores.length"
          class="error"
          role="alert"
        >
          <li
            v-for="e in errores"
            :key="e"
          >
            {{ e }}
          </li>
        </ul>
        <p
          v-if="guardar.error.value"
          class="error"
          role="alert"
        >
          {{ guardar.error.value }}
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
          form="formulario-titulares"
          :cargando="guardar.cargando.value"
        >
          {{ esTransferencia ? 'Registrar transferencia' : 'Registrar' }}
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped>
.titulares,
.campos {
  display: grid;
  gap: 14px;
}

.lista {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista li {
  display: grid;
  gap: 2px;
  justify-items: start;
  padding: 10px 12px;
  border: 1px solid var(--linea);
}

.anteriores li {
  display: block;
  color: var(--texto-2);
}

small,
.texto-2 {
  color: var(--texto-2);
}

.botones {
  display: flex;
  gap: 8px;
}

.representante {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
}

.representante > :first-child {
  flex: 1 1 240px;
}

summary {
  min-height: 40px;
  padding: 8px 0;
  color: var(--cian);
  cursor: pointer;
}

.fila {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));
  align-items: end;
  gap: 10px;
  margin: 0;
  padding: 12px;
  border: 1px solid var(--linea);
}

legend {
  padding: 0 4px;
  font-weight: 600;
}

.casilla {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
}

.casilla input {
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

.sumas {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0;
  color: var(--texto-2);
}

.aviso {
  margin: 0;
  color: var(--ambar);
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
