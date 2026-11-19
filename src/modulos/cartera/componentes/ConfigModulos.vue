<script setup lang="ts">
/**
 * Módulos de contribución (conjuntos mixtos, art. 29): crear y activar o desactivar. Sus
 * coeficientes se cargan como un cuadro de coeficientes del módulo en Unidades.
 */
import { computed, ref } from 'vue'
import type { ModuloContribucion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import { useEntidad } from '@/stores/entidad'
import { crearModulo, guardarModulo } from '../api'

defineProps<{ modulos: ModuloContribucion[] }>()
const emit = defineEmits<{ cambio: [] }>()

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const nombre = ref('')
const descripcion = ref('')
const problema = ref<string | null>(null)

const crear = useAccion(() => crearModulo(id.value, { nombre: nombre.value.trim(), descripcion: descripcion.value.trim() || null }))
const alternar = useAccion((_c, m: ModuloContribucion) => guardarModulo(id.value, m.id, { nombre: m.nombre, descripcion: m.descripcion, activo: !m.activo }))

async function alCrear() {
  problema.value = nombre.value.trim() ? null : 'Escriba el nombre del módulo.'
  if (problema.value) return
  if (!(await crear.ejecutar()).ok) return
  nombre.value = descripcion.value = ''
  emit('cambio')
}

async function alAlternar(m: ModuloContribucion) {
  if ((await alternar.ejecutar(m)).ok) emit('cambio')
}
</script>

<template>
  <div class="campos">
    <p class="texto-2">
      Solo los conjuntos mixtos (vivienda y comercio, por ejemplo) necesitan módulos: cada uno reparte sus gastos con sus propios coeficientes.
    </p>
    <ul
      v-if="modulos.length"
      class="lista"
      aria-label="Módulos de contribución"
    >
      <li
        v-for="m in modulos"
        :key="m.id"
      >
        <span class="crece"><strong>{{ m.nombre }}</strong><small>{{ m.descripcion }}</small></span>
        <HudInsignia :tono="m.activo ? 'exito' : 'neutro'">
          {{ m.activo ? 'Activo' : 'Inactivo' }}
        </HudInsignia>
        <HudBoton
          variante="fantasma"
          @click="alAlternar(m)"
        >
          {{ m.activo ? 'Desactivar' : 'Activar' }}<span class="solo-lector"> {{ m.nombre }}</span>
        </HudBoton>
      </li>
    </ul>
    <form
      class="campos"
      novalidate
      aria-label="Módulo nuevo"
      @submit.prevent="alCrear"
    >
      <div class="filtros">
        <HudCampo
          v-model="nombre"
          etiqueta="Nombre del módulo"
        />
        <HudCampo
          v-model="descripcion"
          etiqueta="Descripción (opcional)"
        />
      </div>
      <p
        v-if="problema ?? crear.error.value ?? alternar.error.value"
        class="error"
        role="alert"
      >
        {{ problema ?? crear.error.value ?? alternar.error.value }}
      </p>
      <div class="botones">
        <HudBoton
          tipo="submit"
          :cargando="crear.cargando.value"
        >
          Crear módulo
        </HudBoton>
      </div>
    </form>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
