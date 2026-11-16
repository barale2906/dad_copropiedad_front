<script setup lang="ts">
/**
 * Fin de un listado por cursor: botón «Cargar más» y, con `infinito`, carga sola al acercarse
 * al final (el botón sigue disponible para teclado y lectores de pantalla).
 */
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import HudBoton from './HudBoton.vue'

const props = withDefaults(defineProps<{ hayMas: boolean; cargando?: boolean; infinito?: boolean }>(), {
  cargando: false,
  infinito: false,
})
const emit = defineEmits<{ cargar: [] }>()

const centinela = useTemplateRef<HTMLElement>('centinela')
let observador: IntersectionObserver | null = null

function observar() {
  observador?.disconnect()
  if (!props.infinito || !centinela.value || typeof IntersectionObserver === 'undefined') return
  observador = new IntersectionObserver(
    (entradas) => {
      if (entradas.some((e) => e.isIntersecting) && props.hayMas && !props.cargando) emit('cargar')
    },
    { rootMargin: '200px' },
  )
  observador.observe(centinela.value)
}

onMounted(observar)
watch(() => [props.infinito, props.hayMas], observar, { flush: 'post' })
onBeforeUnmount(() => observador?.disconnect())
</script>

<template>
  <div
    v-if="hayMas"
    ref="centinela"
    class="hud-cargar-mas"
  >
    <HudBoton
      variante="secundario"
      :cargando="cargando"
      @click="emit('cargar')"
    >
      Cargar más
    </HudBoton>
  </div>
</template>

<style scoped>
.hud-cargar-mas {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}
</style>
