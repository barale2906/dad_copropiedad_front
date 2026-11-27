<script setup lang="ts">
/**
 * Elige y sube una imagen de la publicidad (pieza o logo): JPEG, PNG o WebP de hasta 2 MB. La
 * sube al elegirla y emite su id; muestra la vista previa con el enlace firmado que devuelve el
 * backend. `modelValue` es el id de la imagen vigente (`null` = sin imagen).
 */
import { ref } from 'vue'
import { aBase64 } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import { subirImagen } from '../api-publicidad'

withDefaults(defineProps<{ etiqueta?: string }>(), { etiqueta: 'Imagen' })
const imagen = defineModel<string | null>({ required: true })

const MAXIMO = 2 * 1024 * 1024
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const entrada = ref<HTMLInputElement | null>(null)
const vista = ref<string | null>(null)
const subiendo = ref(false)
const error = ref<string | null>(null)

async function alElegir(evento: Event) {
  const archivo = (evento.target as HTMLInputElement).files?.[0]
  if (!archivo) return
  error.value = null
  if (!TIPOS.includes(archivo.type)) {
    error.value = 'Use una imagen JPEG, PNG o WebP.'
    return
  }
  if (archivo.size > MAXIMO) {
    error.value = 'La imagen pasa de 2 MB.'
    return
  }
  subiendo.value = true
  try {
    const r = await subirImagen(archivo.name, await aBase64(archivo))
    imagen.value = r.id
    vista.value = r.url
  } catch (e) {
    error.value = mensajeDeError(e)
  } finally {
    subiendo.value = false
    if (entrada.value) entrada.value.value = ''
  }
}

function quitar() {
  imagen.value = null
  vista.value = null
}
</script>

<template>
  <div class="selector-imagen">
    <span class="etiqueta">{{ etiqueta }}</span>
    <img
      v-if="vista"
      :src="vista"
      :alt="`Vista previa: ${etiqueta}`"
      class="vista"
    >
    <p
      v-else-if="imagen"
      class="texto-2"
    >
      Tiene una imagen cargada.
    </p>
    <div class="botones">
      <label class="boton-archivo">
        <input
          ref="entrada"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          :disabled="subiendo"
          @change="alElegir"
        >
        {{ subiendo ? 'Subiendo…' : imagen ? 'Cambiar la imagen' : 'Elegir una imagen' }}
      </label>
      <HudBoton
        v-if="imagen"
        variante="fantasma"
        @click="quitar"
      >
        Quitar
      </HudBoton>
    </div>
    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.selector-imagen {
  display: grid;
  gap: var(--espacio-2, 0.5rem);
}
.vista {
  max-width: 16rem;
  max-height: 10rem;
  object-fit: contain;
  border-radius: var(--radio-1, 4px);
}
.boton-archivo {
  cursor: pointer;
  text-decoration: underline;
}
.boton-archivo input {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  opacity: 0;
}
.botones {
  display: flex;
  gap: var(--espacio-2, 0.5rem);
  align-items: center;
}
</style>
