<script setup lang="ts">
/**
 * QR para compartir (p. ej. el de una visita pre-autorizada): lo dibuja en el cliente y lo
 * comparte como imagen con la Web Share API; si el navegador no puede, ofrece WhatsApp con el
 * mensaje y deja descargar la imagen. El texto del QR también se muestra (accesibilidad).
 */
import { computed, ref, useTemplateRef } from 'vue'
import IDescargar from '~icons/tabler/download'
import ICompartir from '~icons/tabler/share'
import HudBoton from './HudBoton.vue'
import HudCodigoQr from './HudCodigoQr.vue'

const props = withDefaults(defineProps<{ texto: string; mensaje: string; nombreArchivo?: string; descripcion?: string }>(), {
  nombreArchivo: 'qr.png',
  descripcion: 'Código QR para compartir',
})

const contenedor = useTemplateRef<HTMLDivElement>('contenedor')
const aviso = ref<string | null>(null)
/** Respaldo: WhatsApp con el mensaje y el código como texto. */
const enlaceWhatsApp = computed(() => `https://wa.me/?text=${encodeURIComponent(`${props.mensaje}\n${props.texto}`)}`)

/**
 * El SVG del QR → PNG de 512 px (lo que aceptan WhatsApp y la mayoría de apps). `null` si el
 * navegador no puede dibujarlo: entonces se ofrece la alternativa (texto y WhatsApp).
 */
async function comoPng(): Promise<Blob | null> {
  const svg = contenedor.value?.querySelector('svg')
  if (!svg) return null
  try {
    const imagen = new Image()
    imagen.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
    await imagen.decode()
    const lienzo = document.createElement('canvas')
    lienzo.width = lienzo.height = 512
    const ctx = lienzo.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 512, 512)
    ctx.drawImage(imagen, 0, 0, 512, 512)
    return await new Promise((resolver) => lienzo.toBlob((b) => resolver(b), 'image/png'))
  } catch {
    return null
  }
}

async function compartir() {
  aviso.value = null
  const png = await comoPng()
  const archivo = png ? new File([png], props.nombreArchivo, { type: 'image/png' }) : null
  try {
    if (archivo && navigator.canShare?.({ files: [archivo] })) {
      await navigator.share({ files: [archivo], text: props.mensaje })
      return
    }
    if (navigator.share) {
      await navigator.share({ text: `${props.mensaje}\n${props.texto}` })
      return
    }
  } catch {
    // El usuario canceló o el navegador no pudo: se ofrece la alternativa.
  }
  aviso.value = 'Su navegador no comparte imágenes: envíe el mensaje por WhatsApp o descargue el QR.'
}

async function descargarImagen() {
  const png = await comoPng()
  if (!png) return
  const url = URL.createObjectURL(png)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = props.nombreArchivo
  enlace.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="qr-compartir">
    <div
      ref="contenedor"
      class="codigo"
    >
      <HudCodigoQr
        :texto="texto"
        :descripcion="descripcion"
      />
    </div>
    <div class="botones">
      <HudBoton @click="compartir">
        <ICompartir aria-hidden="true" /> Compartir
      </HudBoton>
      <HudBoton
        variante="secundario"
        @click="descargarImagen"
      >
        <IDescargar aria-hidden="true" /> Descargar imagen
      </HudBoton>
      <a
        class="whatsapp"
        :href="enlaceWhatsApp"
        target="_blank"
        rel="noopener"
      >Enviar por WhatsApp</a>
    </div>
    <p
      v-if="aviso"
      class="aviso"
      role="status"
    >
      {{ aviso }}
    </p>
    <details>
      <summary>Ver el código como texto</summary>
      <code>{{ texto }}</code>
    </details>
  </div>
</template>

<style scoped>
.qr-compartir {
  display: grid;
  gap: 12px;
  justify-items: center;
}

.codigo {
  width: min(260px, 70vw);
}

.botones {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.whatsapp {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 12px;
  color: var(--cian);
}

.aviso {
  margin: 0;
  color: var(--ambar);
  text-align: center;
}

details {
  width: 100%;
}

summary {
  min-height: 40px;
  padding: 8px 0;
  color: var(--cian);
  cursor: pointer;
}

code {
  display: block;
  font-family: var(--fuente-mono);
  font-size: 12px;
  overflow-wrap: anywhere;
}
</style>
