<script setup lang="ts">
/** Elegir la persona sobre la que se trabaja (búsqueda) y mostrarla con «Cambiar». */
import SelectorPersona, { type OpcionPersona } from '@/hud/componentes/SelectorPersona.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import { opcionesPersona } from '../api'

const props = defineProps<{ entidadId: string }>()
const persona = defineModel<OpcionPersona | null>({ required: true })
const buscar = (q: string) => opcionesPersona(props.entidadId, q)
</script>

<template>
  <div
    v-if="persona"
    class="elegida"
  >
    <span>
      <strong>{{ persona.nombre }}</strong>
      <small v-if="persona.detalle"> · {{ persona.detalle }}</small>
    </span>
    <HudBoton
      variante="fantasma"
      @click="persona = null"
    >
      Cambiar de persona
    </HudBoton>
  </div>
  <SelectorPersona
    v-else
    :buscar="buscar"
    @elegir="(p) => (persona = p)"
  />
</template>

<style scoped>
.elegida {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid var(--cian);
  background: var(--cian-tenue);
}

small {
  color: var(--texto-2);
}
</style>
