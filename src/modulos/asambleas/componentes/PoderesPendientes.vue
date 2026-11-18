<script setup lang="ts">
/** Poderes registrados por revisar: ver el soporte, verificar o rechazar con motivo. */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Poder } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useAdjuntos } from '@/composables/useAdjuntos'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import { poderes, revisarPoder } from '../api'
import { ESTADO_PODER } from '../reglas'

const props = defineProps<{ entidadId: string; reunionId: string; codigos: Record<string, string> }>()
const emit = defineEmits<{ cambio: [texto: string] }>()

const lista = ref<Poder[]>([])
const error = ref<string | null>(null)
const pendientes = computed(() => lista.value.filter((p) => p.estado === 'pendiente'))
const rechazando = ref<Poder | null>(null)
const abiertoRechazo = computed({ get: () => !!rechazando.value, set: (si: boolean) => !si && (rechazando.value = null) })
const archivos = useAdjuntos(() => props.entidadId)
const revisar = useAccion((_c, p: Poder, estado: 'verificado' | 'rechazado', motivo?: string) => revisarPoder(props.entidadId, props.reunionId, p.id, estado, motivo))
const codigo = (p: Poder) => props.codigos[p.bien_privado_id] ?? 'Bien'

async function verificar(p: Poder) {
  if (!(await revisar.ejecutar(p, 'verificado')).ok) return
  emit('cambio', `Poder de ${codigo(p)} verificado.`)
  await cargar()
}

async function rechazar(motivo: string) {
  const p = rechazando.value
  if (!p || !(await revisar.ejecutar(p, 'rechazado', motivo)).ok) return
  rechazando.value = null
  emit('cambio', `Poder de ${codigo(p)} rechazado: el bien deja de contar para ese asistente.`)
  await cargar()
}

async function cargar() {
  try {
    lista.value = await poderes(props.entidadId, props.reunionId)
    error.value = null
  } catch (e) {
    error.value = mensajeDeError(e)
  }
}

onMounted(cargar)
defineExpose({ cargar })
</script>

<template>
  <div class="campos">
    <p
      v-if="error || revisar.error.value || archivos.error.value"
      class="error"
      role="alert"
    >
      {{ error ?? revisar.error.value ?? archivos.error.value }}
    </p>
    <p
      v-if="pendientes.length === 0"
      class="texto-2"
    >
      No hay poderes por revisar.
    </p>
    <ul
      v-else
      class="lista"
      aria-label="Poderes por revisar"
    >
      <li
        v-for="p in pendientes"
        :key="p.id"
      >
        <HudInsignia :tono="ESTADO_PODER[p.estado].tono">
          {{ ESTADO_PODER[p.estado].texto }}
        </HudInsignia>
        <span class="crece"><strong>Poder de {{ codigo(p) }}</strong></span>
        <div class="botones">
          <HudBoton
            v-if="p.soporte_archivo_id"
            variante="fantasma"
            @click="archivos.abrir(p.soporte_archivo_id)"
          >
            Ver soporte<span class="solo-lector"> de {{ codigo(p) }}</span>
          </HudBoton>
          <HudBoton
            variante="secundario"
            :cargando="revisar.cargando.value"
            @click="verificar(p)"
          >
            Verificar<span class="solo-lector"> poder de {{ codigo(p) }}</span>
          </HudBoton>
          <HudBoton
            variante="fantasma"
            @click="rechazando = p"
          >
            Rechazar<span class="solo-lector"> poder de {{ codigo(p) }}</span>
          </HudBoton>
        </div>
      </li>
    </ul>
    <ConfirmarConMotivo
      v-model:abierto="abiertoRechazo"
      titulo="Rechazar el poder"
      accion="Rechazar"
      :cargando="revisar.cargando.value"
      :error="revisar.error.value"
      @confirmar="rechazar"
    />
  </div>
</template>

<style scoped src="../vistas/asambleas.css"></style>
