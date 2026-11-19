<script setup lang="ts">
/**
 * Confirmación de una acción que exige motivo (anular, rechazar, revertir, cancelar). Emite
 * `confirmar` con el motivo ya recortado; el padre ejecuta la acción y cierra el diálogo.
 */
import { computed, ref, useId, watch } from 'vue'
import HudBoton from './HudBoton.vue'
import HudCampo from './HudCampo.vue'
import HudDialogo from './HudDialogo.vue'

const props = withDefaults(
  defineProps<{
    titulo: string
    /** Texto del botón que confirma (p. ej. «Anular factura»). */
    accion: string
    descripcion?: string
    cargando?: boolean
    error?: string | null
    minimo?: number
  }>(),
  { descripcion: undefined, cargando: false, error: null, minimo: 3 },
)
const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ confirmar: [motivo: string] }>()

// Un id por instancia: con dos confirmaciones en la misma pantalla, cada botón envía su formulario.
const formulario = useId()
const motivo = ref('')
const intentado = ref(false)
const valido = computed(() => motivo.value.trim().length >= props.minimo)
const errorMotivo = computed(() =>
  intentado.value && !valido.value ? `Escriba el motivo (al menos ${props.minimo} caracteres).` : null,
)

watch(abierto, (si) => {
  if (si) {
    motivo.value = ''
    intentado.value = false
  }
})

function confirmar() {
  intentado.value = true
  if (valido.value) emit('confirmar', motivo.value.trim())
}
</script>

<template>
  <HudDialogo
    v-model:abierto="abierto"
    :titulo="titulo"
  >
    <p
      v-if="descripcion"
      class="descripcion"
    >
      {{ descripcion }}
    </p>
    <form
      :id="formulario"
      @submit.prevent="confirmar"
    >
      <HudCampo
        v-model="motivo"
        etiqueta="Motivo"
        multilinea
        requerido
        :maximo="500"
        :error="errorMotivo ?? error"
      />
    </form>
    <template #acciones>
      <HudBoton
        variante="fantasma"
        @click="abierto = false"
      >
        Cancelar
      </HudBoton>
      <HudBoton
        tipo="submit"
        :form="formulario"
        :cargando="cargando"
      >
        {{ accion }}
      </HudBoton>
    </template>
  </HudDialogo>
</template>

<style scoped>
.descripcion {
  margin: 0;
  color: var(--texto-2);
}
</style>
