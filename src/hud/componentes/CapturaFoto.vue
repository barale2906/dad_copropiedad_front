<script setup lang="ts">
/**
 * Foto con la cámara (`getUserMedia`) o, si no hay acceso, con el selector del dispositivo
 * (`<input capture>`, que en el celular abre la cámara). `v-model` = JPEG/PNG en Base64 (sin el
 * prefijo `data:`), o `''`. La cámara se apaga al tomar la foto o al salir.
 */
import { computed, onBeforeUnmount, ref, useTemplateRef } from 'vue'
import ICamara from '~icons/tabler/camera'
import HudBoton from './HudBoton.vue'

withDefaults(defineProps<{ etiqueta?: string }>(), { etiqueta: 'Foto' })
const foto = defineModel<string>({ required: true })

const video = useTemplateRef<HTMLVideoElement>('video')
const selector = useTemplateRef<HTMLInputElement>('selector')
const transmision = ref<MediaStream | null>(null)
const aviso = ref<string | null>(null)
const vista = computed(() => (foto.value ? `data:image/jpeg;base64,${foto.value}` : null))

function apagar() {
  transmision.value?.getTracks().forEach((t) => t.stop())
  transmision.value = null
}

async function abrirCamara() {
  aviso.value = null
  if (!navigator.mediaDevices?.getUserMedia) {
    selector.value?.click()
    return
  }
  try {
    transmision.value = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    if (video.value) {
      video.value.srcObject = transmision.value
      await video.value.play().catch(() => undefined)
    }
  } catch {
    aviso.value = 'No se pudo abrir la cámara: elija una foto del dispositivo.'
    selector.value?.click()
  }
}

function tomar() {
  const v = video.value
  if (!v) return
  const lienzo = document.createElement('canvas')
  lienzo.width = v.videoWidth || 640
  lienzo.height = v.videoHeight || 480
  lienzo.getContext('2d')?.drawImage(v, 0, 0, lienzo.width, lienzo.height)
  foto.value = lienzo.toDataURL('image/jpeg', 0.8).replace(/^data:image\/[a-z]+;base64,/, '')
  apagar()
}

function elegida(e: Event) {
  const archivo = (e.target as HTMLInputElement).files?.[0]
  if (!archivo) return
  const lector = new FileReader()
  lector.onload = () => {
    foto.value = String(lector.result ?? '').replace(/^data:[^;]+;base64,/, '')
  }
  lector.readAsDataURL(archivo)
}

function quitar() {
  foto.value = ''
  if (selector.value) selector.value.value = ''
}

onBeforeUnmount(apagar)
</script>

<template>
  <div class="captura-foto">
    <span class="rotulo">{{ etiqueta }}</span>
    <video
      v-show="transmision"
      ref="video"
      playsinline
      muted
      aria-hidden="true"
    />
    <img
      v-if="vista && !transmision"
      :src="vista"
      :alt="`${etiqueta} tomada`"
    >
    <input
      ref="selector"
      :aria-label="`${etiqueta}: elegir un archivo`"
      type="file"
      accept="image/*"
      capture="environment"
      class="solo-lector"
      tabindex="-1"
      @change="elegida"
    >
    <div class="botones">
      <HudBoton
        v-if="transmision"
        @click="tomar"
      >
        <ICamara aria-hidden="true" /> Tomar la foto
      </HudBoton>
      <HudBoton
        v-else
        variante="secundario"
        @click="abrirCamara"
      >
        <ICamara aria-hidden="true" /> {{ foto ? 'Tomar otra' : 'Tomar foto' }}
      </HudBoton>
      <HudBoton
        v-if="foto && !transmision"
        variante="fantasma"
        @click="quitar"
      >
        Quitar la foto
      </HudBoton>
    </div>
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
.captura-foto {
  display: grid;
  gap: 8px;
  justify-items: start;
}

video,
img {
  width: 100%;
  max-width: 420px;
  border: 1px solid var(--linea-fuerte);
}

.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rotulo {
  color: var(--texto-2);
  font-size: 14px;
}

.aviso {
  margin: 0;
  color: var(--ambar);
}
</style>
