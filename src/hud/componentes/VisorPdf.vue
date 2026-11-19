<script setup lang="ts">
/**
 * Muestra un PDF dentro de la app con el visor del navegador (`<iframe>` con una URL de `Blob`,
 * sin librerías) y ofrece «Descargar» y «Abrir en otra pestaña» (algunos móviles no lo muestran
 * en línea). Recibe el archivo ya descargado: no llama a la API. La URL se libera al cambiar o
 * al desmontar.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import IDescargar from '~icons/tabler/download'
import IAbrir from '~icons/tabler/external-link'
import HudBoton from './HudBoton.vue'

const props = withDefaults(defineProps<{ archivo: Blob; titulo: string; alto?: string }>(), { alto: 'min(70dvh, 720px)' })
const emit = defineEmits<{ descargar: [] }>()

const url = ref('')
const estilo = computed(() => ({ height: props.alto }))

function liberar() {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
}

watch(
  () => props.archivo,
  (a) => {
    liberar()
    url.value = URL.createObjectURL(a)
  },
  { immediate: true },
)

function abrir() {
  window.open(url.value, '_blank', 'noopener')
}

onBeforeUnmount(liberar)
</script>

<template>
  <figure class="visor">
    <iframe
      :src="url"
      :title="titulo"
      :style="estilo"
    />
    <figcaption class="acciones">
      <HudBoton
        variante="secundario"
        @click="emit('descargar')"
      >
        <IDescargar aria-hidden="true" /> Descargar<span class="solo-lector"> {{ titulo }}</span>
      </HudBoton>
      <HudBoton
        variante="fantasma"
        @click="abrir"
      >
        <IAbrir aria-hidden="true" /> Abrir en otra pestaña
      </HudBoton>
    </figcaption>
  </figure>
</template>

<style scoped>
.visor {
  display: grid;
  gap: 10px;
  margin: 0;
}

iframe {
  width: 100%;
  border: 1px solid var(--linea);
  background: var(--superficie);
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
