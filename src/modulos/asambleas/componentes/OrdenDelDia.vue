<script setup lang="ts">
/** Orden del día: agregar, editar, reordenar y quitar puntos mientras la reunión está en preparación. */
import { ref } from 'vue'
import type { PuntoOrdenDia } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import IAbajo from '~icons/tabler/arrow-down'
import IArriba from '~icons/tabler/arrow-up'
import IQuitar from '~icons/tabler/trash'
import { borrarPunto, crearPunto, editarPunto } from '../api'
import { ESTADO_PUNTO } from '../reglas'

const props = defineProps<{ entidadId: string; reunionId: string; puntos: PuntoOrdenDia[]; editable: boolean }>()
const emit = defineEmits<{ cambio: [] }>()

const titulo = ref('')
const descripcion = ref('')
const editando = ref<string | null>(null)
const tituloEdicion = ref('')

const agregar = useAccion(() => crearPunto(props.entidadId, props.reunionId, props.puntos.length + 1, titulo.value.trim(), descripcion.value.trim() || null))
const guardar = useAccion((_c, p: PuntoOrdenDia) => editarPunto(props.entidadId, props.reunionId, p))
const quitar = useAccion((_c, p: PuntoOrdenDia) => borrarPunto(props.entidadId, props.reunionId, p.id))

async function nuevo() {
  if (!titulo.value.trim()) return
  if (!(await agregar.ejecutar()).ok) return
  titulo.value = descripcion.value = ''
  emit('cambio')
}

/** Intercambia el orden de dos puntos vecinos (dos PUT, uno por punto). */
async function mover(i: number, paso: -1 | 1) {
  const a = props.puntos[i]
  const b = props.puntos[i + paso]
  if (!a || !b) return
  if (!(await guardar.ejecutar({ ...a, orden: b.orden })).ok) return
  await guardar.ejecutar({ ...b, orden: a.orden })
  emit('cambio')
}

function editar(p: PuntoOrdenDia) {
  editando.value = p.id
  tituloEdicion.value = p.titulo
}

async function confirmarEdicion(p: PuntoOrdenDia) {
  if (!tituloEdicion.value.trim()) return
  if (!(await guardar.ejecutar({ ...p, titulo: tituloEdicion.value.trim() })).ok) return
  editando.value = null
  emit('cambio')
}

async function borrar(p: PuntoOrdenDia) {
  if ((await quitar.ejecutar(p)).ok) emit('cambio')
}
</script>

<template>
  <div class="campos">
    <p
      v-if="puntos.length === 0"
      class="texto-2"
    >
      Aún no hay puntos. Para convocar se necesita al menos uno.
    </p>
    <ol
      v-else
      class="lista"
      aria-label="Orden del día"
    >
      <li
        v-for="(p, i) in puntos"
        :key="p.id"
      >
        <span class="numero">{{ i + 1 }}.</span>
        <span class="crece">
          <form
            v-if="editando === p.id"
            class="fila-edicion"
            @submit.prevent="confirmarEdicion(p)"
          >
            <HudCampo
              v-model="tituloEdicion"
              :etiqueta="`Título del punto ${i + 1}`"
              autocompletar="off"
            />
            <HudBoton
              tipo="submit"
              variante="secundario"
              :cargando="guardar.cargando.value"
            >Guardar</HudBoton>
          </form>
          <template v-else>
            <strong>{{ p.titulo }}</strong>
            <small v-if="p.descripcion">{{ p.descripcion }}</small>
          </template>
        </span>
        <HudInsignia
          v-if="!editable"
          :tono="ESTADO_PUNTO[p.estado].tono"
        >
          {{ ESTADO_PUNTO[p.estado].texto }}
        </HudInsignia>
        <div
          v-if="editable && editando !== p.id"
          class="botones"
        >
          <HudBoton
            variante="fantasma"
            :deshabilitado="i === 0"
            @click="mover(i, -1)"
          >
            <IArriba aria-hidden="true" /><span class="solo-lector">Subir «{{ p.titulo }}»</span>
          </HudBoton>
          <HudBoton
            variante="fantasma"
            :deshabilitado="i === puntos.length - 1"
            @click="mover(i, 1)"
          >
            <IAbajo aria-hidden="true" /><span class="solo-lector">Bajar «{{ p.titulo }}»</span>
          </HudBoton>
          <HudBoton
            variante="fantasma"
            @click="editar(p)"
          >
            Editar<span class="solo-lector"> «{{ p.titulo }}»</span>
          </HudBoton>
          <HudBoton
            variante="fantasma"
            :cargando="quitar.cargando.value"
            @click="borrar(p)"
          >
            <IQuitar aria-hidden="true" /><span class="solo-lector">Quitar «{{ p.titulo }}»</span>
          </HudBoton>
        </div>
      </li>
    </ol>
    <p
      v-for="e in [agregar.error.value, guardar.error.value, quitar.error.value].filter(Boolean)"
      :key="e ?? ''"
      class="error"
      role="alert"
    >
      {{ e }}
    </p>
    <form
      v-if="editable"
      class="campos"
      @submit.prevent="nuevo"
    >
      <HudCampo
        v-model="titulo"
        etiqueta="Punto nuevo"
        autocompletar="off"
        ayuda="Ejemplo: Verificación del quórum, Aprobación del presupuesto 2027."
      />
      <HudCampo
        v-model="descripcion"
        etiqueta="Descripción (opcional)"
        autocompletar="off"
      />
      <div class="botones">
        <HudBoton
          tipo="submit"
          variante="secundario"
          :cargando="agregar.cargando.value"
          :deshabilitado="!titulo.trim()"
        >
          Agregar punto
        </HudBoton>
      </div>
    </form>
  </div>
</template>

<style scoped src="../vistas/asambleas.css"></style>
<style scoped>
.numero {
  min-width: 24px;
  color: var(--texto-3);
}

.fila-edicion {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}
</style>
