<script setup lang="ts">
/**
 * Voto presencial (tableta de la mesa). Dos maneras:
 * - **Por asistente**: se busca al asistente presente, se elige la opción y se registra.
 * - **Por rótulo**: se elige la opción y se pasan los rótulos Code 128 de quienes la votan,
 *   uno tras otro (lector físico o cámara).
 * El voto cuenta por **todos** los bienes habilitados del asistente. Cada lectura lleva su
 * propia `Idempotency-Key` (se reutiliza si se reintenta tras un corte). 409 `ya_voto` no es un
 * fallo: el voto ya quedó registrado.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { Asistente, CanalVoto, Voto } from '@/api/tipos'
import { uuid } from '@/api/uuid'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import LectorQr from '@/hud/componentes/LectorQr.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import { asistentes as pedirAsistentes, votar } from '../api'
import ElegirReunion from '../componentes/ElegirReunion.vue'
import { maximoSelecciones, problemaSeleccion, resumenBienes } from '../reglas'
import { TEXTO_CONEXION, useTableroEnVivo } from '../useTableroEnVivo'

interface Lectura {
  clave: string
  texto: string
  tono: 'exito' | 'aviso' | 'peligro'
}

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const reunionId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (accion: string, r = '') => ({ name: 'modulo', params: { ...route.params, accion, id: r }, query: {} })

const vivo = useTableroEnVivo(() => id.value, () => reunionId.value)
const abiertas = computed(() => vivo.tablero.value?.preguntas_abiertas.map((x) => x.pregunta) ?? [])
const preguntaId = ref('')
const pregunta = computed(() => abiertas.value.find((p) => p.id === preguntaId.value) ?? abiertas.value[0] ?? null)
const opcionesPregunta = computed(() => abiertas.value.map((p) => ({ valor: p.id, etiqueta: `${p.orden}. ${p.enunciado}` })))
const multiple = computed(() => !!pregunta.value && maximoSelecciones(pregunta.value) > 1)

const modo = ref<'asistente' | 'rotulo'>('asistente')
const elegidas = ref<string[]>([])
const problema = computed(() => (pregunta.value ? problemaSeleccion(pregunta.value, elegidas.value) : null))

// Asistentes presentes (modo por asistente)
const lista = ref<Asistente[]>([])
const errorLista = ref<string | null>(null)
const filtro = ref('')
const asistente = ref<Asistente | null>(null)
const presentes = computed(() => {
  const t = filtro.value.trim().toLowerCase()
  return lista.value
    .filter((a) => a.presente)
    .filter((a) => !t || a.nombre.toLowerCase().includes(t) || a.bienes.some((b) => b.codigo.toLowerCase().includes(t)) || a.rotulo?.toLowerCase() === t)
    .slice(0, 12)
})

/** Clave de la lectura en curso: cambia al elegir otro asistente u otro rótulo. */
let clave = uuid()
const lecturas = ref<Lectura[]>([])
const ultimo = computed(() => lecturas.value[0] ?? null)

const emitir = useAccion((_c, datos: { asistente_id?: string; rotulo?: string; canal: CanalVoto }) =>
  votar(id.value, reunionId.value, pregunta.value?.id ?? '', { ...datos, opciones: elegidas.value }, clave),
)

function anotar(texto: string, tono: Lectura['tono']) {
  lecturas.value = [{ clave, texto, tono }, ...lecturas.value].slice(0, 8)
}

function textoVoto(v: Voto) {
  if (!v.registrado) return `El voto de ${v.nombre} ya estaba registrado (reintento).`
  const omitidos = v.omitidos.length ? ` No votaron esta vez: ${v.omitidos.join(', ')}.` : ''
  return `Voto de ${v.nombre} registrado por ${v.bienes.join(', ')}.${omitidos}`
}

