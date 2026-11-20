<script setup lang="ts">
/**
 * Papeleta virtual de la asamblea (enlace personal del asistente, `X-Papeleta`): registrar el
 * ingreso en reuniones virtuales o mixtas, votar **una pregunta a la vez** por todos sus bienes
 * habilitados y ver la confirmación del voto. Se actualiza sola mientras la asamblea avanza.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { credencial, tomarCredencial } from '@/api/credencial-externa'
import { mensajeDeError } from '@/api/errores'
import { enlaceNoValido, ingresoPapeleta, papeleta, salidaPapeleta, votarPapeleta } from '@/api/publico'
import type { Papeleta, PreguntaPapeleta, Voto } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useRefresco } from '@/composables/useRefresco'
import { enlaceSeguro } from '@/formato/directorio'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import IVideo from '~icons/tabler/video'
import EnlaceNoValido from './EnlaceNoValido.vue'
import MarcoPublico from './MarcoPublico.vue'

const route = useRoute()
const id = String(route.params.copropiedadId ?? '')

const datos = ref<Papeleta | null>(null)
const estado = ref<'cargando' | 'listo' | 'error' | 'enlace'>('cargando')
const error = ref<string | null>(null)
const elegidas = ref<string[]>([])
const confirmado = ref<Voto | null>(null)
const aviso = ref<string | null>(null)
const saliendo = ref(false)

const reunion = computed(() => datos.value?.reunion ?? null)
const asistente = computed(() => datos.value?.asistente ?? null)
const pendientes = computed(() => (datos.value?.preguntas_abiertas ?? []).filter((p) => !p.ya_voto))
const votadas = computed(() => (datos.value?.preguntas_abiertas ?? []).filter((p) => p.ya_voto))
const actual = computed<PreguntaPapeleta | null>(() => pendientes.value[0] ?? null)
const multiple = computed(() => (actual.value?.pregunta.max_selecciones ?? 1) > 1)
const permiteIngreso = computed(() => reunion.value?.modalidad === 'virtual' || reunion.value?.modalidad === 'mixta')
const video = computed(() => enlaceSeguro(reunion.value?.enlace_video))
const total = computed(() => datos.value?.preguntas_abiertas.length ?? 0)
const numero = computed(() => votadas.value.length + 1)
const errorSeleccion = computed(() => {
  const max = actual.value?.pregunta.max_selecciones ?? 1
  return elegidas.value.length > max ? `Elija máximo ${max} opciones.` : null
})

const votar = useAccion((clave, preguntaId: string, opciones: string[]) => votarPapeleta(id, preguntaId, opciones, clave))
const ingreso = useAccion(() => ingresoPapeleta(id), {
  alExito: (a) => {
    if (datos.value) datos.value = { ...datos.value, asistente: a }
    void cargar(true)
  },
})
const salida = useAccion(() => salidaPapeleta(id), {
  alExito: (a) => {
    if (datos.value) datos.value = { ...datos.value, asistente: a }
    saliendo.value = false
    aviso.value = 'Salió de la asamblea. Sus votos se conservan.'
  },
})

async function cargar(silencioso = false) {
  if (!silencioso) estado.value = 'cargando'
  try {
    datos.value = await papeleta(id)
    estado.value = 'listo'
  } catch (e) {
    if (silencioso && !enlaceNoValido(e)) return
    estado.value = enlaceNoValido(e) ? 'enlace' : 'error'
    error.value = mensajeDeError(e)
  }
}

/** Marca una opción (en selección única reemplaza la anterior). */
function elegir(opcion: string) {
  if (!multiple.value) elegidas.value = [opcion]
  else elegidas.value = elegidas.value.includes(opcion) ? elegidas.value.filter((o) => o !== opcion) : [...elegidas.value, opcion]
}

async function enviarVoto() {
  const p = actual.value
  if (!p || elegidas.value.length === 0 || errorSeleccion.value) return
  aviso.value = null
  const r = await votar.ejecutar(p.pregunta.id, elegidas.value)
  if (r.ok) {
    confirmado.value = r.valor
    elegidas.value = []
  } else if (votar.codigo.value === 'ya_voto') {
    aviso.value = 'Su voto ya quedó registrado en esta pregunta.'
    elegidas.value = []
  } else if (votar.codigo.value === 'conflicto_estado') {
    aviso.value = 'La votación de esa pregunta ya cerró.'
    elegidas.value = []
  } else return
  await cargar(true)
}

