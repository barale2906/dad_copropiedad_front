<script setup lang="ts">
/**
 * Marco de un catálogo normativo versionado: título, filtro por año de vigencia, la tabla (slot)
 * y el formulario «Nueva versión» (slot `formulario`), que se abre bajo demanda. Las versiones no
 * se editan: una nueva rige desde su fecha y cierra la anterior.
 */
import { computed, ref } from 'vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import IMas from '~icons/tabler/plus'

const props = withDefaults(
  defineProps<{
    titulo: string
    descripcion?: string
    /** Años con versiones (para el filtro); vacío = sin filtro. */
    anios?: number[]
    /** Texto del botón y del panel del formulario. */
    accion?: string
  }>(),
  { descripcion: undefined, anios: () => [], accion: 'Nueva versión' },
)
const anio = defineModel<string>('anio', { default: '' })
defineSlots<{ default: () => unknown; formulario?: (p: { cerrar: () => void }) => unknown }>()

const abierto = ref(false)
const opciones = computed(() => [
  { valor: '', etiqueta: 'Todos los años' },
  ...[...new Set(props.anios)].sort((a, b) => b - a).map((a) => ({ valor: String(a), etiqueta: String(a) })),
])
const cerrar = () => (abierto.value = false)
</script>

<template>
  <section
    class="editor"
    :aria-label="titulo"
  >
    <header class="encabezado">
      <div>
        <h2>{{ titulo }}</h2>
        <p
          v-if="descripcion"
          class="texto-2"
        >
          {{ descripcion }}
        </p>
      </div>
      <div class="botones">
        <HudSelector
          v-if="anios.length > 1"
          v-model="anio"
          etiqueta="Año"
          :opciones="opciones"
        />
        <HudBoton
          v-if="$slots.formulario"
          variante="secundario"
          :aria-expanded="abierto"
          @click="abierto = !abierto"
        >
          <IMas aria-hidden="true" /> {{ accion }}
        </HudBoton>
      </div>
    </header>
    <HudPanel
      v-if="abierto && $slots.formulario"
      :etiqueta="accion"
    >
      <slot
        name="formulario"
        :cerrar="cerrar"
      />
    </HudPanel>
    <slot />
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
.botones {
  align-items: flex-end;
}
</style>
