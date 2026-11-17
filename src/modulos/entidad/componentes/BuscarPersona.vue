<script setup lang="ts">
/** Busca una persona de la PH (`personas.ver`) con el selector común y emite la elegida. */
import { buscarPersonas } from '@/api/personas'
import type { Persona } from '@/api/tipos'
import SelectorPersona from '@/hud/componentes/SelectorPersona.vue'

const props = withDefaults(defineProps<{ copropiedadId: string; etiqueta?: string }>(), { etiqueta: 'Buscar persona' })
const emit = defineEmits<{ elegir: [persona: Persona] }>()

/** Las encontradas se recuerdan para emitir la persona completa. */
const vistas = new Map<string, Persona>()

async function buscar(q: string) {
  const { datos } = await buscarPersonas(props.copropiedadId, q)
  datos.forEach((p) => vistas.set(p.id, p))
  return datos.map((p) => ({ id: p.id, nombre: p.nombre, detalle: [p.tipo_documento, p.documento ?? 'Sin documento'].filter(Boolean).join(' ') }))
}

function elegir(o: { id: string }) {
  const p = vistas.get(o.id)
  if (p) emit('elegir', p)
}
</script>

<template>
  <SelectorPersona
    :etiqueta="etiqueta"
    :buscar="buscar"
    @elegir="elegir"
  />
</template>
