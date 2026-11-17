<script setup lang="ts">
/**
 * Anunciar una visita: bien, nombre, tipo y, si aplica, documento, placa y observación. El backend
 * avisa al responsable y escala solo (2 min a todos, 5 min llamada).
 */
import { computed, ref, watch } from 'vue'
import type { TipoVisita, Visita } from '@/api/tipos'
import { opcionesDe, TIPO_VISITA } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { anunciarVisita } from '../api'
import BienDestino from './BienDestino.vue'

const props = defineProps<{ entidadId: string }>()
const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ anunciada: [visita: Visita] }>()

const bienId = ref('')
const tipo = ref<TipoVisita>('visita')
const nombre = ref('')
const documento = ref('')
const placa = ref('')
const observacion = ref('')
const intentado = ref(false)
const faltaBien = computed(() => (intentado.value && !bienId.value ? 'Elija a qué bien va.' : null))
const faltaNombre = computed(() => (intentado.value && !nombre.value.trim() ? 'Escriba el nombre del visitante.' : null))

const anunciar = useAccion((clave) =>
  anunciarVisita(
    props.entidadId,
    {
      bien_privado_id: bienId.value,
      tipo: tipo.value,
      visitante_nombre: nombre.value.trim(),
      visitante_documento: documento.value.trim() || null,
      placa: placa.value.trim().toUpperCase() || null,
      observacion: observacion.value.trim() || null,
    },
    clave,
  ),
)

watch(abierto, (si) => {
  if (!si) return
  bienId.value = nombre.value = documento.value = placa.value = observacion.value = ''
  tipo.value = 'visita'
  intentado.value = false
  anunciar.reiniciar()
})

async function enviar() {
  intentado.value = true
  if (!bienId.value || !nombre.value.trim()) return
  const r = await anunciar.ejecutar()
  if (!r.ok) return
  abierto.value = false
  emit('anunciada', r.valor)
}
</script>

<template>
  <HudDialogo
    v-model:abierto="abierto"
    titulo="Anunciar visita"
  >
    <form
      id="formulario-anunciar"
      class="campos"
      novalidate
      @submit.prevent="enviar"
    >
      <BienDestino
        v-model="bienId"
        :error="faltaBien"
      />
      <HudCampo
        v-model="nombre"
        etiqueta="Nombre del visitante"
        autocompletar="off"
        :error="faltaNombre"
      />
      <HudSelector
        v-model="tipo"
        etiqueta="Tipo"
        :opciones="opcionesDe(TIPO_VISITA)"
      />
      <HudCampo
        v-model="documento"
        etiqueta="Documento (opcional)"
        autocompletar="off"
      />
      <HudCampo
        v-model="placa"
        etiqueta="Placa (opcional)"
        autocompletar="off"
      />
      <HudCampo
        v-model="observacion"
        etiqueta="Observación (opcional)"
        autocompletar="off"
      />
      <p
        v-if="anunciar.error.value"
        class="error"
        role="alert"
      >
        {{ anunciar.error.value }}
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
        form="formulario-anunciar"
        :cargando="anunciar.cargando.value"
      >
        Anunciar
      </HudBoton>
    </template>
  </HudDialogo>
</template>

<style scoped src="../vistas/porteria.css"></style>
