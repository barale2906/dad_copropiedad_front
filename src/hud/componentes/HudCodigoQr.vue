<script setup lang="ts">
/**
 * Código QR dibujado como SVG (oscuro sobre claro, como lo exigen los lectores). Se usa para
 * inscribir el segundo factor; el texto equivalente debe mostrarse al lado (accesibilidad).
 */
import qrcode from 'qrcode-generator'
import { computed } from 'vue'

const props = withDefaults(defineProps<{ texto: string; descripcion?: string }>(), {
  descripcion: 'Código QR',
})

const MARGEN = 4

const qr = computed(() => {
  const q = qrcode(0, 'M')
  q.addData(props.texto)
  q.make()
  const n = q.getModuleCount()
  let trazo = ''
  for (let fila = 0; fila < n; fila++) {
    for (let col = 0; col < n; col++) {
      if (q.isDark(fila, col)) trazo += `M${col + MARGEN} ${fila + MARGEN}h1v1h-1z`
    }
  }
  return { lado: n + 2 * MARGEN, trazo }
})
</script>

<template>
  <svg
    class="hud-codigo-qr"
    :viewBox="`0 0 ${qr.lado} ${qr.lado}`"
    role="img"
    :aria-label="descripcion"
    shape-rendering="crispEdges"
  >
    <rect
      class="claro"
      :width="qr.lado"
      :height="qr.lado"
    />
    <path
      class="oscuro"
      :d="qr.trazo"
    />
  </svg>
</template>

<style scoped>
.hud-codigo-qr {
  display: block;
  width: min(100%, 220px);
  height: auto;
}

.claro {
  fill: var(--texto);
}

.oscuro {
  fill: var(--fondo);
}
</style>
