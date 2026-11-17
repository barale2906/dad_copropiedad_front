<script setup lang="ts">
/**
 * Lectura de un código QR por dos vías: el **lector físico** (escribe como un teclado y termina en
 * Enter) en un campo siempre disponible, y la **cámara** con `BarcodeDetector` donde el navegador
 * lo tenga (sin librerías). Emite `leido` con el texto.
 */
import { onBeforeUnmount, ref, useTemplateRef } from 'vue'
import ICamara from '~icons/tabler/camera'
import HudBoton from './HudBoton.vue'
import HudCampo from './HudCampo.vue'

interface Detector {
  detect(fuente: HTMLVideoElement): Promise<{ rawValue: string }[]>
}
type ConstructorDetector = new (o: { formats: string[] }) => Detector

withDefaults(defineProps<{ etiqueta?: string; cargando?: boolean }>(), { etiqueta: 'Código QR', cargando: false })
const emit = defineEmits<{ leido: [texto: string] }>()

const texto = ref('')
const video = useTemplateRef<HTMLVideoElement>('video')
const transmision = ref<MediaStream | null>(null)
const aviso = ref<string | null>(null)
const ConDetector = (globalThis as { BarcodeDetector?: ConstructorDetector }).BarcodeDetector
const hayCamara = !!ConDetector && !!navigator.mediaDevices?.getUserMedia
let buscando = false

function enviar() {
  const t = texto.value.trim()
  if (!t) return
  emit('leido', t)
  texto.value = ''
}

function apagar() {
  buscando = false
  transmision.value?.getTracks().forEach((x) => x.stop())
  transmision.value = null
}

async function escanear() {
  if (!ConDetector) return
  aviso.value = null
  try {
    transmision.value = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    if (!video.value) return
    video.value.srcObject = transmision.value
    await video.value.play()
    const detector = new ConDetector({ formats: ['qr_code'] })
    buscando = true
    while (buscando) {
      const [codigo] = await detector.detect(video.value).catch(() => [])
      if (codigo?.rawValue) {
        apagar()
        emit('leido', codigo.rawValue)
        return
      }
      await new Promise((r) => setTimeout(r, 250))
    }
  } catch {
    apagar()
    aviso.value = 'No se pudo usar la cámara: use el lector o escriba el código.'
  }
}

function alternarCamara() {
  if (transmision.value) apagar()
  else void escanear()
}

onBeforeUnmount(apagar)
</script>

<template>
  <div class="lector-qr">
    <form
      class="fila"
      @submit.prevent="enviar"
    >
      <HudCampo
        v-model="texto"
        :etiqueta="etiqueta"
        autocompletar="off"
        ayuda="Pase el código por el lector (termina solo) o escríbalo y presione Enter."
      />
      <HudBoton
        tipo="submit"
        :cargando="cargando"
        :deshabilitado="!texto.trim()"
      >
        Verificar
      </HudBoton>
    </form>
    <template v-if="hayCamara">
      <video
        v-show="transmision"
        ref="video"
        playsinline
        muted
        aria-hidden="true"
      />
      <HudBoton
        :variante="transmision ? 'fantasma' : 'secundario'"
        @click="alternarCamara"
      >
        <ICamara aria-hidden="true" /> {{ transmision ? 'Cerrar la cámara' : 'Leer con la cámara' }}
      </HudBoton>
    </template>
    <p
      v-if="aviso"
      class="aviso"
      role="status"
    >
      {{ aviso }}
    </p>
  </div>
</template>

<style scoped>
.lector-qr {
  display: grid;
  gap: 10px;
  justify-items: start;
}

.fila {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
}

.fila > :first-child {
  flex: 1 1 260px;
}

.fila :deep(.hud-boton) {
  margin-top: 26px;
}

video {
  width: 100%;
  max-width: 420px;
  border: 1px solid var(--linea-fuerte);
}

.aviso {
  margin: 0;
  color: var(--ambar);
}
</style>
