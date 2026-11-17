<script setup lang="ts">
/** Recibir correspondencia: bien, tipo, remitente, guía, ubicación y foto opcional. Avisa al residente. */
import { computed, ref, watch } from 'vue'
import type { Correspondencia, TipoCorrespondencia } from '@/api/tipos'
import { opcionesDe, TIPO_PAQUETE } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import CapturaFoto from '@/hud/componentes/CapturaFoto.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { recibirCorrespondencia } from '../api'
import BienDestino from './BienDestino.vue'

const props = defineProps<{ entidadId: string }>()
const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ recibida: [c: Correspondencia] }>()

const bienId = ref('')
const tipo = ref<TipoCorrespondencia>('paquete')
const remitente = ref('')
const guia = ref('')
const ubicacion = ref('')
const foto = ref('')
const intentado = ref(false)
const faltaBien = computed(() => (intentado.value && !bienId.value ? 'Elija el bien destinatario.' : null))

const recibir = useAccion((clave) =>
  recibirCorrespondencia(
    props.entidadId,
    {
      bien_privado_id: bienId.value,
      tipo: tipo.value,
      remitente: remitente.value.trim() || null,
      guia: guia.value.trim() || null,
      ubicacion: ubicacion.value.trim() || null,
      foto_base64: foto.value || null,
    },
    clave,
  ),
)

watch(abierto, (si) => {
  if (!si) return
  bienId.value = remitente.value = guia.value = ubicacion.value = foto.value = ''
  tipo.value = 'paquete'
  intentado.value = false
  recibir.reiniciar()
})

async function enviar() {
  intentado.value = true
  if (!bienId.value) return
  const r = await recibir.ejecutar()
  if (!r.ok) return
  abierto.value = false
  emit('recibida', r.valor)
}
</script>

<template>
  <HudDialogo
    v-model:abierto="abierto"
    titulo="Recibir paquete"
  >
    <form
      id="formulario-recibir"
      class="campos"
      novalidate
      @submit.prevent="enviar"
    >
      <BienDestino
        v-model="bienId"
        :error="faltaBien"
      />
      <HudSelector
        v-model="tipo"
        etiqueta="Tipo"
        :opciones="opcionesDe(TIPO_PAQUETE)"
      />
      <HudCampo
        v-model="remitente"
        etiqueta="Remitente (opcional)"
        autocompletar="off"
      />
      <HudCampo
        v-model="guia"
        etiqueta="Número de guía (opcional)"
        autocompletar="off"
      />
      <HudCampo
        v-model="ubicacion"
        etiqueta="Dónde queda guardado (opcional)"
        autocompletar="off"
      />
      <CapturaFoto
        v-model="foto"
        etiqueta="Foto del paquete (opcional)"
      />
      <p
        v-if="recibir.error.value"
        class="error"
        role="alert"
      >
        {{ recibir.error.value }}
      </p>
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
        form="formulario-recibir"
        :cargando="recibir.cargando.value"
      >
        Registrar
      </HudBoton>
    </template>
  </HudDialogo>
</template>

<style scoped src="../vistas/porteria.css"></style>
