<script setup lang="ts">
/**
 * Firma con el dedo o el mouse sobre un lienzo. `v-model` = PNG en Base64 (sin el prefijo
 * `data:`), o `''` si está vacía. «Borrar» la limpia. Funciona con puntero, táctil y lápiz.
 */
import { onMounted, ref, useId, useTemplateRef } from 'vue'
import HudBoton from './HudBoton.vue'

withDefaults(defineProps<{ etiqueta?: string }>(), { etiqueta: 'Firma de quien recibe' })
const firma = defineModel<string>({ required: true })

const id = useId()
const lienzo = useTemplateRef<HTMLCanvasElement>('lienzo')
const dibujando = ref(false)
let ultimo: { x: number; y: number } | null = null

function contexto(): CanvasRenderingContext2D | null {
  return lienzo.value?.getContext('2d') ?? null
}

function punto(e: PointerEvent) {
  const r = lienzo.value?.getBoundingClientRect()
  const c = lienzo.value
  if (!r || !c) return { x: 0, y: 0 }
  return { x: ((e.clientX - r.left) * c.width) / (r.width || 1), y: ((e.clientY - r.top) * c.height) / (r.height || 1) }
}

function empezar(e: PointerEvent) {
  dibujando.value = true
  ultimo = punto(e)
  lienzo.value?.setPointerCapture?.(e.pointerId)
}

function mover(e: PointerEvent) {
  const ctx = contexto()
  if (!dibujando.value || !ctx || !ultimo) return
  const p = punto(e)
  ctx.beginPath()
  ctx.moveTo(ultimo.x, ultimo.y)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
  ultimo = p
}

function terminar() {
  if (!dibujando.value) return
  dibujando.value = false
  ultimo = null
  const datos = lienzo.value?.toDataURL('image/png') ?? ''
  firma.value = datos.replace(/^data:image\/png;base64,/, '')
}

function borrar() {
  const c = lienzo.value
  const ctx = contexto()
  if (c && ctx) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
  }
  firma.value = ''
}

onMounted(() => {
  const ctx = contexto()
  if (!ctx) return
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#0a1020'
  borrar()
})
</script>

<template>
  <div class="captura-firma">
    <span
      :id="id"
      class="rotulo"
    >{{ etiqueta }}</span>
    <canvas
      ref="lienzo"
      width="600"
      height="220"
      role="img"
      :aria-labelledby="id"
      :aria-describedby="`${id}-ayuda`"
      @pointerdown.prevent="empezar"
      @pointermove.prevent="mover"
      @pointerup="terminar"
      @pointerleave="terminar"
      @pointercancel="terminar"
    />
    <p
      :id="`${id}-ayuda`"
      class="ayuda"
    >
      {{ firma ? 'Firma lista.' : 'Firme con el dedo dentro del recuadro.' }} Si no puede firmar, tome una foto.
    </p>
    <HudBoton
      variante="fantasma"
      :deshabilitado="!firma"
      @click="borrar"
    >
      Borrar la firma
    </HudBoton>
  </div>
</template>

<style scoped>
.captura-firma {
  display: grid;
  gap: 6px;
  justify-items: start;
}

canvas {
  width: 100%;
  max-width: 600px;
  aspect-ratio: 600 / 220;
  border: 1px solid var(--linea-fuerte);
  background: #fff;
  touch-action: none;
  cursor: crosshair;
}

.rotulo {
  color: var(--texto-2);
  font-size: 14px;
}

.ayuda {
  margin: 0;
  color: var(--texto-3);
  font-size: 14px;
}
</style>
