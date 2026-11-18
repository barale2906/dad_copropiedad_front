<script setup lang="ts">
/** Datos de una reunión: tipo, convocatoria, modalidad, fecha, lugar y reglas de la asamblea. */
import { computed } from 'vue'
import type { Reunion } from '@/api/tipos'
import { fechaHora } from '@/formato/fechas'
import { useEntidad } from '@/stores/entidad'
import { BASE_COMPUTO, CONVOCATORIA, EFECTO_MORA, MODALIDAD, TIPO_REUNION } from '../reglas'

const props = defineProps<{ reunion: Reunion }>()
const entidad = useEntidad()
const c = computed(() => props.reunion.configuracion)
</script>

<template>
  <dl class="datos">
    <div><dt>Tipo</dt><dd>{{ TIPO_REUNION[reunion.tipo] }} · {{ CONVOCATORIA[reunion.convocatoria] }}</dd></div>
    <div><dt>Modalidad</dt><dd>{{ MODALIDAD[reunion.modalidad] }}</dd></div>
    <div><dt>Fecha</dt><dd>{{ fechaHora(reunion.fecha_programada, entidad.zonaHoraria) }}</dd></div>
    <div v-if="reunion.lugar">
      <dt>Lugar</dt><dd>{{ reunion.lugar }}</dd>
    </div>
    <div v-if="reunion.enlace_video">
      <dt>Videollamada</dt><dd><a :href="reunion.enlace_video" rel="noopener" target="_blank">{{ reunion.enlace_video }}</a></dd>
    </div>
    <div><dt>Votaciones</dt><dd>{{ BASE_COMPUTO[c.base_computo ?? 'coeficiente'] }}</dd></div>
    <div><dt>Bienes en mora</dt><dd>{{ EFECTO_MORA[c.efecto_mora ?? 'informativo'] }}</dd></div>
    <div v-if="c.max_bienes_apoderado">
      <dt>Máximo por apoderado</dt><dd>{{ c.max_bienes_apoderado }} bienes</dd>
    </div>
    <div v-if="reunion.convocada_en">
      <dt>Convocada</dt><dd>{{ fechaHora(reunion.convocada_en, entidad.zonaHoraria) }}</dd>
    </div>
    <div v-if="reunion.motivo_cancelacion">
      <dt>Motivo de la cancelación</dt><dd>{{ reunion.motivo_cancelacion }}</dd>
    </div>
  </dl>
</template>

<style scoped src="../vistas/asambleas.css"></style>
