<script setup lang="ts">
/** Puntos de acceso (puertas, rampas): crear y activar o desactivar. */
import { onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { PuntoAcceso, SentidoAcceso, TipoPuntoAcceso } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { actualizarPuntoAcceso, crearPuntoAcceso, puntosAcceso } from '../api'
import { SENTIDO, TIPO_PUNTO } from '../reglas'

const props = defineProps<{ entidadId: string }>()
const emit = defineEmits<{ cambio: [puntos: PuntoAcceso[]] }>()

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<PuntoAcceso[]>([])
const nombre = ref('')
const tipo = ref<TipoPuntoAcceso>('peatonal')
const sentido = ref<SentidoAcceso>('ambos')
const errorNombre = ref<string | null>(null)

const crear = useAccion((clave) => crearPuntoAcceso(props.entidadId, { nombre: nombre.value.trim(), tipo: tipo.value, sentido: sentido.value, activo: true }, clave))
const alternar = useAccion((_c, p: PuntoAcceso) => actualizarPuntoAcceso(props.entidadId, p.id ?? '', { ...p, activo: p.activo === false }))

async function agregar() {
  errorNombre.value = nombre.value.trim() ? null : 'Escriba el nombre del punto.'
  if (errorNombre.value) return
  const r = await crear.ejecutar()
  if (!r.ok) return
  nombre.value = ''
  await cargar()
}

async function cambiar(p: PuntoAcceso) {
  if ((await alternar.ejecutar(p)).ok) await cargar()
}

async function cargar() {
  try {
    lista.value = await puntosAcceso(props.entidadId)
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
  <HudPanel etiqueta="Puntos de acceso">
    <div class="campos">
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
        aria-label="Puntos de acceso"
      >
        <li
          v-for="p in lista"
          :key="p.id ?? p.nombre"
        >
          <HudInsignia :tono="p.activo === false ? 'neutro' : 'exito'">
            {{ p.activo === false ? 'Inactivo' : 'Activo' }}
          </HudInsignia>
          <span class="crece">
            <strong>{{ p.nombre }}</strong>
            <small>{{ TIPO_PUNTO[p.tipo] }} · {{ SENTIDO[p.sentido] }}</small>
          </span>
          <HudBoton
            v-if="p.id"
            variante="fantasma"
            :cargando="alternar.cargando.value"
            @click="cambiar(p)"
          >
            {{ p.activo === false ? 'Activar' : 'Desactivar' }}<span class="solo-lector"> {{ p.nombre }}</span>
          </HudBoton>
        </li>
      </ul>
      <p
        v-else
        class="texto-2"
      >
        Aún no hay puntos de acceso.
      </p>
      <p
        v-if="alternar.error.value"
        class="error"
        role="alert"
      >
        {{ alternar.error.value }}
      </p>
      <form
        class="campos"
        novalidate
        @submit.prevent="agregar"
      >
        <HudCampo
          v-model="nombre"
          etiqueta="Nombre del punto nuevo"
          autocompletar="off"
          :error="errorNombre ?? crear.error.value"
        />
        <HudSelector
          v-model="tipo"
          etiqueta="Tipo de punto"
          :opciones="opcionesDe(TIPO_PUNTO)"
        />
        <HudSelector
          v-model="sentido"
          etiqueta="Sentido"
          :opciones="opcionesDe(SENTIDO)"
        />
        <div class="botones">
          <HudBoton
            tipo="submit"
            variante="secundario"
            :cargando="crear.cargando.value"
          >
            Agregar punto
          </HudBoton>
        </div>
      </form>
    </div>
  </HudPanel>
</template>

<style scoped src="../vistas/porteria.css"></style>
