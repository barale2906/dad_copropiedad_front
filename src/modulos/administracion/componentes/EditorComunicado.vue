<script setup lang="ts">
/**
 * Redactar un comunicado (nuevo o borrador): título, contenido, **finalidad** (Ley 1581: las
 * comunicaciones generales solo llegan a quien las autorizó), audiencia, importante y si pide
 * «Enterado», y adjuntos. Guarda como borrador; publicar se hace desde el detalle.
 */
import { computed, onMounted, ref } from 'vue'
import type { Audiencia, Comunicado, FinalidadTratamiento } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useAdjuntos } from '@/composables/useAdjuntos'
import HudAdjuntos from '@/hud/componentes/HudAdjuntos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import SelectorAudiencia, { type OpcionAudiencia } from '@/hud/componentes/SelectorAudiencia.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import { agrupacionesAudiencia, crearComunicado, editarComunicado, rolesAudiencia } from '../api'
import { audienciaCompleta, FINALIDAD } from '../reglas'

const props = defineProps<{ entidadId: string; comunicado?: Comunicado | null }>()
const emit = defineEmits<{ guardado: [c: Comunicado]; cancelar: [] }>()

const entidad = useEntidad()
const bienes = useBienes()
const titulo = ref(props.comunicado?.titulo ?? '')
const cuerpo = ref(props.comunicado?.cuerpo ?? '')
const finalidad = ref<Extract<FinalidadTratamiento, 'administracion' | 'comunicaciones'>>(
  props.comunicado?.finalidad === 'comunicaciones' ? 'comunicaciones' : 'administracion',
)
const audiencia = ref<Audiencia>(props.comunicado?.audiencia ?? { tipo: 'todos', ids: [] })
const importante = ref(props.comunicado?.importante ?? false)
const confirmacion = ref(props.comunicado?.requiere_confirmacion ?? false)
const adjuntos = useAdjuntos(() => props.entidadId, 'interno')
const agrupaciones = ref<OpcionAudiencia[]>([])
const roles = ref<OpcionAudiencia[]>([])
const intentado = ref(false)

const buscarBien = computed(() =>
  entidad.tienePermiso('bienes_privados.ver') ? async (q: string) => (await bienes.buscar(q)).datos : undefined,
)
const errores = computed(() => ({
  titulo: intentado.value && !titulo.value.trim() ? 'Escriba el título.' : null,
  cuerpo: intentado.value && !cuerpo.value.trim() ? 'Escriba el contenido.' : null,
  audiencia: intentado.value && !audienciaCompleta(audiencia.value) ? 'Elija al menos un destinatario de la lista.' : null,
}))

const guardar = useAccion((clave) => {
  const datos = {
    titulo: titulo.value.trim(),
    cuerpo: cuerpo.value.trim(),
    finalidad: finalidad.value,
    audiencia: audiencia.value,
    importante: importante.value,
    requiere_confirmacion: confirmacion.value,
    adjuntos: [...(props.comunicado?.adjuntos ?? []), ...adjuntos.ids()],
  }
  return props.comunicado ? editarComunicado(props.entidadId, props.comunicado.id, datos) : crearComunicado(props.entidadId, datos, clave)
})

async function enviar() {
  intentado.value = true
  if (errores.value.titulo || errores.value.cuerpo || errores.value.audiencia) return
  const r = await guardar.ejecutar()
  if (r.ok) emit('guardado', r.valor)
}

onMounted(async () => {
  const [a, r] = await Promise.all([
    entidad.tienePermiso('bienes_privados.ver') ? agrupacionesAudiencia(props.entidadId).catch(() => []) : [],
    entidad.tienePermiso('roles.ver') ? rolesAudiencia(props.entidadId).catch(() => []) : [],
  ])
  agrupaciones.value = a
  roles.value = r
})
</script>

<template>
  <form
    class="campos"
    novalidate
    @submit.prevent="enviar"
  >
    <HudCampo
      v-model="titulo"
      etiqueta="Título"
      autocompletar="off"
      :error="errores.titulo"
    />
    <HudCampo
      v-model="cuerpo"
      etiqueta="Contenido"
      multilinea
      :error="errores.cuerpo"
    />
    <fieldset class="opciones-radio">
      <legend>Finalidad</legend>
      <label
        v-for="(f, clave) in FINALIDAD"
        :key="clave"
      >
        <input
          v-model="finalidad"
          type="radio"
          name="finalidad"
          :value="clave"
        >
        <span>
          <strong>{{ f.texto }}</strong><br>
          <small>{{ f.ayuda }}</small>
        </span>
      </label>
    </fieldset>
    <SelectorAudiencia
      v-model="audiencia"
      :agrupaciones="agrupaciones"
      :roles="roles"
      :buscar-bien="buscarBien"
      :codigos="bienes.codigos"
      :error="errores.audiencia"
    />
    <label class="casilla">
      <input
        v-model="importante"
        type="checkbox"
      > Importante (también sale por WhatsApp a quien no tiene la app)
    </label>
    <label class="casilla">
      <input
        v-model="confirmacion"
        type="checkbox"
      > Pedir «Enterado» a cada destinatario
    </label>
    <div>
      <p class="texto-2">
        Adjuntos (opcional)
      </p>
      <HudAdjuntos
        :adjuntos="adjuntos.adjuntos.value"
        acepta="image/*,application/pdf"
        :subiendo="adjuntos.subiendo.value"
        @subir="adjuntos.subir"
        @abrir="adjuntos.abrir"
        @quitar="adjuntos.quitar"
      />
    </div>
    <p
      v-if="guardar.error.value || adjuntos.error.value"
      class="error"
      role="alert"
    >
      {{ guardar.error.value ?? adjuntos.error.value }}
    </p>
    <div class="botones">
      <HudBoton
        tipo="submit"
        :cargando="guardar.cargando.value"
        :deshabilitado="adjuntos.subiendo.value"
      >
        Guardar borrador
      </HudBoton>
      <HudBoton
        variante="fantasma"
        @click="emit('cancelar')"
      >
        Cancelar
      </HudBoton>
    </div>
  </form>
</template>

<style scoped src="../vistas/administracion.css"></style>