async function registrar(datos: { asistente_id?: string; rotulo?: string; canal: CanalVoto }, quien: string) {
  if (problema.value) return
  const r = await emitir.ejecutar(datos)
  if (r.ok) anotar(textoVoto(r.valor), 'exito')
  else if (emitir.codigo.value === 'ya_voto') anotar(`${quien}: su voto ya quedó registrado.`, 'aviso')
  else if (emitir.codigo.value === 'no_inscrito') anotar(`${quien}: no está presente o no representa bienes en la sala.`, 'peligro')
  else return
  clave = uuid()
  if (modo.value === 'asistente') {
    asistente.value = null
    elegidas.value = []
    filtro.value = ''
  }
}

function elegirAsistente(a: Asistente) {
  if (asistente.value?.id !== a.id) clave = uuid()
  asistente.value = a
}

function alternar(opcion: string) {
  if (!multiple.value) elegidas.value = [opcion]
  else elegidas.value = elegidas.value.includes(opcion) ? elegidas.value.filter((o) => o !== opcion) : [...elegidas.value, opcion]
}

function alLeerRotulo(texto: string) {
  const rotulo = texto.trim()
  if (!rotulo) return
  clave = uuid()
  void registrar({ rotulo, canal: 'rotulo' }, `Rótulo ${rotulo}`)
}

async function cargarAsistentes() {
  try {
    lista.value = await pedirAsistentes(id.value, reunionId.value)
    errorLista.value = null
  } catch (e) {
    errorLista.value = mensajeDeError(e)
  }
}

