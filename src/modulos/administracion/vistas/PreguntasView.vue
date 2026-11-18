<script setup lang="ts">
/** Preguntas frecuentes que responde el asistente de WhatsApp: crear, editar, ordenar y activar. */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { PreguntaFrecuente } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import { crearPregunta, editarPregunta, preguntasFrecuentes } from '../api'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const puedeEditar = computed(() => entidad.tienePermiso('preguntas_frecuentes.editar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<PreguntaFrecuente[]>([])
const resultado = ref<string | null>(null)

const editando = ref<PreguntaFrecuente | 'nueva' | null>(null)
const abierto = computed({ get: () => editando.value !== null, set: (si: boolean) => !si && (editando.value = null) })
const pregunta = ref('')
const respuesta = ref('')
const orden = ref('')
const activa = ref(true)
const errorForm = ref<string | null>(null)

const guardar = useAccion((clave) => {
  const datos = { pregunta: pregunta.value.trim(), respuesta: respuesta.value.trim(), orden: parseInt(orden.value, 10) || 1, activa: activa.value }
  const e = editando.value
  return e && e !== 'nueva' ? editarPregunta(id.value, e.id, datos) : crearPregunta(id.value, datos, clave)
})
const alternar = useAccion((_c, p: PreguntaFrecuente) =>
  editarPregunta(id.value, p.id, { pregunta: p.pregunta, respuesta: p.respuesta, orden: p.orden, activa: !p.activa }),
)

function abrir(p: PreguntaFrecuente | 'nueva') {
  const base = p === 'nueva' ? null : p
  pregunta.value = base?.pregunta ?? ''
  respuesta.value = base?.respuesta ?? ''
  orden.value = String(base?.orden ?? lista.value.length + 1)
  activa.value = base?.activa ?? true
  errorForm.value = null
  guardar.reiniciar()
  editando.value = p
}

async function enviar() {
  errorForm.value = !pregunta.value.trim() || !respuesta.value.trim() ? 'Escriba la pregunta y la respuesta.' : null
  if (errorForm.value) return
  if (!(await guardar.ejecutar()).ok) return
  editando.value = null
  resultado.value = 'Pregunta guardada: el asistente ya la usa.'
  await cargar()
}

async function cambiar(p: PreguntaFrecuente) {
  if ((await alternar.ejecutar(p)).ok) await cargar()
}

async function cargar() {
  try {
    lista.value = (await preguntasFrecuentes(id.value)).sort((a, b) => a.orden - b.orden)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-preguntas">
    <header class="encabezado">
      <h1 id="titulo-preguntas">
        Preguntas frecuentes
      </h1>
      <HudBoton
        v-if="puedeEditar"
        @click="abrir('nueva')"
      >
        <IMas aria-hidden="true" /> Nueva pregunta
      </HudBoton>
    </header>
    <p class="texto-2">
      El asistente de WhatsApp responde con estas preguntas antes de pasar la conversación a una persona.
    </p>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-if="alternar.error.value"
      class="error"
      role="alert"
    >
      {{ alternar.error.value }}
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
      mensaje="Aún no hay preguntas frecuentes."
    />
    <ol
      v-else
      class="lista"
      aria-label="Preguntas frecuentes"
    >
      <li
        v-for="p in lista"
        :key="p.id"
      >
        <span class="crece">
          <strong>{{ p.pregunta }}</strong>
          <small>{{ p.respuesta }}</small>
        </span>
        <HudInsignia :tono="p.activa ? 'exito' : 'neutro'">
          {{ p.activa ? 'Activa' : 'Inactiva' }}
        </HudInsignia>
        <div
          v-if="puedeEditar"
          class="botones"
        >
          <HudBoton
            variante="secundario"
            @click="abrir(p)"
          >
            Editar<span class="solo-lector"> {{ p.pregunta }}</span>
          </HudBoton>
          <HudBoton
            variante="fantasma"
            :cargando="alternar.cargando.value"
            @click="cambiar(p)"
          >
            {{ p.activa ? 'Desactivar' : 'Activar' }}<span class="solo-lector"> {{ p.pregunta }}</span>
          </HudBoton>
        </div>
      </li>
    </ol>

    <HudDialogo
      v-model:abierto="abierto"
      :titulo="editando === 'nueva' ? 'Nueva pregunta' : 'Editar pregunta'"
    >
      <form
        id="formulario-pregunta"
        class="campos"
        novalidate
        @submit.prevent="enviar"
      >
        <HudCampo
          v-model="pregunta"
          etiqueta="Pregunta"
          autocompletar="off"
        />
        <HudCampo
          v-model="respuesta"
          etiqueta="Respuesta"
          multilinea
        />
        <HudCampo
          v-model="orden"
          etiqueta="Orden"
          modo-entrada="numeric"
        />
        <label class="casilla">
          <input
            v-model="activa"
            type="checkbox"
          > Activa (el asistente la usa)
        </label>
        <p
          v-if="errorForm || guardar.error.value"
          class="error"
          role="alert"
        >
          {{ errorForm ?? guardar.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="editando = null"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-pregunta"
          :cargando="guardar.cargando.value"
        >
          Guardar
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="./administracion.css"></style>
