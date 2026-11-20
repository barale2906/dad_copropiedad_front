<script setup lang="ts">
/**
 * Cola de moderación genérica: cada elemento con su título, detalles y una insignia; aprobar (o
 * mantener) de una vez, y rechazar (u ocultar, o retirar) pidiendo el motivo. Solo presenta y
 * emite: la vista llama a la API y muestra el 409 de los cuatro ojos.
 */
import { ref } from 'vue'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import type { Tono } from '../reglas'

export interface ElementoModeracion {
  id: string
  titulo: string
  detalles: string[]
  /** Texto largo a revisar (la pieza, la reseña). */
  texto?: string | null
  insignias?: { texto: string; tono: Tono }[]
}

const props = withDefaults(
  defineProps<{
    elementos: ElementoModeracion[]
    textoAprobar?: string
    textoRechazar?: string
    /** Lo que se le explica a quien rechaza. */
    descripcionRechazo?: string
    /** Elemento que se está procesando. */
    procesando?: string | null
    error?: string | null
  }>(),
  { textoAprobar: 'Aprobar', textoRechazar: 'Rechazar', descripcionRechazo: 'Escriba el motivo.', procesando: null, error: null },
)
const emit = defineEmits<{ aprobar: [id: string]; rechazar: [id: string, motivo: string] }>()

const rechazando = ref<ElementoModeracion | null>(null)
const abierto = ref(false)

function pedirRechazo(e: ElementoModeracion) {
  rechazando.value = e
  abierto.value = true
}

function confirmar(motivo: string) {
  if (rechazando.value) emit('rechazar', rechazando.value.id, motivo)
}

/** La vista cierra el diálogo cuando el rechazo se guardó. */
function cerrar() {
  abierto.value = false
}

defineExpose({ cerrar })
</script>

<template>
  <ul class="cola">
    <li
      v-for="e in elementos"
      :key="e.id"
    >
      <header>
        <strong>{{ e.titulo }}</strong>
        <span class="insignias">
          <HudInsignia
            v-for="i in e.insignias ?? []"
            :key="i.texto"
            :tono="i.tono"
          >{{ i.texto }}</HudInsignia>
        </span>
      </header>
      <p
        v-if="e.texto"
        class="texto"
      >
        {{ e.texto }}
      </p>
      <ul class="detalles">
        <li
          v-for="d in e.detalles"
          :key="d"
        >
          {{ d }}
        </li>
      </ul>
      <div class="botones">
        <HudBoton
          :cargando="procesando === e.id && !abierto"
          @click="emit('aprobar', e.id)"
        >
          {{ textoAprobar }}<span class="solo-lector"> {{ e.titulo }}</span>
        </HudBoton>
        <HudBoton
          variante="secundario"
          @click="pedirRechazo(e)"
        >
          {{ textoRechazar }}<span class="solo-lector"> {{ e.titulo }}</span>
        </HudBoton>
      </div>
    </li>
  </ul>
  <p
    v-if="error && !abierto"
    class="error"
    role="alert"
  >
    {{ error }}
  </p>
  <ConfirmarConMotivo
    v-model:abierto="abierto"
    :titulo="`${textoRechazar}: ${rechazando?.titulo ?? ''}`"
    :accion="textoRechazar"
    :descripcion="props.descripcionRechazo"
    :cargando="procesando !== null"
    :error="error"
    @confirmar="confirmar"
  />
</template>

<style scoped>
.cola {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cola > li {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--linea);
  background: var(--superficie);
}

header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
}

.insignias {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.texto {
  margin: 0;
  padding: 8px 12px;
  border-left: 3px solid var(--linea-fuerte);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.detalles {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--texto-3);
  font-size: 14px;
}

.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.error {
  margin: 0;
  color: var(--magenta);
}
</style>