watch(() => pregunta.value?.id, () => {
  elegidas.value = []
  clave = uuid()
})
watch(reunionId, (r) => r && void cargarAsistentes(), { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-voto">
    <template v-if="reunionId">
      <RouterLink
        :to="ruta('en-vivo', reunionId)"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Conducir
      </RouterLink>
      <header class="encabezado">
        <h1 id="titulo-voto">
          Voto presencial
        </h1>
        <small>{{ TEXTO_CONEXION[vivo.conexion.value] }}</small>
      </header>
      <HudEstado
        v-if="vivo.estado.value === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="vivo.estado.value === 'error'"
        estado="error"
        :mensaje="vivo.error.value ?? undefined"
        @reintentar="vivo.recargar()"
      />
      <HudEstado
        v-else-if="!pregunta"
        estado="vacio"
        mensaje="No hay votaciones abiertas. Cuando quien conduce abra una pregunta, aparecerá aquí."
      />
      <template v-else>
        <HudSelector
          v-if="abiertas.length > 1"
          v-model="preguntaId"
          etiqueta="Pregunta abierta"
          :opciones="opcionesPregunta"
        />
        <HudPanel :etiqueta="`${pregunta.orden}. ${pregunta.enunciado}`">
          <fieldset class="opciones-voto">
            <legend>{{ multiple ? `Elija hasta ${maximoSelecciones(pregunta)} opciones` : 'Opción' }}</legend>
            <button
              v-for="o in pregunta.opciones"
              :key="o.id"
              type="button"
              class="opcion"
              :aria-pressed="elegidas.includes(o.id)"
              @click="alternar(o.id)"
            >
              {{ o.texto }}
            </button>
          </fieldset>
        </HudPanel>

        <div
          class="modos"
          role="group"
          aria-label="Cómo se registra"
        >
          <HudBoton
            :variante="modo === 'asistente' ? 'primario' : 'fantasma'"
            :aria-pressed="modo === 'asistente'"
            @click="modo = 'asistente'"
          >
            Por asistente
          </HudBoton>
          <HudBoton
            :variante="modo === 'rotulo' ? 'primario' : 'fantasma'"
            :aria-pressed="modo === 'rotulo'"
            @click="modo = 'rotulo'"
          >
            Por rótulo
          </HudBoton>
        </div>

        <HudPanel
          v-if="modo === 'asistente'"
          etiqueta="Asistente"
        >
          <HudCampo
            v-model="filtro"
            etiqueta="Buscar asistente"
            ayuda="Nombre, código del bien o rótulo."
          />
          <p
            v-if="errorLista"
            class="error"
            role="alert"
          >
            {{ errorLista }}
          </p>
          <ul
            class="lista"
            aria-label="Asistentes presentes"
          >
            <li
              v-for="a in presentes"
              :key="a.id"
              :class="{ urgente: asistente?.id === a.id }"
            >
              <span class="crece">
                <strong>{{ a.nombre }}</strong>
                <small>{{ resumenBienes(a) }}</small>
              </span>
              <HudBoton
                :variante="asistente?.id === a.id ? 'primario' : 'secundario'"
                :aria-pressed="asistente?.id === a.id"
                @click="elegirAsistente(a)"
              >
                Elegir<span class="solo-lector"> a {{ a.nombre }}</span>
              </HudBoton>
            </li>
          </ul>
          <p
            v-if="problema && asistente"
            class="texto-2"
          >
            {{ problema }}
          </p>
          <HudBoton
            bloque
            :deshabilitado="!asistente || !!problema"
            :cargando="emitir.cargando.value"
            @click="asistente && registrar({ asistente_id: asistente.id, canal: 'presencial' }, asistente.nombre)"
          >
            {{ asistente ? `Registrar el voto de ${asistente.nombre}` : 'Elija un asistente' }}
          </HudBoton>
        </HudPanel>

        <HudPanel
          v-else
          etiqueta="Rótulos"
        >
          <p
            v-if="problema"
            class="aviso"
          >
            {{ problema }} Luego pase los rótulos de quienes votan esa opción.
          </p>
          <LectorQr
            v-else
            etiqueta="Rótulo del asistente"
            :formatos="['code_128']"
            :cargando="emitir.cargando.value"
            ayuda="Pase cada rótulo por el lector (termina solo) o escríbalo y presione Enter."
            @leido="alLeerRotulo"
          />
        </HudPanel>

        <p
          v-if="emitir.error.value && !['ya_voto', 'no_inscrito'].includes(emitir.codigo.value ?? '')"
          class="error"
          role="alert"
        >
          {{ emitir.error.value }}
        </p>
        <p
          v-if="ultimo"
          :class="ultimo.tono === 'exito' ? 'ok' : 'aviso'"
          role="status"
        >
          {{ ultimo.texto }}
        </p>
        <HudPanel
          v-if="lecturas.length > 1"
          etiqueta="Lecturas anteriores"
        >
          <ul
            class="lista"
            aria-label="Lecturas anteriores"
          >
            <li
              v-for="l in lecturas.slice(1)"
              :key="l.clave"
            >
              <HudInsignia :tono="l.tono">
                {{ l.tono === 'exito' ? 'Registrado' : l.tono === 'aviso' ? 'Ya votó' : 'Rechazado' }}
              </HudInsignia>
              <span class="crece">{{ l.texto }}</span>
            </li>
          </ul>
        </HudPanel>
      </template>
    </template>

    <template v-else>
      <h1 id="titulo-voto">
        Voto presencial
      </h1>
      <ElegirReunion
        accion="voto-presencial"
        :estados="['instalada', 'suspendida']"
        etiqueta="Asambleas instaladas"
        vacio="No hay asambleas instaladas."
      />
    </template>
  </section>
</template>

<style scoped src="./asambleas.css"></style>
<style scoped>
.opciones-voto {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 160px), 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
}

.opciones-voto legend {
  margin-bottom: 8px;
  color: var(--texto-2);
}

.opcion {
  min-height: 64px;
  padding: 12px;
  border: 2px solid var(--linea-fuerte);
  background: var(--superficie);
  color: var(--texto);
  font: inherit;
  font-size: 20px;
  font-weight: 600;
  cursor: pointer;
}

.opcion[aria-pressed='true'] {
  border-color: var(--cian);
  background: var(--cian-tenue);
  box-shadow: var(--brillo);
}

.opcion:focus-visible {
  outline: 2px solid var(--cian);
  outline-offset: 2px;
}

.modos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
