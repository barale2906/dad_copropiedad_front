<script setup lang="ts">
/** Ficha completa de un anunciante y, en la PH, las reseñas de los vecinos. */
import { computed, ref, watch } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { FichaDirectorio } from '@/api/tipos'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import TarjetaAnunciante from '@/hud/componentes/TarjetaAnunciante.vue'
import { useEntidad } from '@/stores/entidad'
import { fichaAnunciante } from '../api'
import { useCategoriasDirectorio } from '../store'
import ResenasAnunciante from './ResenasAnunciante.vue'

const props = defineProps<{ entidadId: string; anuncianteId: string }>()

const entidad = useEntidad()
const categorias = useCategoriasDirectorio()

const ficha = ref<FichaDirectorio | null>(null)
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)

const nombresCategorias = computed(() =>
  ficha.value?.categorias.map((c) => categorias.nombre([c])).join(' · ') || undefined,
)

async function cargar(silencioso = false) {
  if (!silencioso) estado.value = 'cargando'
  try {
    ficha.value = await fichaAnunciante(props.entidadId, props.anuncianteId)
    estado.value = 'listo'
  } catch (e) {
    if (silencioso) return
    error.value =
      e instanceof ErrorApi && e.codigo === 'no_encontrado' ? 'Este comercio ya no aparece en el directorio de su entidad.' : mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
    estado.value = 'error'
  }
}

watch(() => props.anuncianteId, () => void cargar(), { immediate: true })
</script>

<template>
  <HudEstado
    v-if="estado === 'cargando'"
    estado="cargando"
  />
  <HudEstado
    v-else-if="estado === 'error'"
    estado="error"
    :mensaje="error ?? undefined"
    :referencia="referencia"
    @reintentar="cargar()"
  />
  <template v-else-if="ficha">
    <TarjetaAnunciante
      :ficha="ficha"
      :categoria="nombresCategorias"
      :nivel="1"
      completa
    />
    <ResenasAnunciante
      v-if="entidad.esPH"
      :entidad-id="entidadId"
      :anunciante-id="anuncianteId"
      :nombre="ficha.nombre_comercial"
      @guardada="cargar(true)"
    />
  </template>
</template>