function continuar() {
  confirmado.value = null
  votar.reiniciar()
}

const textoError = computed(() => {
  if (votar.codigo.value === 'no_inscrito') {
    return permiteIngreso.value ? 'Primero registre su ingreso a la asamblea.' : 'No figura presente: acérquese a la mesa de registro.'
  }
  if (votar.codigo.value === 'ya_voto' || votar.codigo.value === 'conflicto_estado') return null
  return votar.error.value
})

/** Toma el token del enlace y carga (también si se abre el enlace de otra persona en la misma pestaña). */
function abrirEnlace() {
  const antes = credencial('papeleta')
  const token = tomarCredencial('papeleta')
  if (!token) estado.value = 'enlace'
  else if (token !== antes || !datos.value) {
    confirmado.value = null
    elegidas.value = []
    void cargar()
  }
}

useRefresco(() => (estado.value === 'listo' ? cargar(true) : undefined), { cada: 8000 })
onMounted(() => {
  abrirEnlace()
  window.addEventListener('hashchange', abrirEnlace)
})
onBeforeUnmount(() => window.removeEventListener('hashchange', abrirEnlace))
</script>

<template>
  <MarcoPublico
    :titulo="reunion?.titulo ?? 'Papeleta de la asamblea'"
    :subtitulo="asistente ? `Papeleta de ${asistente.nombre}` : undefined"
  >
    <EnlaceNoValido
      v-if="estado === 'enlace'"
      quien="a la administración de su conjunto o en la mesa de registro"
    />
    <HudEstado
      v-else-if="estado === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="estado === 'error'"
      estado="error"
      :mensaje="error ?? undefined"
      @reintentar="cargar()"
    />
    <template v-else-if="reunion && asistente">
      <section
        class="bienes"
        aria-label="Sus bienes"
      >
        <p>Vota por:</p>
        <ul>
          <li
            v-for="b in asistente.bienes"
            :key="b.bien_privado_id"
          >
            <strong>{{ b.codigo }}</strong>
            <small>{{ b.calidad === 'apoderado' ? 'como apoderado' : 'propietario' }}</small>
            <HudInsignia
              v-if="b.moroso"
              tono="aviso"
            >
              En mora
            </HudInsignia>
          </li>
        </ul>
        <a
          v-if="video"
          :href="video"
          target="_blank"
          rel="noopener noreferrer"
          class="video"
        ><IVideo aria-hidden="true" /> Entrar a la videollamada<span class="solo-lector"> (se abre en otra pestaña)</span></a>
      </section>

      <p
        v-if="aviso"
        class="aviso"
        role="status"
      >
        {{ aviso }}
      </p>

      <HudPanel
        v-if="!asistente.presente"
        etiqueta="Ingreso"
        resaltado
      >
        <template v-if="permiteIngreso">
          <p>Registre su ingreso para contar en el quórum y poder votar.</p>
          <HudBoton
            bloque
            :cargando="ingreso.cargando.value"
            @click="ingreso.ejecutar()"
          >
            Registrar mi ingreso
          </HudBoton>
          <p
            v-if="ingreso.error.value"
            class="error"
            role="alert"
          >
            {{ ingreso.error.value }}
          </p>
        </template>
        <p v-else>
          Esta asamblea es presencial: acérquese a la mesa de registro para votar.
        </p>
      </HudPanel>

      <HudPanel
        v-else-if="confirmado"
        etiqueta="Voto registrado"
        resaltado
      >
        <p
          class="confirmacion"
          role="status"
        >
          Su voto quedó registrado por {{ confirmado.bienes.join(', ') }}.
        </p>
        <p
          v-if="confirmado.omitidos.length"
          class="nota"
        >
          No votaron esta vez: {{ confirmado.omitidos.join(', ') }} (ya habían votado o no están habilitados).
        </p>
        <HudBoton
          bloque
          @click="continuar"
        >
          {{ pendientes.length ? 'Siguiente pregunta' : 'Listo' }}
        </HudBoton>
      </HudPanel>

      <HudPanel
        v-else-if="actual"
        :etiqueta="`Pregunta ${numero} de ${total}`"
        resaltado
      >
        <form
          class="voto"
          novalidate
          @submit.prevent="enviarVoto"
        >
          <fieldset>
            <legend>{{ actual.pregunta.enunciado }}</legend>
            <p
              v-if="multiple"
              class="nota"
            >
              Elija hasta {{ actual.pregunta.max_selecciones }} opciones.
            </p>
            <p
              v-if="actual.pregunta.tipo_voto === 'reservado'"
              class="nota"
            >
              Voto secreto: nadie verá lo que usted elija.
            </p>
            <label
              v-for="o in actual.pregunta.opciones"
              :key="o.id"
              class="opcion"
              :class="{ elegida: elegidas.includes(o.id) }"
            >
              <input
                :type="multiple ? 'checkbox' : 'radio'"
                name="opcion"
                :value="o.id"
                :checked="elegidas.includes(o.id)"
                @change="elegir(o.id)"
              >
              {{ o.texto }}
            </label>
            <p
              v-if="errorSeleccion"
              class="error"
            >
              {{ errorSeleccion }}
            </p>
          </fieldset>
          <HudBoton
            tipo="submit"
            bloque
            :deshabilitado="elegidas.length === 0 || !!errorSeleccion || votar.segundosEspera.value > 0"
            :cargando="votar.cargando.value"
          >
            {{ votar.segundosEspera.value > 0 ? `Espere ${votar.segundosEspera.value} s` : 'Votar' }}
          </HudBoton>
          <p
            v-if="textoError"
            class="error"
            role="alert"
          >
            {{ textoError }}
          </p>
        </form>
      </HudPanel>

      <HudPanel
        v-else
        etiqueta="Votaciones"
      >
        <p role="status">
          {{ votadas.length ? 'Ya votó todas las preguntas abiertas.' : 'No hay votaciones abiertas.' }} Esta página se actualiza sola.
        </p>
      </HudPanel>

      <ul
        v-if="votadas.length"
        class="votadas"
        aria-label="Preguntas que ya votó"
      >
        <li
          v-for="v in votadas"
          :key="v.pregunta.id"
        >
          <HudInsignia tono="exito">
            Votó
          </HudInsignia> {{ v.pregunta.enunciado }}
        </li>
      </ul>

      <div v-if="asistente.presente && permiteIngreso">
        <HudBoton
          variante="fantasma"
          @click="saliendo = true"
        >
          Salir de la asamblea
        </HudBoton>
      </div>
      <HudDialogo
        v-model:abierto="saliendo"
        titulo="¿Salir de la asamblea?"
      >
        <p>Dejará de contar en el quórum. Los votos que ya dio se conservan.</p>
        <p
          v-if="salida.error.value"
          class="error"
          role="alert"
        >
          {{ salida.error.value }}
        </p>
        <template #acciones>
          <HudBoton
            variante="fantasma"
            @click="saliendo = false"
          >
            Seguir en la asamblea
          </HudBoton>
          <HudBoton
            :cargando="salida.cargando.value"
            @click="salida.ejecutar()"
          >
            Salir
          </HudBoton>
        </template>
      </HudDialogo>
    </template>
  </MarcoPublico>
</template>

<style scoped>
.bienes {
  display: grid;
  gap: 6px;
}

.bienes p {
  margin: 0;
  color: var(--texto-2);
}

.bienes ul,
.votadas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bienes li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

small,
.nota {
  color: var(--texto-3);
}

.video {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  color: var(--cian);
}

.voto {
  display: grid;
  gap: 14px;
}

fieldset {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 6px;
  font-size: 20px;
  font-weight: 600;
}

.opcion {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 10px 14px;
  border: 1px solid var(--linea-fuerte);
  font-size: 18px;
  cursor: pointer;
}

.opcion.elegida {
  border-color: var(--cian);
  background: var(--cian-tenue);
}

.opcion input {
  width: 22px;
  height: 22px;
  accent-color: var(--cian);
}

.confirmacion {
  font-size: 19px;
  font-weight: 600;
}

.votadas {
  flex-direction: column;
}

.aviso,
.error,
.nota,
.confirmacion {
  margin: 0 0 10px;
}

.aviso {
  padding: 10px 14px;
  border-left: 3px solid var(--ambar);
  background: color-mix(in srgb, var(--ambar) 10%, transparent);
}

.error {
  color: var(--magenta);
}
</style>
