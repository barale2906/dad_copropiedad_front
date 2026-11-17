<script setup lang="ts">
/** Credenciales y autorizaciones de acceso por persona. */
import { computed, ref } from 'vue'
import type { OpcionPersona } from '@/hud/componentes/SelectorPersona.vue'
import { useEntidad } from '@/stores/entidad'
import PanelAutorizaciones from '../componentes/PanelAutorizaciones.vue'
import PanelCredenciales from '../componentes/PanelCredenciales.vue'
import PersonaElegida from '../componentes/PersonaElegida.vue'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const persona = ref<OpcionPersona | null>(null)
</script>

<template>
  <section aria-labelledby="titulo-credenciales">
    <h1 id="titulo-credenciales">
      Credenciales y autorizaciones
    </h1>
    <p class="texto-2">
      Tarjetas, PIN, QR y placas de cada persona, y los permisos para entrar. Por seguridad, el valor de una credencial nunca se vuelve a mostrar.
    </p>
    <PersonaElegida
      v-model="persona"
      :entidad-id="id"
    />
    <template v-if="persona">
      <PanelCredenciales
        :entidad-id="id"
        :persona-id="persona.id"
        :zona="entidad.zonaHoraria"
      />
      <PanelAutorizaciones
        :entidad-id="id"
        :persona-id="persona.id"
        :zona="entidad.zonaHoraria"
      />
    </template>
  </section>
</template>

<style scoped src="./porteria.css"></style>
