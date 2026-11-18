<script setup lang="ts">
/**
 * Preguntas de una reunión: agregar, editar y quitar las de borrador (antes o durante la
 * asamblea) y, al conducir, abrir, cerrar o anular la votación con su escrutinio en vivo. El
 * escrutinio de las abiertas llega del tablero (WebSocket) por `en-vivo`.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { AccionPregunta, NuevaPregunta, Pregunta, PreguntaEnVivo, PuntoOrdenDia, Reunion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { leerEscrutinio } from '@/formato/escrutinio'
import { horaEn } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import EscrutinioPregunta from '@/hud/componentes/EscrutinioPregunta.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import { borrarPregunta, cambiarPregunta, crearPregunta, editarPregunta, preguntas as pedirPreguntas } from '../api'
import { ACCION_PREGUNTA, accionesPregunta, ESTADO_PREGUNTA, TIPO_PREGUNTA, textoRegla } from '../reglas'
import EditorPregunta from './EditorPregunta.vue'

const props = withDefaults(
  defineProps<{
    entidadId: string
    reunion: Reunion
    puntos?: PuntoOrdenDia[]
    /** Preguntas abiertas con su escrutinio en vivo (del tablero). */
    enVivo?: PreguntaEnVivo[]
    /** Enlace al escrutinio completo de una pregunta (si se omite, no se ofrece). */
    resultados?: (p: Pregunta) => object | null
  }>(),
  { puntos: () => [], enVivo: () => [], resultados: undefined },
)
const emit = defineEmits<{ cambio: [] }>()

const entidad = useEntidad()
const zona = computed(() => entidad.zonaHoraria)
const quien = computed(() => ({ convocar: entidad.tienePermiso('asambleas.convocar'), conducir: entidad.tienePermiso('asambleas.conducir') }))
const puedeAgregar = computed(() => (quien.value.convocar || quien.value.conducir) && !['cerrada', 'cancelada'].includes(props.reunion.estado))

const lista = ref<Pregunta[]>([])
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const resultado = ref<string | null>(null)
/** `nueva`, el id de la que se edita o `null`. */
const editando = ref<string | null>(null)
const anulando = ref<Pregunta | null>(null)
const abiertoAnular = ref(false)

const escrutinios = computed(() => new Map(props.enVivo.map((x) => [x.pregunta.id, leerEscrutinio(x.escrutinio)])))
const enEdicion = computed(() => lista.value.find((p) => p.id === editando.value) ?? null)

const guardar = useAccion((clave, datos: NuevaPregunta) =>
  enEdicion.value ? editarPregunta(props.entidadId, props.reunion.id, enEdicion.value.id, datos) : crearPregunta(props.entidadId, props.reunion.id, datos, clave),
  { alConflicto: () => cargar() },
)
const quitar = useAccion((_c, p: Pregunta) => borrarPregunta(props.entidadId, props.reunion.id, p.id), { alConflicto: () => cargar() })
const cambiar = useAccion((_c, p: Pregunta, accion: AccionPregunta, motivo?: string) => cambiarPregunta(props.entidadId, props.reunion.id, p.id, accion, motivo), {
  alConflicto: () => cargar(),
})
const errorAccion = computed(() => quitar.error.value ?? cambiar.error.value)

const HECHO: Record<AccionPregunta, string> = {
  abrir: 'Votación abierta: se avisó a los presentes por WhatsApp.',
  cerrar: 'Votación cerrada: el escrutinio quedó guardado.',
  anular: 'Pregunta anulada.',
}

