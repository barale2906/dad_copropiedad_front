<script setup lang="ts">
/**
 * Reseñas de un anunciante en la PH (anónimas): la lista, la reseña propia (una por cuenta, se
 * puede cambiar) y reportar las de otros a la moderación de la plataforma.
 */
import { computed, ref, watch } from 'vue'
import type { Resena } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { fecha } from '@/formato/fechas'
import CalificacionEstrellas from '@/hud/componentes/CalificacionEstrellas.vue'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import ElegirCalificacion from '@/hud/componentes/ElegirCalificacion.vue'
import HiloMensajes, { type MensajeHilo } from '@/hud/componentes/HiloMensajes.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import { guardarResena, reportarResena, resenas } from '../api'

const props = defineProps<{ entidadId: string; anuncianteId: string; nombre: string }>()
const emit = defineEmits<{ guardada: [] }>()

const entidad = useEntidad()
const listado = useListado((despues) => resenas(props.entidadId, props.anuncianteId, despues))

const calificacion = ref(0)
const texto = ref('')
const intentado = ref(false)
const resultado = ref<string | null>(null)
const reportando = ref<Resena | null>(null)
const dialogoReporte = ref(false)

const puedeResenar = computed(() => entidad.tienePermiso('directorio.resenar'))
const propia = computed(() => listado.filas.value.find((r) => r.propia) ?? null)
const errorCalificacion = computed(() => (intentado.value && calificacion.value < 1 ? 'Elija de 1 a 5 estrellas.' : null))
const errorTexto = computed(() => (texto.value.length > 1000 ? 'Use máximo 1000 caracteres.' : null))
const mensajes = computed<MensajeHilo[]>(() =>
  listado.filas.value.map((r) => ({
    id: r.id,
    texto: r.texto ?? '',
    autor: r.propia ? 'Su reseña' : 'Vecino',
    hora: fecha(r.actualizada_en, entidad.zonaHoraria),
    propio: r.propia,
  })),
)
const porId = (id: string) => listado.filas.value.find((r) => r.id === id)

const guardar = useAccion(
  () => guardarResena(props.entidadId, props.anuncianteId, { calificacion: calificacion.value, texto: texto.value }),
  {
    alExito: () => {
      resultado.value = 'Su reseña quedó publicada.'
      void listado.recargar()
      emit('guardada')
    },
  },
)
const errorGuardar = computed(() =>
  guardar.codigo.value === 'conflicto'
    ? 'La moderación ocultó su reseña anterior de este comercio, así que no puede publicar otra.'
    : guardar.error.value,
)

const reportar = useAccion((_clave, resenaId: string, motivo: string) => reportarResena(props.entidadId, resenaId, motivo), {
  alExito: (nuevo) => {
    dialogoReporte.value = false
    resultado.value = nuevo ? 'Gracias: la moderación revisará la reseña.' : 'Ya había reportado esta reseña.'
  },
})

// Al llegar la reseña propia, el formulario parte de ella.
watch(propia, (r) => {
  if (!r) return
  calificacion.value = r.calificacion
  texto.value = r.texto ?? ''
})

function enviar() {
  intentado.value = true
  resultado.value = null
  if (errorCalificacion.value || errorTexto.value) return
  void guardar.ejecutar()
}

function confirmarReporte(motivo: string) {
  if (reportando.value) void reportar.ejecutar(reportando.value.id, motivo.slice(0, 500))
}

function abrirReporte(id: string) {
  reportando.value = porId(id) ?? null
  reportar.reiniciar()
  dialogoReporte.value = true
}
</script>

<template>
  <section
    class="resenas"
    aria-labelledby="titulo-resenas"
  >
    <h2 id="titulo-resenas">
      Reseñas de los vecinos
    </h2>
    <p class="texto-2">
      Son anónimas: el comercio y los demás vecinos no ven quién las escribió.
    </p>

    <HudPanel
      v-if="puedeResenar"
      :etiqueta="propia ? 'Cambiar su reseña' : 'Escribir una reseña'"
    >
      <form
        class="formulario"
        novalidate
        @submit.prevent="enviar"
      >
        <ElegirCalificacion
          v-model="calificacion"
          :etiqueta="`¿Cómo califica a ${nombre}?`"
          :error="errorCalificacion"
        />
        <HudCampo
          v-model="texto"
          etiqueta="Comentario (opcional)"
          multilinea
          :maximo="1000"
          :error="errorTexto"
          ayuda="Cuente su experiencia sin datos personales."
        />
        <div>
          <HudBoton
            tipo="submit"
            :cargando="guardar.cargando.value"
          >
            {{ propia ? 'Guardar cambios' : 'Publicar reseña' }}
          </HudBoton>
        </div>
        <p
          v-if="errorGuardar"
          class="error"
          role="alert"
        >
          {{ errorGuardar }}
        </p>
      </form>
    </HudPanel>

    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

    <HudEstado
      v-if="listado.estado.value === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="listado.estado.value === 'error'"
      estado="error"
      :mensaje="listado.error.value ?? undefined"
      :referencia="listado.referencia.value"
      @reintentar="listado.recargar()"
    />
    <template v-else>
      <HiloMensajes
        :mensajes="mensajes"
        etiqueta="Reseñas"
        vacio="Aún no hay reseñas en su conjunto. ¡Sea el primero!"
      >
        <template #pie="{ mensaje }">
          <CalificacionEstrellas :valor="porId(mensaje.id)?.calificacion ?? null" />
          <HudBoton
            v-if="!mensaje.propio"
            variante="fantasma"
            @click="abrirReporte(mensaje.id)"
          >
            Reportar<span class="solo-lector"> la reseña del {{ mensaje.hora }}</span>
          </HudBoton>
        </template>
      </HiloMensajes>
      <HudCargarMas
        :hay-mas="listado.hayMas.value"
        :cargando="listado.cargando.value"
        @cargar="listado.cargarMas()"
      />
    </template>

    <ConfirmarConMotivo
      v-model:abierto="dialogoReporte"
      titulo="Reportar reseña"
      accion="Reportar"
      descripcion="La moderación de la plataforma la revisará. Diga por qué no debería publicarse."
      :cargando="reportar.cargando.value"
      :error="reportar.error.value"
      @confirmar="confirmarReporte"
    />
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
.formulario {
  display: grid;
  gap: 14px;
}
</style>
