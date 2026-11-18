<script setup lang="ts">
/**
 * Chat de WhatsApp: conversaciones que el bot escaló a una persona. Se responde **solo dentro
 * de las 24 h** desde el último mensaje del residente (se muestra cuánto queda; fuera de la
 * ventana, el backend responde 409) y se cierra al terminar. Refresca cada 30 s.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { Conversacion, DetalleConversacion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { useRefresco } from '@/composables/useRefresco'
import { fechaHora } from '@/formato/fechas'
import { ventanaRestante } from '@/formato/vencimiento'
import HiloMensajes, { type MensajeHilo } from '@/hud/componentes/HiloMensajes.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import { cerrarConversacion, conversaciones, detalleConversacion, responderConversacion } from '../api'

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const conversacionId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (c = '') => ({ name: 'modulo', params: { ...route.params, id: c } })
const ahora = ref(new Date())

// Bandeja
const filtroEstado = ref<Conversacion['estado'] | ''>('abierta')
const filtros = computed(() => ({ estado: filtroEstado.value || undefined }))
const listado = useListado((despues, f: { estado?: Conversacion['estado'] }) => conversaciones(id.value, despues, f), { filtros, retardo: 0 })

// Detalle
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const detalle = ref<DetalleConversacion | null>(null)
const texto = ref('')
const resultado = ref<string | null>(null)
const ventana = computed(() => (detalle.value ? ventanaRestante(detalle.value.conversacion.ultimo_entrante_en, ahora.value) : null))
const abierta = computed(() => detalle.value?.conversacion.estado === 'abierta')
const hilo = computed<MensajeHilo[]>(() =>
  (detalle.value?.mensajes ?? []).map((m, i) => ({
    id: String(i),
    texto: m.texto,
    autor: m.entrante ? 'Residente' : m.autor_cuenta_id ? 'Administración' : 'Asistente automático',
    hora: fechaHora(m.creado_en, zona.value),
    propio: !m.entrante,
  })),
)

const responder = useAccion(() => responderConversacion(id.value, conversacionId.value, texto.value.trim()), { alConflicto: () => cargar() })
const cerrar = useAccion(() => cerrarConversacion(id.value, conversacionId.value))

async function enviar() {
  if (!texto.value.trim()) return
  const r = await responder.ejecutar()
  if (!r.ok) {
    await cargar()
    return
  }
  texto.value = ''
  resultado.value = 'Mensaje enviado por WhatsApp.'
  await cargar()
}

async function terminar() {
  if (!(await cerrar.ejecutar()).ok) return
  resultado.value = 'Conversación cerrada.'
  await Promise.all([cargar(), listado.recargar()])
}

async function cargar() {
  if (!conversacionId.value) return
  try {
    detalle.value = await detalleConversacion(id.value, conversacionId.value)
    ahora.value = new Date()
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    if (estado.value !== 'listo') estado.value = 'error'
  }
}

useRefresco(() => (conversacionId.value ? cargar() : listado.recargar()), { cada: 30_000 })
watch(
  conversacionId,
  () => {
    estado.value = 'cargando'
    resultado.value = null
    texto.value = ''
    void cargar()
  },
  { immediate: true },
)
</script>

<template>
  <section aria-labelledby="titulo-chat">
    <template v-if="conversacionId">
      <RouterLink
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Conversaciones
      </RouterLink>
      <HudEstado
        v-if="estado === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="estado === 'error' || !detalle"
        estado="error"
        :mensaje="error ?? undefined"
        @reintentar="cargar"
      />
      <template v-else>
        <header class="encabezado">
          <h1 id="titulo-chat">
            {{ detalle.conversacion.telefono }}
          </h1>
          <HudInsignia
            v-if="ventana"
            :tono="abierta ? ventana.tono : 'neutro'"
          >
            {{ abierta ? ventana.texto : 'Conversación cerrada' }}
          </HudInsignia>
        </header>
        <p
          v-if="resultado"
          class="ok"
          role="status"
        >
          {{ resultado }}
        </p>
        <HudPanel etiqueta="Conversación">
          <div class="campos">
            <HiloMensajes
              :mensajes="hilo"
              etiqueta="Mensajes de la conversación"
            />
            <p
              v-if="abierta && ventana && !ventana.abierta"
              class="aviso"
            >
              {{ ventana.texto }} Si el residente escribe de nuevo, la ventana se abre otra vez.
            </p>
            <form
              v-else-if="abierta"
              class="campos"
              @submit.prevent="enviar"
            >
              <HudCampo
                v-model="texto"
                etiqueta="Responder por WhatsApp"
                multilinea
                :ayuda="ventana?.texto"
              />
              <p
                v-if="responder.error.value"
                class="error"
                role="alert"
              >
                {{ responder.error.value }}
              </p>
              <div class="botones">
                <HudBoton
                  tipo="submit"
                  :cargando="responder.cargando.value"
                  :deshabilitado="!texto.trim()"
                >
                  Enviar
                </HudBoton>
              </div>
            </form>
            <div
              v-if="abierta"
              class="botones"
            >
              <HudBoton
                variante="fantasma"
                :cargando="cerrar.cargando.value"
                @click="terminar"
              >
                Cerrar la conversación
              </HudBoton>
            </div>
            <p
              v-if="cerrar.error.value"
              class="error"
              role="alert"
            >
              {{ cerrar.error.value }}
            </p>
          </div>
        </HudPanel>
      </template>
    </template>

    <template v-else>
      <header class="encabezado">
        <h1 id="titulo-chat">
          Chat de WhatsApp
        </h1>
        <HudSelector
          v-model="filtroEstado"
          etiqueta="Estado"
          vacio="Todas"
          :opciones="[{ valor: 'abierta', etiqueta: 'Abiertas' }, { valor: 'cerrada', etiqueta: 'Cerradas' }]"
        />
      </header>
      <HudEstado
        v-if="listado.estado.value === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="listado.estado.value === 'error'"
        estado="error"
        :mensaje="listado.error.value ?? undefined"
        @reintentar="listado.recargar()"
      />
      <HudEstado
        v-else-if="listado.estado.value === 'vacio'"
        estado="vacio"
        mensaje="No hay conversaciones esperando a una persona."
      />
      <template v-else>
        <ul
          class="lista"
          aria-label="Conversaciones"
        >
          <li
            v-for="c in listado.filas.value"
            :key="c.id"
          >
            <HudInsignia :tono="c.estado === 'cerrada' ? 'neutro' : c.ventana_abierta ? 'exito' : 'aviso'">
              {{ c.estado === 'cerrada' ? 'Cerrada' : c.ventana_abierta ? 'Puede responder' : 'Fuera de las 24 h' }}
            </HudInsignia>
            <span class="crece">
              <RouterLink
                :to="ruta(c.id)"
                class="fila"
              ><strong>{{ c.telefono }}</strong></RouterLink>
              <small>Último mensaje {{ fechaHora(c.ultimo_entrante_en, zona) }}</small>
            </span>
          </li>
        </ul>
        <HudCargarMas
          :hay-mas="listado.hayMas.value"
          :cargando="listado.cargando.value"
          @cargar="listado.cargarMas()"
        />
      </template>
    </template>
  </section>
</template>

<style scoped src="./administracion.css"></style>
