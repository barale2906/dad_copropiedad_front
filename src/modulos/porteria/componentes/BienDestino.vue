<script setup lang="ts">
/**
 * Bien al que va la visita o el paquete: búsqueda por código (la portería no tiene «propios»).
 * La búsqueda exige `bienes_privados.ver`, que la plantilla «vigilante» no trae (solicitud S15).
 */
import { computed, watch } from 'vue'
import SelectorBien from '@/hud/componentes/SelectorBien.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'

withDefaults(defineProps<{ etiqueta?: string; error?: string | null }>(), { etiqueta: 'Apartamento o bien', error: null })
const bienId = defineModel<string>({ required: true })
const bienes = useBienes()
const entidad = useEntidad()
const puedeBuscar = computed(() => entidad.tienePermiso('bienes_privados.ver'))
const buscar = async (q: string) => (await bienes.buscar(q)).datos

watch(bienId, (b) => b && bienes.resolver([b]), { immediate: true })
</script>

<template>
  <SelectorBien
    v-model="bienId"
    :etiqueta="etiqueta"
    :buscar="puedeBuscar ? buscar : undefined"
    :codigo-elegido="bienId ? bienes.codigo(bienId) : null"
    :error="error"
    sin-bienes="Su rol no puede buscar apartamentos. Pida a la administración el permiso «Ver bienes privados»."
  />
</template>
