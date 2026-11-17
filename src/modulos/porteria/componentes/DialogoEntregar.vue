<script setup lang="ts">
/**
 * Entregar correspondencia a una persona autorizada del bien (o a un tercero con nombre y
 * documento) con **firma** en pantalla o **foto** de quien recibe. El backend exige una de las dos.
 */
import { computed, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Correspondencia, PersonaEntrega } from '@/api/tipos'
import { TIPO_PAQUETE } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import CapturaFirma from '@/hud/componentes/CapturaFirma.vue'
import CapturaFoto from '@/hud/componentes/CapturaFoto.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import { useBienes } from '@/stores/bienes'
import { entregarCorrespondencia, personasParaEntrega } from '../api'

const TERCERO = 'tercero'

const props = defineProps<{ entidadId: string; paquete: Correspondencia | null }>()
const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ entregado: [c: Correspondencia, quien: string] }>()

const bienes = useBienes()
const personas = ref<PersonaEntrega[]>([])
const errorPersonas = ref<string | null>(null)
const quien = ref('')
const terceroNombre = ref('')
const terceroDocumento = ref('')
const soporte = ref<'firma' | 'foto'>('firma')
const firma = ref('')
const foto = ref('')
const intentado = ref(false)

const esTercero = computed(() => quien.value === TERCERO)
const nombreQuien = computed(() => (esTercero.value ? terceroNombre.value.trim() : (personas.value.find((p) => p.persona_id === quien.value)?.nombre ?? '')))
const falta = computed(() => {
  if (!quien.value) return 'Elija quién recibe.'
  if (esTercero.value && (!terceroNombre.value.trim() || !terceroDocumento.value.trim())) return 'Escriba el nombre y el documento de quien recibe.'
  if (soporte.value === 'firma' ? !firma.value : !foto.value) return soporte.value === 'firma' ? 'Falta la firma.' : 'Falta la foto.'
  return null
})

const entregar = useAccion(() =>
  entregarCorrespondencia(props.entidadId, props.paquete?.id ?? '', {
    persona_id: esTercero.value ? null : quien.value,
    tercero_nombre: esTercero.value ? terceroNombre.value.trim() : null,
    tercero_documento: esTercero.value ? terceroDocumento.value.trim() : null,
    firma_base64: soporte.value === 'firma' ? firma.value : null,
    foto_base64: soporte.value === 'foto' ? foto.value : null,
  }),
)

watch(abierto, async (si) => {
  if (!si || !props.paquete) return
  quien.value = terceroNombre.value = terceroDocumento.value = firma.value = foto.value = ''
  soporte.value = 'firma'
  intentado.value = false
  errorPersonas.value = null
  entregar.reiniciar()
  try {
    personas.value = await personasParaEntrega(props.entidadId, props.paquete.bien_privado_id)
  } catch (e) {
    personas.value = []
    errorPersonas.value = mensajeDeError(e)
  }
})

async function enviar() {
  intentado.value = true
  if (falta.value) return
  const r = await entregar.ejecutar()
  if (!r.ok) return
  abierto.value = false
  emit('entregado', r.valor.correspondencia, nombreQuien.value)
}
</script>

<template>
  <HudDialogo
    v-model:abierto="abierto"
    titulo="Entregar paquete"
  >
    <form
      v-if="paquete"
      id="formulario-entregar"
      class="campos"
      novalidate
      @submit.prevent="enviar"
    >
      <p class="texto-2">
        {{ TIPO_PAQUETE[paquete.tipo] }}{{ paquete.remitente ? ` de ${paquete.remitente}` : '' }} para
        <strong>{{ bienes.codigo(paquete.bien_privado_id) }}</strong>{{ paquete.ubicacion ? ` · ${paquete.ubicacion}` : '' }}
      </p>
      <p
        v-if="errorPersonas"
        class="error"
        role="alert"
      >
        {{ errorPersonas }}
      </p>
      <fieldset class="opciones-radio">
        <legend>¿Quién recibe?</legend>
        <label
          v-for="p in personas"
          :key="p.persona_id"
        >
          <input
            v-model="quien"
            type="radio"
            name="quien"
            :value="p.persona_id"
          > {{ p.nombre }} <small>({{ p.vinculo }})</small>
        </label>
        <label>
          <input
            v-model="quien"
            type="radio"
            name="quien"
            :value="TERCERO"
          > Otra persona
        </label>
      </fieldset>
      <template v-if="esTercero">
        <HudCampo
          v-model="terceroNombre"
          etiqueta="Nombre de quien recibe"
          autocompletar="off"
        />
        <HudCampo
          v-model="terceroDocumento"
          etiqueta="Documento de quien recibe"
          autocompletar="off"
        />
      </template>
      <fieldset class="opciones-radio en-linea">
        <legend>Soporte de la entrega</legend>
        <label>
          <input
            v-model="soporte"
            type="radio"
            name="soporte"
            value="firma"
          > Firma
        </label>
        <label>
          <input
            v-model="soporte"
            type="radio"
            name="soporte"
            value="foto"
          > Foto
        </label>
      </fieldset>
      <CapturaFirma
        v-if="soporte === 'firma'"
        v-model="firma"
      />
      <CapturaFoto
        v-else
        v-model="foto"
        etiqueta="Foto de quien recibe"
      />
      <p
        v-if="(intentado && falta) || entregar.error.value"
        class="error"
        role="alert"
      >
        {{ entregar.error.value ?? falta }}
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
        form="formulario-entregar"
        :cargando="entregar.cargando.value"
      >
        Entregar
      </HudBoton>
    </template>
  </HudDialogo>
</template>

<style scoped src="../vistas/porteria.css"></style>
<style scoped>
.en-linea {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.en-linea legend {
  grid-column: 1 / -1;
}
</style>
