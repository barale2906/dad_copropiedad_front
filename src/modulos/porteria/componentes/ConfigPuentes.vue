<script setup lang="ts">
/**
 * Puentes (el equipo en sitio que conecta torniquetes, lectores y cámaras): registrar uno nuevo
 * o pedir un token nuevo —que se muestra **una sola vez**— y retirarlos.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Puente } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import SecretoUnaVez from '@/hud/componentes/SecretoUnaVez.vue'
import { nuevoTokenPuente, puentes, registrarPuente, retirarPuente } from '../api'

const props = defineProps<{ entidadId: string; zona: string }>()
const emit = defineEmits<{ cambio: [puentes: Puente[]] }>()

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<Puente[]>([])
const nombre = ref('')
const errorNombre = ref<string | null>(null)
const token = ref<{ puente: string; valor: string } | null>(null)
const activos = computed(() => lista.value.filter((p) => p.estado === 'activo'))
const retirados = computed(() => lista.value.filter((p) => p.estado === 'retirado'))

const registrar = useAccion((clave) => registrarPuente(props.entidadId, nombre.value.trim(), clave))
const renovar = useAccion((_c, p: Puente) => nuevoTokenPuente(props.entidadId, p.id))
const retirar = useAccion((_c, p: Puente) => retirarPuente(props.entidadId, p.id))

async function agregar() {
  errorNombre.value = nombre.value.trim() ? null : 'Escriba un nombre para el puente.'
  if (errorNombre.value) return
  const r = await registrar.ejecutar()
  if (!r.ok) return
  token.value = { puente: r.valor.puente.nombre, valor: r.valor.token }
  nombre.value = ''
  await cargar()
}

async function nuevoToken(p: Puente) {
  const r = await renovar.ejecutar(p)
  if (r.ok) token.value = { puente: p.nombre, valor: r.valor }
}

async function sacar(p: Puente) {
  if ((await retirar.ejecutar(p)).ok) await cargar()
}

async function cargar() {
  try {
    lista.value = await puentes(props.entidadId)
    emit('cambio', lista.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <HudPanel etiqueta="Puentes">
    <div class="campos">
      <SecretoUnaVez
        v-if="token"
        :valor="token.valor"
        :etiqueta="`Token de ${token.puente}`"
        aviso="Configúrelo en el puente ahora: no se volverá a mostrar. El token anterior deja de servir."
      />
      <p
        v-for="e in [renovar.error.value, retirar.error.value].filter(Boolean)"
        :key="e ?? ''"
        class="error"
        role="alert"
      >
        {{ e }}
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
      <ul
        v-else-if="lista.length"
        class="lista"
        aria-label="Puentes"
      >
        <li
          v-for="p in [...activos, ...retirados]"
          :key="p.id"
        >
          <HudInsignia :tono="p.estado === 'activo' ? 'exito' : 'neutro'">
            {{ p.estado === 'activo' ? 'Activo' : 'Retirado' }}
          </HudInsignia>
          <span class="crece">
            <strong>{{ p.nombre }}</strong>
            <small>
              {{ p.version ? `Versión ${p.version} · ` : '' }}{{ p.ultimo_latido_en ? `Último reporte ${fechaHora(p.ultimo_latido_en, zona)}` : 'Aún no se reporta' }}
            </small>
          </span>
          <div
            v-if="p.estado === 'activo'"
            class="botones"
          >
            <HudBoton
              variante="secundario"
              :cargando="renovar.cargando.value"
              @click="nuevoToken(p)"
            >
              Nuevo token<span class="solo-lector"> para {{ p.nombre }}</span>
            </HudBoton>
            <HudBoton
              variante="fantasma"
              :cargando="retirar.cargando.value"
              @click="sacar(p)"
            >
              Retirar<span class="solo-lector"> {{ p.nombre }}</span>
            </HudBoton>
          </div>
        </li>
      </ul>
      <p
        v-else
        class="texto-2"
      >
        Aún no hay puentes registrados.
      </p>
      <form
        class="campos"
        novalidate
        @submit.prevent="agregar"
      >
        <HudCampo
          v-model="nombre"
          etiqueta="Nombre del puente nuevo"
          autocompletar="off"
          :error="errorNombre ?? registrar.error.value"
        />
        <div class="botones">
          <HudBoton
            tipo="submit"
            variante="secundario"
            :cargando="registrar.cargando.value"
          >
            Registrar puente
          </HudBoton>
        </div>
      </form>
    </div>
  </HudPanel>
</template>

<style scoped src="../vistas/porteria.css"></style>
