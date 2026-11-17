<script setup lang="ts">
/** Configuración del control de acceso: plazos y avisos, puntos, puentes y dispositivos. */
import { computed, ref } from 'vue'
import type { Puente, PuntoAcceso } from '@/api/tipos'
import { usePestana } from '@/composables/usePestana'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import { useEntidad } from '@/stores/entidad'
import ConfigDispositivos from '../componentes/ConfigDispositivos.vue'
import ConfigGeneral from '../componentes/ConfigGeneral.vue'
import ConfigPuentes from '../componentes/ConfigPuentes.vue'
import ConfigPuntos from '../componentes/ConfigPuntos.vue'

const PESTANAS = [
  { id: 'general', texto: 'Plazos y avisos' },
  { id: 'equipos', texto: 'Puntos y equipos' },
] as const

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const pestana = usePestana(PESTANAS)
const puntos = ref<PuntoAcceso[]>([])
const puentes = ref<Puente[]>([])
</script>

<template>
  <section aria-labelledby="titulo-configuracion">
    <h1 id="titulo-configuracion">
      Puntos y puentes
    </h1>
    <HudPestanas
      :pestanas="PESTANAS"
      etiqueta="Configuración del control de acceso"
    />
    <ConfigGeneral
      v-if="pestana === 'general'"
      :entidad-id="id"
      :zona="entidad.zonaHoraria"
    />
    <template v-else>
      <ConfigPuntos
        :entidad-id="id"
        @cambio="(p) => (puntos = p)"
      />
      <ConfigPuentes
        :entidad-id="id"
        :zona="entidad.zonaHoraria"
        @cambio="(p) => (puentes = p)"
      />
      <ConfigDispositivos
        :entidad-id="id"
        :puentes="puentes"
        :puntos="puntos"
      />
    </template>
  </section>
</template>

<style scoped src="./porteria.css"></style>
