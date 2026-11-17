<script setup lang="ts">
/**
 * Datos y política de un recurso reservable (crear o editar). Solo presenta y emite; el padre
 * llama a la API. Los números de la política se validan con `validarPolitica`.
 */
import { computed, ref, watch } from 'vue'
import type { CategoriaBienComun, PoliticaReserva, Recurso } from '@/api/tipos'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import {
  aValoresPolitica,
  CATEGORIA,
  dePolitica,
  METODO_ENTREGA,
  MODO,
  POLITICA_INICIAL,
  QUIEN,
  validarPolitica,
  type ValoresPolitica,
} from '../recursos'

export interface DatosRecurso {
  nombre: string
  ubicacion: string | null
  descripcion: string | null
  categoria: CategoriaBienComun | null
  reglas: string | null
  politica: PoliticaReserva
}

const props = withDefaults(defineProps<{ recurso?: Recurso | null; cargando?: boolean; error?: string | null; textoBoton?: string }>(), {
  recurso: null,
  cargando: false,
  error: null,
  textoBoton: 'Guardar',
})
const emit = defineEmits<{ enviar: [datos: DatosRecurso]; cancelar: [] }>()

const nombre = ref('')
const ubicacion = ref('')
const descripcion = ref('')
const categoria = ref<CategoriaBienComun | ''>('')
const reglas = ref('')
const p = ref<ValoresPolitica>(aValoresPolitica(POLITICA_INICIAL))
const intentado = ref(false)

const esBienComun = computed(() => !props.recurso || props.recurso.tipo === 'bien_comun')
const errores = computed(() => (intentado.value ? validarPolitica(p.value) : {}))
const errorNombre = computed(() => (intentado.value && !nombre.value.trim() ? 'Escriba el nombre.' : null))
const errorCategoria = computed(() => (intentado.value && esBienComun.value && !categoria.value ? 'Elija la categoría.' : null))
const opciones = <T extends string>(m: Record<T, string>) => (Object.keys(m) as T[]).map((valor) => ({ valor, etiqueta: m[valor] }))
const err = (c: keyof ValoresPolitica) => errores.value[c] ?? null

watch(
  () => props.recurso,
  (r) => {
    nombre.value = r?.nombre ?? ''
    ubicacion.value = r?.ubicacion ?? ''
    descripcion.value = r?.descripcion ?? ''
    categoria.value = r?.bien_comun?.categoria ?? ''
    reglas.value = r?.bien_comun?.reglas ?? ''
    p.value = aValoresPolitica(r?.politica ?? POLITICA_INICIAL)
    intentado.value = false
  },
  { immediate: true },
)

function enviar() {
  intentado.value = true
  if (errorNombre.value || errorCategoria.value || Object.keys(validarPolitica(p.value)).length) return
  emit('enviar', {
    nombre: nombre.value.trim(),
    ubicacion: ubicacion.value.trim() || null,
    descripcion: descripcion.value.trim() || null,
    categoria: categoria.value || null,
    reglas: reglas.value.trim() || null,
    politica: dePolitica(p.value),
  })
}
</script>

