<script setup lang="ts">
/**
 * Después de convocar: constancias de envío con su acuse (prueba de la convocatoria) y los bienes
 * en mora (por códigos o planilla), que se pueden marcar hasta que la asamblea se instale.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Constancia, ResultadoMorosos } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import { constancias, marcarMorosos } from '../api'
import { constanciaEntregada, estadoConstancia } from '../reglas'

const props = defineProps<{ entidadId: string; reunionId: string; moraEditable: boolean }>()

const entidad = useEntidad()
const zona = computed(() => entidad.zonaHoraria)
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<Constancia[]>([])
const codigos = ref('')
const resultado = ref<ResultadoMorosos | null>(null)
const entregadas = computed(() => lista.value.filter(constanciaEntregada).length)

const morosos = useAccion(() =>
  marcarMorosos(
    props.entidadId,
    props.reunionId,
    codigos.value.split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter(Boolean),
  ),
)

async function guardarMorosos() {
  const r = await morosos.ejecutar()
  if (r.ok) resultado.value = r.valor
}

async function cargar() {
  try {
    lista.value = await constancias(props.entidadId, props.reunionId)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <HudPanel etiqueta="Constancias de la convocatoria">
    <HudEstado
      v-if="estado === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="estado === 'error'"
      estado="error"
      :mensaje="error ?? undefined"
      @reintentar="cargar"
    />
    <template v-else>
      <p class="texto-2">
        {{ entregadas }} de {{ lista.length }} envíos con acuse de entrega.
      </p>
      <ul
        class="lista"
        aria-label="Constancias de envío"
      >
        <li
          v-for="(c, i) in lista"
          :key="i"
        >
          <span class="crece">
            <strong>{{ c.nombre }}</strong>
            <small>{{ c.canal === 'whatsapp' ? 'WhatsApp' : 'Correo' }}{{ c.enviado_en ? ` · ${fechaHora(c.enviado_en, zona)}` : '' }}</small>
          </span>
          <HudInsignia :tono="estadoConstancia(c).tono">
            {{ estadoConstancia(c).texto }}
          </HudInsignia>
        </li>
      </ul>
    </template>
  </HudPanel>

  <HudPanel
    v-if="moraEditable"
    etiqueta="Bienes en mora"
  >
    <form
      class="campos"
      @submit.prevent="guardarMorosos"
    >
      <HudCampo
        v-model="codigos"
        etiqueta="Códigos de los bienes en mora"
        multilinea
        ayuda="Separe los códigos con espacios, comas o saltos de línea (T1-101, T2-302). Reemplaza la lista anterior."
      />
      <p
        v-if="resultado"
        class="ok"
        role="status"
      >
        {{ resultado.marcados }} bien(es) marcados en mora.{{ resultado.no_encontrados.length ? ` No se encontraron: ${resultado.no_encontrados.join(', ')}.` : '' }}
      </p>
      <p
        v-if="morosos.error.value"
        class="error"
        role="alert"
      >
        {{ morosos.error.value }}
      </p>
      <div class="botones">
        <HudBoton
          tipo="submit"
          variante="secundario"
          :cargando="morosos.cargando.value"
        >
          Marcar en mora
        </HudBoton>
      </div>
    </form>
  </HudPanel>
</template>

<style scoped src="../vistas/asambleas.css"></style>
