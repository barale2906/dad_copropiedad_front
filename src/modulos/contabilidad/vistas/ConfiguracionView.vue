<script setup lang="ts">
/** Configuración contable por pestañas (`?vista=`): general, tipos, reglas, rubros, notas y plantillas. */
import { computed } from 'vue'
import { usePestana } from '@/composables/usePestana'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import { useEntidad } from '@/stores/entidad'
import ConfigGeneral from '../componentes/configuracion/ConfigGeneral.vue'
import NotasEstados from '../componentes/configuracion/NotasEstados.vue'
import PlantillasContables from '../componentes/configuracion/PlantillasContables.vue'
import ReglasContables from '../componentes/configuracion/ReglasContables.vue'
import RubrosEstados from '../componentes/configuracion/RubrosEstados.vue'
import TiposComprobante from '../componentes/configuracion/TiposComprobante.vue'

const PESTANAS = [
  { id: 'general', texto: 'General' },
  { id: 'tipos', texto: 'Tipos de comprobante' },
  { id: 'reglas', texto: 'Reglas' },
  { id: 'rubros', texto: 'Rubros' },
  { id: 'notas', texto: 'Notas' },
  { id: 'plantillas', texto: 'Plantillas' },
] as const

const entidad = useEntidad()
const pestana = usePestana(PESTANAS)
const id = computed(() => entidad.activa?.entidad_id ?? '')
const editable = computed(() => entidad.tienePermiso('contabilidad.configurar'))
const titulo = computed(() => PESTANAS.find((p) => p.id === pestana.value)?.texto ?? '')
</script>

<template>
  <section aria-labelledby="titulo-configuracion">
    <h1 id="titulo-configuracion">
      Configuración contable
    </h1>
    <HudPestanas
      :pestanas="PESTANAS"
      etiqueta="Configuración contable"
    />
    <HudPanel :etiqueta="titulo">
      <ConfigGeneral
        v-if="pestana === 'general'"
        :entidad-id="id"
        :editable="editable"
      />
      <TiposComprobante
        v-else-if="pestana === 'tipos'"
        :entidad-id="id"
        :editable="editable"
      />
      <ReglasContables
        v-else-if="pestana === 'reglas'"
        :entidad-id="id"
        :editable="editable"
      />
      <RubrosEstados
        v-else-if="pestana === 'rubros'"
        :entidad-id="id"
        :editable="editable"
      />
      <NotasEstados
        v-else-if="pestana === 'notas'"
        :entidad-id="id"
        :editable="editable"
      />
      <PlantillasContables
        v-else
        :entidad-id="id"
        :editable="editable"
      />
    </HudPanel>
  </section>
</template>

<style scoped src="./contabilidad.css"></style>