<template>
  <form
    class="formulario-recurso"
    novalidate
    @submit.prevent="enviar"
  >
    <fieldset>
      <legend>Datos</legend>
      <HudCampo
        v-model="nombre"
        etiqueta="Nombre"
        :error="errorNombre"
        requerido
      />
      <HudSelector
        v-if="esBienComun"
        v-model="categoria"
        etiqueta="Categoría"
        vacio="Elija la categoría"
        :opciones="opciones(CATEGORIA)"
        :error="errorCategoria"
        ayuda="Une el recurso con su zona en la maqueta."
      />
      <HudCampo
        v-model="ubicacion"
        etiqueta="Ubicación (opcional)"
      />
      <HudCampo
        v-model="descripcion"
        etiqueta="Descripción (opcional)"
        multilinea
      />
      <HudCampo
        v-if="esBienComun"
        v-model="reglas"
        etiqueta="Reglamento de uso (opcional)"
        multilinea
      />
    </fieldset>

    <fieldset class="rejilla">
      <legend>Cómo se reserva</legend>
      <HudSelector
        v-model="p.modo"
        etiqueta="Modo"
        :opciones="opciones(MODO)"
      />
      <HudSelector
        v-model="p.quien"
        etiqueta="Quién puede reservar"
        :opciones="opciones(QUIEN)"
      />
      <HudCampo
        v-model="p.duracion_minima_min"
        etiqueta="Duración mínima (min)"
        modo-entrada="numeric"
        :error="err('duracion_minima_min')"
      />
      <HudCampo
        v-model="p.duracion_maxima_min"
        etiqueta="Duración máxima (min)"
        modo-entrada="numeric"
        :error="err('duracion_maxima_min')"
      />
      <HudCampo
        v-model="p.granularidad_min"
        etiqueta="Bloques de (min)"
        modo-entrada="numeric"
        :error="err('granularidad_min')"
        ayuda="Cada cuánto puede empezar una reserva."
      />
      <HudCampo
        v-model="p.alistamiento_min"
        etiqueta="Alistamiento entre reservas (min)"
        modo-entrada="numeric"
        :error="err('alistamiento_min')"
      />
      <HudCampo
        v-model="p.anticipacion_minima_horas"
        etiqueta="Anticipación mínima (h)"
        modo-entrada="numeric"
        :error="err('anticipacion_minima_horas')"
      />
      <HudCampo
        v-model="p.anticipacion_maxima_dias"
        etiqueta="Anticipación máxima (días)"
        modo-entrada="numeric"
        :error="err('anticipacion_maxima_dias')"
      />
      <HudCampo
        v-model="p.max_reservas_mes"
        etiqueta="Máx. reservas al mes por bien"
        modo-entrada="numeric"
        :error="err('max_reservas_mes')"
        ayuda="Vacío = sin límite."
      />
      <HudCampo
        v-model="p.max_simultaneas"
        etiqueta="Máx. reservas activas por bien"
        modo-entrada="numeric"
        :error="err('max_simultaneas')"
        ayuda="Vacío = sin límite."
      />
      <HudCampo
        v-model="p.aforo"
        etiqueta="Aforo (personas)"
        modo-entrada="numeric"
        :error="err('aforo')"
        ayuda="Vacío = sin aforo."
      />
      <HudCampo
        v-model="p.max_invitados"
        etiqueta="Máx. invitados"
        modo-entrada="numeric"
        :error="err('max_invitados')"
      />
      <HudSelector
        v-model="p.metodo_entrega"
        etiqueta="Entrega"
        :opciones="opciones(METODO_ENTREGA)"
      />
      <label class="casilla">
        <input
          v-model="p.tenedor_requiere_autorizacion"
          type="checkbox"
        >
        El arrendatario necesita autorización del propietario
      </label>
    </fieldset>

    <fieldset class="rejilla">
      <legend>Costos</legend>
      <HudCampoMonto
        v-model="p.tarifa"
        etiqueta="Tarifa"
        :error="err('tarifa')"
      />
      <HudSelector
        v-model="p.cobro_por"
        etiqueta="La tarifa se cobra por"
        :opciones="[{ valor: 'reserva', etiqueta: 'Reserva' }, { valor: 'hora', etiqueta: 'Hora' }]"
      />
      <HudCampoMonto
        v-model="p.tarifa_festivo"
        etiqueta="Tarifa en festivos (opcional)"
        :error="err('tarifa_festivo')"
      />
      <HudCampoMonto
        v-model="p.deposito"
        etiqueta="Depósito"
        :error="err('deposito')"
      />
      <HudCampo
        v-model="p.cancelacion_sin_penalidad_horas"
        etiqueta="Cancelar sin costo hasta (h antes)"
        modo-entrada="numeric"
        :error="err('cancelacion_sin_penalidad_horas')"
      />
      <HudCampo
        v-model="p.penalidad_porcentaje"
        etiqueta="Penalidad por cancelar tarde (%)"
        modo-entrada="decimal"
        :error="err('penalidad_porcentaje')"
      />
    </fieldset>

    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
    <div class="botones">
      <HudBoton
        variante="fantasma"
        @click="emit('cancelar')"
      >
        Cancelar
      </HudBoton>
      <HudBoton
        tipo="submit"
        :cargando="cargando"
      >
        {{ textoBoton }}
      </HudBoton>
    </div>
  </form>
</template>

<style scoped>
.formulario-recurso {
  display: grid;
  gap: 20px;
}

fieldset {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  border: 0;
}

.rejilla {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
  align-items: start;
}

legend {
  margin-bottom: 8px;
  font-family: var(--fuente-display);
  font-size: 18px;
  font-weight: 600;
}

.casilla {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  grid-column: 1 / -1;
}

.casilla input {
  width: 20px;
  height: 20px;
  accent-color: var(--cian);
}

.botones {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.error {
  margin: 0;
  color: var(--magenta);
}
</style>
