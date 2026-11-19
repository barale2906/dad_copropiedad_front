<script setup lang="ts">
/** Elegir el tercero de un documento de tesorería (busca y, con permiso, lo crea en línea). */
import { useBuscarTerceros } from '@/composables/useBuscarTerceros'
import type { OpcionPersona } from '@/hud/componentes/SelectorPersona.vue'
import SelectorTercero from '@/hud/componentes/SelectorTercero.vue'

const props = withDefaults(defineProps<{ entidadId: string; etiqueta?: string; opcional?: boolean }>(), { etiqueta: 'Tercero', opcional: false })
const tercero = defineModel<OpcionPersona | null>({ required: true })

const { buscar, crearSiPuede } = useBuscarTerceros(() => props.entidadId)
</script>

<template>
  <SelectorTercero
    v-model="tercero"
    :buscar="buscar"
    :crear="crearSiPuede"
    :etiqueta="etiqueta"
    :opcional="opcional"
  />
</template>
