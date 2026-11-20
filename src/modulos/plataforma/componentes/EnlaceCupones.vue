<script setup lang="ts">
/**
 * Enlace del comercio para redimir cupones (`/comercio#t=…`, acuerdo A1): el mismo mientras no
 * se reemplace; reemplazarlo o revocarlo deja sin servicio el que tiene el comercio.
 */
import { computed, onMounted, ref } from 'vue'
import { enlacePublico } from '@/api/enlaces'
import { mensajeDeError } from '@/api/errores'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import SecretoUnaVez from '@/hud/componentes/SecretoUnaVez.vue'
import { enlaceCupones, generarEnlaceCupones, revocarEnlaceCupones } from '../api-publicidad'

const props = defineProps<{ comercioId: string }>()

const token = ref<string | null>(null)
const error = ref<string | null>(null)
const confirmando = ref<'generar' | 'revocar' | null>(null)
const enlace = computed(() => (token.value ? enlacePublico('comercio', null, token.value) : null))
const dialogo = computed({ get: () => confirmando.value !== null, set: (v) => (v ? undefined : (confirmando.value = null)) })

const generar = useAccion(() => generarEnlaceCupones(props.comercioId), {
  alExito: (t) => {
    token.value = t
    confirmando.value = null
  },
})
const revocar = useAccion(() => revocarEnlaceCupones(props.comercioId), {
  alExito: () => {
    token.value = null
    confirmando.value = null
  },
})
const accion = computed(() => (confirmando.value === 'revocar' ? revocar : generar))

function pedir(que: 'generar' | 'revocar') {
  generar.reiniciar()
  revocar.reiniciar()
  if (que === 'generar' && !token.value) void generar.ejecutar()
  else confirmando.value = que
}

onMounted(async () => {
  try {
    token.value = await enlaceCupones(props.comercioId)
  } catch (e) {
    error.value = mensajeDeError(e)
  }
})
</script>

<template>
  <div class="campos">
    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
    <SecretoUnaVez
      v-if="enlace"
      :valor="enlace"
      etiqueta="Enlace para redimir cupones"
      aviso="Entrégueselo solo al comercio: con él marca los cupones como usados."
    />
    <p
      v-else
      class="texto-2"
    >
      El comercio aún no tiene enlace para redimir cupones.
    </p>
    <div class="botones">
      <HudBoton
        variante="secundario"
        :cargando="generar.cargando.value && !confirmando"
        @click="pedir('generar')"
      >
        {{ token ? 'Reemplazar enlace' : 'Generar enlace' }}
      </HudBoton>
      <HudBoton
        v-if="token"
        variante="fantasma"
        @click="pedir('revocar')"
      >
        Revocar
      </HudBoton>
    </div>
    <p
      v-if="generar.error.value && !confirmando"
      class="error"
      role="alert"
    >
      {{ generar.error.value }}
    </p>
    <HudDialogo
      v-model:abierto="dialogo"
      :titulo="confirmando === 'revocar' ? '¿Revocar el enlace de cupones?' : '¿Reemplazar el enlace de cupones?'"
    >
      <p class="aviso">
        El enlace que tiene el comercio <strong>dejará de funcionar</strong>.
      </p>
      <p
        v-if="accion.error.value"
        class="error"
        role="alert"
      >
        {{ accion.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="confirmando = null"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="accion.cargando.value"
          @click="accion.ejecutar()"
        >
          {{ confirmando === 'revocar' ? 'Revocar enlace' : 'Reemplazar enlace' }}
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
