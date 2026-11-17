<script setup lang="ts">
/**
 * Bien al que va la visita o el paquete: búsqueda por código con `…/acceso/bienes`, que solo
 * exige `acceso.registrar` (la plantilla «vigilante» no trae `bienes_privados.ver`).
 */
import SelectorBien from '@/hud/componentes/SelectorBien.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import { bienesPorteria } from '../api'

withDefaults(defineProps<{ etiqueta?: string; error?: string | null }>(), { etiqueta: 'Apartamento o bien', error: null })
const bienId = defineModel<string>({ required: true })
const entidad = useEntidad()
const bienes = useBienes()

async function buscar(q: string) {
  const { datos } = await bienesPorteria(entidad.activa?.entidad_id ?? '', q)
  bienes.recordar(datos)
  return datos
}
</script>

<template>
  <SelectorBien
    v-model="bienId"
    :etiqueta="etiqueta"
    :buscar="buscar"
    :codigo-elegido="bienId ? bienes.codigo(bienId) : null"
    :error="error"
  />
</template>
