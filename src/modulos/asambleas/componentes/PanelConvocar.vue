<script setup lang="ts">
/**
 * Convocar en dos pasos: elegir los canales y revisar (el padrón queda fijo con el cuadro de
 * coeficientes vigente; la antelación y el orden del día se validan en el backend) → convocar.
 */
import { computed, ref } from 'vue'
import type { DetalleReunion, ResultadoConvocatoria } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaHora, hoyEn } from '@/formato/fechas'
import FlujoDosPasos, { type PasoFlujo } from '@/hud/componentes/FlujoDosPasos.vue'
import { useEntidad } from '@/stores/entidad'
import { convocar } from '../api'
import { antelacionSuficiente, MODALIDAD, TIPO_REUNION } from '../reglas'

const props = defineProps<{ entidadId: string; detalle: DetalleReunion }>()
const emit = defineEmits<{ convocada: [r: ResultadoConvocatoria] }>()

const entidad = useEntidad()
const zona = computed(() => entidad.zonaHoraria)
const paso = ref<PasoFlujo>('editar')
const whatsapp = ref(true)
const correo = ref(true)
const r = computed(() => props.detalle.reunion)
const fechaLocal = computed(() => fechaHora(r.value.fecha_programada, zona.value))
const antelacionOk = computed(() => antelacionSuficiente(r.value.tipo, hoyEn(zona.value), r.value.fecha_programada.slice(0, 10)))
const bloqueado = computed(() => props.detalle.puntos.length === 0 || (!whatsapp.value && !correo.value))

const accion = useAccion(() => convocar(props.entidadId, r.value.id, { whatsapp: whatsapp.value, correo: correo.value }))

async function confirmar() {
  const res = await accion.ejecutar()
  if (!res.ok) return
  paso.value = 'hecho'
  emit('convocada', res.valor)
}
</script>

<template>
  <FlujoDosPasos
    v-model:paso="paso"
    accion="Convocar"
    :cargando="accion.cargando.value"
    :bloqueado="bloqueado"
    @previsualizar="paso = 'revisar'"
    @confirmar="confirmar"
    @reiniciar="paso = 'editar'"
  >
    <template #formulario>
      <fieldset class="opciones-radio">
        <legend>Enviar la convocatoria por</legend>
        <label>
          <input
            v-model="whatsapp"
            type="checkbox"
          > WhatsApp
        </label>
        <label>
          <input
            v-model="correo"
            type="checkbox"
          > Correo electrónico
        </label>
      </fieldset>
      <p
        v-if="detalle.puntos.length === 0"
        class="aviso"
      >
        Agregue al menos un punto al orden del día antes de convocar.
      </p>
    </template>
    <template #vista-previa>
      <div class="campos">
        <p class="aviso">
          Al convocar, el padrón queda <strong>fijo</strong> con el cuadro de coeficientes vigente y ya no se pueden cambiar los datos
          de la reunión ni el orden del día.
        </p>
        <dl class="datos">
          <div><dt>Reunión</dt><dd>{{ TIPO_REUNION[r.tipo] }} · {{ MODALIDAD[r.modalidad] }}</dd></div>
          <div><dt>Fecha</dt><dd>{{ fechaLocal }}</dd></div>
          <div><dt>Orden del día</dt><dd>{{ detalle.puntos.length }} punto(s)</dd></div>
          <div><dt>Anexos</dt><dd>{{ detalle.documentos.length }}</dd></div>
          <div><dt>Canales</dt><dd>{{ [whatsapp ? 'WhatsApp' : '', correo ? 'correo' : ''].filter(Boolean).join(' y ') }}</dd></div>
        </dl>
        <p
          v-if="!antelacionOk"
          class="error"
          role="alert"
        >
          La fecha no cumple la antelación legal: el sistema rechazará la convocatoria.
        </p>
        <p
          v-if="accion.error.value"
          class="error"
          role="alert"
        >
          {{ accion.error.value }}
        </p>
      </div>
    </template>
  </FlujoDosPasos>
</template>

<style scoped src="../vistas/asambleas.css"></style>
