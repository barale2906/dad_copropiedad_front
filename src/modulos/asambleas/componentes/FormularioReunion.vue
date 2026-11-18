<script setup lang="ts">
/**
 * Datos y configuración de una asamblea: tipo, modalidad, fecha y lugar; poderes por apoderado,
 * soporte de los poderes, efecto de la mora, base de cómputo y temporizador de votación. Avisa
 * si una ordinaria no tiene los 15 días de antelación (art. 39).
 */
import { computed, ref } from 'vue'
import type { BaseComputo, EfectoMora, Modalidad, NuevaReunion, Reunion, TipoReunion } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { aLocal, aUtc, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { ANTELACION_ORDINARIA_DIAS, antelacionSuficiente, BASE_COMPUTO, EFECTO_MORA, MODALIDAD, TIPO_REUNION } from '../reglas'

const props = withDefaults(defineProps<{ reunion?: Reunion | null; cargando?: boolean; error?: string | null; accion?: string }>(), {
  reunion: null,
  cargando: false,
  error: null,
  accion: 'Guardar',
})
const emit = defineEmits<{ guardar: [datos: NuevaReunion] }>()

const entidad = useEntidad()
const zona = computed(() => entidad.zonaHoraria)
const local = (utc?: string | null) => (utc ? aLocal(utc, zona.value) : '')

const r = props.reunion
const titulo = ref(r?.titulo ?? '')
const tipo = ref<TipoReunion>(r?.tipo ?? 'ordinaria')
const modalidad = ref<Modalidad>(r?.modalidad ?? 'presencial')
const fecha = ref(local(r?.fecha_programada))
const lugar = ref(r?.lugar ?? '')
const enlace = ref(r?.enlace_video ?? '')
const maxBienes = ref(r?.configuracion.max_bienes_apoderado ? String(r.configuracion.max_bienes_apoderado) : '')
const soporte = ref(r?.configuracion.exigir_soporte_poder ?? true)
const mora = ref<EfectoMora>(r?.configuracion.efecto_mora ?? 'informativo')
const base = ref<BaseComputo>(r?.configuracion.base_computo ?? 'coeficiente')
const temporizador = ref(r?.configuracion.temporizador_segundos ? String(r.configuracion.temporizador_segundos) : '')
const intentado = ref(false)

const errores = computed(() => ({
  titulo: intentado.value && !titulo.value.trim() ? 'Escriba el título.' : null,
  fecha: intentado.value && !fecha.value ? 'Elija la fecha y la hora.' : null,
  maxBienes: maxBienes.value && !/^[1-9]\d*$/.test(maxBienes.value) ? 'Un número entero mayor que cero.' : null,
  temporizador: temporizador.value && !/^[1-9]\d*$/.test(temporizador.value) ? 'Segundos, un número entero.' : null,
}))
const avisoAntelacion = computed(() =>
  fecha.value && !antelacionSuficiente(tipo.value, hoyEn(zona.value), fecha.value.slice(0, 10))
    ? tipo.value === 'ordinaria'
      ? `Una asamblea ordinaria se convoca con al menos ${ANTELACION_ORDINARIA_DIAS} días calendario de anticipación (art. 39): con esta fecha el sistema no la dejará convocar hoy.`
      : 'La fecha ya pasó.'
    : null,
)

function enviar() {
  intentado.value = true
  if (Object.values(errores.value).some(Boolean)) return
  emit('guardar', {
    titulo: titulo.value.trim(),
    tipo: tipo.value,
    modalidad: modalidad.value,
    fecha_programada: aUtc(fecha.value, zona.value),
    lugar: lugar.value.trim() || null,
    enlace_video: enlace.value.trim() || null,
    configuracion: {
      max_bienes_apoderado: maxBienes.value ? parseInt(maxBienes.value, 10) : null,
      exigir_soporte_poder: soporte.value,
      efecto_mora: mora.value,
      base_computo: base.value,
      temporizador_segundos: temporizador.value ? parseInt(temporizador.value, 10) : null,
    },
  })
}
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
    <div class="filtros">
      <HudSelector
        v-model="tipo"
        etiqueta="Tipo"
        :opciones="opcionesDe(TIPO_REUNION)"
      />
      <HudSelector
        v-model="modalidad"
        etiqueta="Modalidad"
        :opciones="opcionesDe(MODALIDAD)"
      />
      <HudFecha
        v-model="fecha"
        etiqueta="Fecha y hora"
        con-hora
        :error="errores.fecha"
      />
    </div>
    <p
      v-if="avisoAntelacion"
      class="aviso"
    >
      {{ avisoAntelacion }}
    </p>
    <HudCampo
      v-if="modalidad !== 'virtual' && modalidad !== 'escrita'"
      v-model="lugar"
      etiqueta="Lugar"
      autocompletar="off"
    />
    <HudCampo
      v-if="modalidad === 'virtual' || modalidad === 'mixta'"
      v-model="enlace"
      etiqueta="Enlace de la videollamada"
      tipo="url"
      autocompletar="off"
    />
    <div
      class="config"
      role="group"
      aria-labelledby="titulo-reglas"
    >
      <p
        id="titulo-reglas"
        class="leyenda"
      >
        Reglas de la asamblea
      </p>
      <HudSelector
        v-model="base"
        etiqueta="Las votaciones se cuentan"
        :opciones="opcionesDe(BASE_COMPUTO)"
      />
      <HudSelector
        v-model="mora"
        etiqueta="Los bienes en mora"
        :opciones="opcionesDe(EFECTO_MORA)"
      />
      <HudCampo
        v-model="maxBienes"
        etiqueta="Máximo de bienes por apoderado (opcional)"
        modo-entrada="numeric"
        :error="errores.maxBienes"
      />
      <label class="casilla">
        <input
          v-model="soporte"
          type="checkbox"
        > Exigir el soporte escrito de cada poder
      </label>
      <HudCampo
        v-model="temporizador"
        etiqueta="Tiempo para votar cada pregunta, en segundos (opcional)"
        modo-entrada="numeric"
        :error="errores.temporizador"
      />
    </div>
    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
    <div class="botones">
      <HudBoton
        tipo="submit"
        :cargando="cargando"
      >
        {{ accion }}
      </HudBoton>
    </div>
  </form>
</template>

<style scoped src="../vistas/asambleas.css"></style>
<style scoped>
.config {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  margin: 0;
  padding: 12px;
  border: 1px solid var(--linea);
}

.leyenda {
  margin: 0;
  color: var(--texto-2);
}
</style>
