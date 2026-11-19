<script setup lang="ts">
/** Elegir un tercero (búsqueda por nombre o documento); el elegido se muestra con «Cambiar» y se recuerda en la sesión. */
import { buscarTerceros } from '@/api/contabilidad'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import SelectorPersona, { type OpcionPersona } from '@/hud/componentes/SelectorPersona.vue'
import { useTercerosConocidos } from '@/stores/terceros'

const props = withDefaults(defineProps<{ entidadId: string; etiqueta?: string; opcional?: boolean }>(), { etiqueta: 'Tercero', opcional: false })
const tercero = defineModel<OpcionPersona | null>({ required: true })

const conocidos = useTercerosConocidos()

async function buscar(q: string): Promise<OpcionPersona[]> {
  const r = await buscarTerceros(props.entidadId, q)
  const lista = r.datos.map((x) => ({ id: x.persona_id, nombre: x.nombre, detalle: [x.tipo_documento, x.documento].filter(Boolean).join(' ') || null }))
  conocidos.recordar(lista)
  return lista
}
</script>

<template>
  <div class="elegir-tercero">
    <SelectorPersona
      v-if="!tercero"
      :etiqueta="`${etiqueta}${opcional ? ' (opcional)' : ''}`"
      :buscar="buscar"
      @elegir="(p) => (tercero = p)"
    />
    <p
      v-else
      class="elegido"
    >
      <span><small>{{ etiqueta }}</small> <strong>{{ tercero.nombre }}</strong><template v-if="tercero.detalle"> · {{ tercero.detalle }}</template></span>
      <HudBoton
        variante="fantasma"
        @click="tercero = null"
      >
        Cambiar<span class="solo-lector"> {{ etiqueta.toLowerCase() }}</span>
      </HudBoton>
    </p>
  </div>
</template>

<style scoped>
.elegir-tercero {
  min-width: 0;
}

.elegido {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  padding: 6px 10px;
  border: 1px solid var(--linea-fuerte);
}

small {
  display: block;
  color: var(--texto-3);
}
</style>
