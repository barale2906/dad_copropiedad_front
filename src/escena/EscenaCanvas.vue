<script setup lang="ts">
/**
 * Lienzo 3D. Se importa siempre con `defineAsyncComponent`, así three.js queda en un chunk
 * aparte que solo se descarga cuando hay maqueta que mostrar.
 */
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { movimientoReducido, type PerfilCalidad } from './calidad'
import { type EstadoZona, type EtiquetaPos, type Holgura, Motor } from './motor'
import { conjunto } from './plantillas/conjunto'
import { oficina, plataforma } from './plantillas/oficina'
import type { IdPlantilla } from './plantillas/zonas'

const PLANTILLAS = { conjunto, oficina, plataforma }

const props = withDefaults(
  defineProps<{
    plantilla: IdPlantilla
    perfil: PerfilCalidad
    modo?: 'maqueta' | 'holograma'
    estados?: Record<string, EstadoZona>
    enfocada?: string | null
    holgura?: Holgura
    pausada?: boolean
  }>(),
  { modo: 'maqueta', estados: () => ({}), enfocada: null, holgura: () => ({ derecha: 0, abajo: 0 }), pausada: false },
)

const emit = defineEmits<{
  pasar: [id: string | null]
  elegir: [id: string | null]
  etiquetas: [pos: EtiquetaPos[]]
  fallo: []
  lista: []
}>()

const lienzo = useTemplateRef<HTMLCanvasElement>('lienzo')
const motor = shallowRef<Motor | null>(null)

onMounted(() => {
  try {
    motor.value = new Motor({
      canvas: lienzo.value!,
      plantilla: PLANTILLAS[props.plantilla],
      perfil: props.perfil,
      reducido: movimientoReducido(),
      modo: props.modo,
      alPasar: (id) => emit('pasar', id),
      alElegir: (id) => emit('elegir', id),
      alDibujar: (p) => emit('etiquetas', p),
      alFallar: () => emit('fallo'),
    })
    motor.value.estados(props.estados)
    if (props.enfocada) motor.value.enfocar(props.enfocada, props.holgura)
    emit('lista')
  } catch (e) {
    console.error('No se pudo iniciar la escena 3D', e)
    emit('fallo')
  }
})

onBeforeUnmount(() => motor.value?.destruir())

watch(
  () => props.estados,
  (e) => motor.value?.estados(e),
  { deep: true },
)
watch(
  () => [props.enfocada, props.holgura.derecha, props.holgura.abajo] as const,
  ([id]) => motor.value?.enfocar(id, props.holgura),
)
watch(
  () => props.pausada,
  (p) => motor.value?.pausar(p),
)
</script>

<template>
  <div class="escena">
    <canvas
      ref="lienzo"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.escena {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  outline: none;
}
</style>
