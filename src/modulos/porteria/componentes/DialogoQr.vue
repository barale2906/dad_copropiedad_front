<script setup lang="ts">
/** Ingreso con el QR de una pre-autorización (lector físico, teclado o cámara). */
import { ref, watch } from 'vue'
import type { Visita } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import LectorQr from '@/hud/componentes/LectorQr.vue'
import { ingresoConQr } from '../api'

const props = defineProps<{ entidadId: string }>()
const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ ingreso: [visita: Visita] }>()

const ultimo = ref<Visita | null>(null)
const ingresar = useAccion((_c, qr: string) => ingresoConQr(props.entidadId, qr))

watch(abierto, (si) => {
  if (!si) return
  ultimo.value = null
  ingresar.reiniciar()
})

async function leido(qr: string) {
  ultimo.value = null
  const r = await ingresar.ejecutar(qr)
  if (!r.ok) return
  ultimo.value = r.valor
  emit('ingreso', r.valor)
}
</script>

<template>
  <HudDialogo
    v-model:abierto="abierto"
    titulo="Ingreso con QR"
  >
    <div class="campos">
      <LectorQr
        :cargando="ingresar.cargando.value"
        @leido="leido"
      />
      <p
        v-if="ultimo"
        class="ok"
        role="status"
      >
        Puede pasar: <strong>{{ ultimo.visitante_nombre }}</strong> (ingreso {{ ultimo.usos }} de {{ ultimo.usos_permitidos }}).
      </p>
      <p
        v-else-if="ingresar.error.value"
        class="error"
        role="alert"
      >
        No puede pasar: {{ ingresar.error.value }}
      </p>
    </div>
    <template #acciones>
      <HudBoton
        variante="fantasma"
        @click="abierto = false"
      >
        Cerrar
      </HudBoton>
    </template>
  </HudDialogo>
</template>

<style scoped src="../vistas/porteria.css"></style>