async function cargar() {
  try {
    lista.value = await pedirPreguntas(props.entidadId, props.reunion.id)
    error.value = null
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

async function alGuardar(datos: NuevaPregunta) {
  const nueva = !enEdicion.value
  if (!(await guardar.ejecutar(datos)).ok) return
  resultado.value = nueva ? 'Pregunta agregada.' : 'Pregunta guardada.'
  editando.value = null
  await cargar()
  emit('cambio')
}

async function alQuitar(p: Pregunta) {
  if (!(await quitar.ejecutar(p)).ok) return
  resultado.value = 'Pregunta quitada.'
  await cargar()
  emit('cambio')
}

async function hacer(p: Pregunta, accion: AccionPregunta | 'editar' | 'eliminar', motivo?: string) {
  if (accion === 'editar') {
    editando.value = p.id
    return
  }
  if (accion === 'eliminar') return alQuitar(p)
  if (accion === 'anular' && motivo === undefined) {
    anulando.value = p
    abiertoAnular.value = true
    return
  }
  if (!(await cambiar.ejecutar(p, accion, motivo)).ok) return
  abiertoAnular.value = false
  resultado.value = HECHO[accion]
  await cargar()
  emit('cambio')
}

const textoBoton = (a: AccionPregunta | 'editar' | 'eliminar') => (a === 'editar' ? 'Editar' : a === 'eliminar' ? 'Quitar' : ACCION_PREGUNTA[a])
const varianteBoton = (a: AccionPregunta | 'editar' | 'eliminar') => (a === 'abrir' || a === 'cerrar' ? 'primario' : a === 'editar' ? 'secundario' : 'fantasma')

onMounted(cargar)
watch(() => props.reunion.estado, () => void cargar())
// Una pregunta que se abre o cierra desde otra pantalla llega por el tablero.
watch(
  () => props.enVivo.map((x) => `${x.pregunta.id}:${x.pregunta.estado}`).join(),
  (ahora, antes) => {
    if (antes !== undefined && ahora !== antes) void cargar()
  },
)
defineExpose({ cargar })
</script>

<template>
  <div class="preguntas">
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
        v-if="resultado"
        class="ok"
        role="status"
      >
        {{ resultado }}
      </p>
      <p
        v-if="errorAccion"
        class="error"
        role="alert"
      >
        {{ errorAccion }}
      </p>
      <HudEstado
        v-if="!lista.length && editando === null"
        estado="vacio"
        mensaje="Todavía no hay preguntas para votar."
      />
      <ol
        v-else-if="lista.length"
        class="lista"
        aria-label="Preguntas"
      >
        <li
          v-for="p in lista"
          :key="p.id"
        >
          <EditorPregunta
            v-if="editando === p.id"
            class="crece"
            :entidad-id="entidadId"
            :pregunta="p"
            :puntos="puntos"
            :busca-personas="entidad.tienePermiso('personas.ver')"
            :cargando="guardar.cargando.value"
            :error="guardar.error.value"
            @guardar="alGuardar"
            @cancelar="editando = null"
          />
          <template v-else>
            <span class="crece">
              <strong>{{ p.orden }}. {{ p.enunciado }}</strong>
              <small>
                {{ TIPO_PREGUNTA[p.tipo] }} · {{ p.tipo_voto === 'reservado' ? 'reservada' : 'nominal' }}
                <template v-if="p.tipo !== 'eleccion'"> · {{ textoRegla(p.regla_mayoria) }}</template>
                <template v-else> · {{ p.cupos }} cupo(s)</template>
                <template v-if="p.estado === 'abierta' && p.cierra_en"> · cierra a las {{ horaEn(p.cierra_en, zona) }}</template>
              </small>
            </span>
            <HudInsignia :tono="ESTADO_PREGUNTA[p.estado].tono">
              {{ ESTADO_PREGUNTA[p.estado].texto }}
            </HudInsignia>
            <EscrutinioPregunta
              v-if="p.estado === 'abierta' && escrutinios.get(p.id)"
              class="ancho"
              :escrutinio="escrutinios.get(p.id)!"
              :reservada="p.tipo_voto === 'reservado'"
              abierta
              :etiqueta="`Resultado parcial de «${p.enunciado}»`"
            />
            <div class="botones">
              <HudBoton
                v-for="a in accionesPregunta(p, reunion.estado, quien)"
                :key="a"
                :variante="varianteBoton(a)"
                :cargando="cambiar.cargando.value || quitar.cargando.value"
                @click="hacer(p, a)"
              >
                {{ textoBoton(a) }}<span class="solo-lector"> «{{ p.enunciado }}»</span>
              </HudBoton>
              <HudBoton
                v-if="resultados && p.estado !== 'borrador' && resultados(p)"
                variante="fantasma"
                :a="resultados(p)!"
              >
                Escrutinio<span class="solo-lector"> de «{{ p.enunciado }}»</span>
              </HudBoton>
            </div>
          </template>
        </li>
      </ol>
      <EditorPregunta
        v-if="editando === 'nueva'"
        :entidad-id="entidadId"
        :puntos="puntos"
        :busca-personas="entidad.tienePermiso('personas.ver')"
        :cargando="guardar.cargando.value"
        :error="guardar.error.value"
        @guardar="alGuardar"
        @cancelar="editando = null"
      />
      <HudBoton
        v-else-if="puedeAgregar && editando === null"
        variante="secundario"
        @click="editando = 'nueva'"
      >
        <IMas aria-hidden="true" /> Agregar pregunta
      </HudBoton>
    </template>
    <ConfirmarConMotivo
      v-model:abierto="abiertoAnular"
      titulo="Anular la pregunta"
      accion="Anular la pregunta"
      descripcion="Los votos registrados no cuentan y la anulación queda en el acta."
      :cargando="cambiar.cargando.value"
      :error="cambiar.error.value"
      @confirmar="(m) => anulando && hacer(anulando, 'anular', m)"
    />
  </div>
</template>

<style scoped src="../vistas/asambleas.css"></style>
<style scoped>
.preguntas {
  display: grid;
  gap: 12px;
}

.ancho {
  flex: 1 1 100%;
}
</style>
