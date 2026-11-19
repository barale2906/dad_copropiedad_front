<script setup lang="ts">
/** Elegir una unidad de la PH por su código (lista de la cartera). `v-model` = id del bien. */
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useCartera } from '../store'

withDefaults(defineProps<{ etiqueta?: string; error?: string | null; vacio?: string }>(), { etiqueta: 'Unidad', error: null, vacio: 'Elija la unidad' })
const bienId = defineModel<string>({ required: true })
const cartera = useCartera()
</script>

<template>
  <HudSelector
    v-model="bienId"
    :etiqueta="etiqueta"
    :vacio="vacio"
    :opciones="cartera.opcionesBien"
    :error="error"
  />
</template>
