<script setup lang="ts">
/**
 * Un comunicado: contenido, audiencia y entrega (canales, lecturas y «Enterado»). Según su
 * estado: editar y publicar (ya o programado) un borrador, retirar un programado o anularlo.
 * Lo enviado no se anula.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { ComunicadoConResumen } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { aUtc, fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import { anularComunicado, comunicado, publicarComunicado, retirarComunicado } from '../api'
import { accionesComunicado, ESTADO_COMUNICADO, FINALIDAD, resumenLectura, TIPO_AUDIENCIA } from '../reglas'
import EditorComunicado from './EditorComunicado.vue'

const props = defineProps<{ entidadId: string; comunicadoId: string }>()

const entidad = useEntidad()
const zona = computed(() => entidad.zonaHoraria)
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const datos = ref<ComunicadoConResumen | null>(null)
const editando = ref(false)
const resultado = ref<string | null>(null)
const c = computed(() => datos.value?.comunicado ?? null)
const acciones = computed(() => (c.value ? accionesComunicado(c.value.estado) : []))

const publicando = ref(false)
const cuando = ref<'ya' | 'programado'>('ya')
const programado = ref('')
const errorProgramado = ref<string | null>(null)
const anulando = ref(false)

const publicar = useAccion(() =>
  publicarComunicado(props.entidadId, props.comunicadoId, cuando.value === 'programado' ? aUtc(programado.value, zona.value) : null),
)
const retirar = useAccion(() => retirarComunicado(props.entidadId, props.comunicadoId))
const anular = useAccion(() => anularComunicado(props.entidadId, props.comunicadoId), { alConflicto: () => cargar() })

async function confirmarPublicacion() {
  errorProgramado.value = cuando.value === 'programado' && !programado.value ? 'Elija la fecha y la hora.' : null
  if (errorProgramado.value) return
  const r = await publicar.ejecutar()
  if (!r.ok) return
  publicando.value = false
  resultado.value = r.valor.estado === 'programado' ? `Programado para ${fechaHora(r.valor.programado_para ?? '', zona.value)}.` : 'Comunicado enviado.'
  await cargar()
}

async function hacer(que: 'retirar' | 'anular') {
  const r = await (que === 'retirar' ? retirar : anular).ejecutar()
  anulando.value = false
  if (!r.ok) return
  resultado.value = que === 'retirar' ? 'Se retiró la programación: quedó como borrador.' : 'Comunicado anulado.'
  await cargar()
}

async function guardado() {
  editando.value = false
  resultado.value = 'Borrador guardado.'
  await cargar()
}

async function cargar() {
  try {
    datos.value = await comunicado(props.entidadId, props.comunicadoId)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <HudEstado
    v-if="estado === 'cargando'"
    estado="cargando"
  />
  <HudEstado
    v-else-if="estado === 'error' || !c || !datos"
    estado="error"
    :mensaje="error ?? undefined"
    @reintentar="cargar"
  />
  <template v-else>
    <header class="encabezado">
      <h1>{{ c.titulo }}</h1>
      <HudInsignia :tono="ESTADO_COMUNICADO[c.estado].tono">
        {{ ESTADO_COMUNICADO[c.estado].texto }}
      </HudInsignia>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-for="e in [retirar.error.value, anular.error.value].filter(Boolean)"
      :key="e ?? ''"
      class="error"
      role="alert"
    >
      {{ e }}
    </p>

    <HudPanel
      v-if="editando"
      etiqueta="Editar el borrador"
    >
      <EditorComunicado
        :entidad-id="entidadId"
        :comunicado="c"
        @guardado="guardado"
        @cancelar="editando = false"
      />
    </HudPanel>
    <HudPanel
      v-else
      etiqueta="Comunicado"
    >
      <p class="cuerpo">
        {{ c.cuerpo }}
      </p>
      <dl class="datos">
        <div><dt>Finalidad</dt><dd>{{ c.finalidad === 'comunicaciones' ? FINALIDAD.comunicaciones.texto : FINALIDAD.administracion.texto }}</dd></div>
        <div><dt>Destinatarios</dt><dd>{{ TIPO_AUDIENCIA[c.audiencia.tipo] }}{{ c.audiencia.ids?.length ? ` (${c.audiencia.ids.length})` : '' }}</dd></div>
        <div><dt>Importante</dt><dd>{{ c.importante ? 'Sí' : 'No' }}</dd></div>
        <div v-if="c.programado_para">
          <dt>Programado</dt><dd>{{ fechaHora(c.programado_para, zona) }}</dd>
        </div>
        <div v-if="c.enviado_en">
          <dt>Enviado</dt><dd>{{ fechaHora(c.enviado_en, zona) }}</dd>
        </div>
      </dl>
      <div
        v-if="acciones.length"
        class="botones acciones"
      >
        <HudBoton
          v-if="acciones.includes('publicar')"
          @click="publicando = true"
        >
          Publicar
        </HudBoton>
        <HudBoton
          v-if="acciones.includes('editar')"
          variante="secundario"
          @click="editando = true"
        >
          Editar
        </HudBoton>
        <HudBoton
          v-if="acciones.includes('retirar')"
          variante="secundario"
          :cargando="retirar.cargando.value"
          @click="hacer('retirar')"
        >
          Retirar la programación
        </HudBoton>
        <HudBoton
          v-if="acciones.includes('anular')"
          variante="fantasma"
          @click="anulando = true"
        >
          Anular
        </HudBoton>
      </div>
    </HudPanel>

    <HudPanel
      v-if="c.estado === 'enviado'"
      etiqueta="Entrega y lectura"
    >
      <p class="texto-2">
        {{ resumenLectura(datos.resumen) }}{{ c.requiere_confirmacion ? ` · ${datos.resumen.enterados} confirmaron «Enterado»` : '' }}
      </p>
      <dl class="datos">
        <div><dt>Destinatarios</dt><dd>{{ datos.resumen.destinatarios }}</dd></div>
        <div><dt>Por la app</dt><dd>{{ datos.resumen.por_push }}</dd></div>
        <div><dt>Por correo</dt><dd>{{ datos.resumen.por_correo }}</dd></div>
        <div><dt>Por WhatsApp</dt><dd>{{ datos.resumen.por_whatsapp }}</dd></div>
        <div><dt>Sin canal</dt><dd>{{ datos.resumen.sin_canal }}</dd></div>
      </dl>
    </HudPanel>

    <HudDialogo
      v-model:abierto="publicando"
      titulo="Publicar el comunicado"
    >
      <form
        id="formulario-publicar"
        class="campos"
        @submit.prevent="confirmarPublicacion"
      >
        <fieldset class="opciones-radio">
          <legend>¿Cuándo?</legend>
          <label>
            <input
              v-model="cuando"
              type="radio"
              name="cuando"
              value="ya"
            > Enviar ahora
          </label>
          <label>
            <input
              v-model="cuando"
              type="radio"
              name="cuando"
              value="programado"
            > Programar
          </label>
        </fieldset>
        <HudFecha
          v-if="cuando === 'programado'"
          v-model="programado"
          etiqueta="Fecha y hora de envío"
          con-hora
          :error="errorProgramado"
        />
        <p
          v-if="publicar.error.value"
          class="error"
          role="alert"
        >
          {{ publicar.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="publicando = false"
        >
          Volver
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-publicar"
          :cargando="publicar.cargando.value"
        >
          {{ cuando === 'ya' ? 'Enviar ahora' : 'Programar' }}
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="anulando"
      titulo="Anular el comunicado"
    >
      <p>Quedará anulado y no se enviará. Esta acción no se puede deshacer.</p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="anulando = false"
        >
          Volver
        </HudBoton>
        <HudBoton
          :cargando="anular.cargando.value"
          @click="hacer('anular')"
        >
          Anular
        </HudBoton>
      </template>
    </HudDialogo>
  </template>
</template>

<style scoped src="../vistas/administracion.css"></style>
<style scoped>
.cuerpo {
  margin: 0 0 12px;
  white-space: pre-wrap;
}

.acciones {
  margin-top: 14px;
}
</style>
