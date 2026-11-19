<script setup lang="ts">
/**
 * Los eventos RADIAN de una factura recibida como asistente de cuatro pasos, en orden: acuse de
 * recibo → recibo del bien o servicio → aceptación expresa **o** reclamo. Cada paso se habilita
 * cuando el previo existe (los rechazados por la DIAN no cuentan). El acuse y el recibo exigen
 * quién recibe (arts. 773 y 774 del Código de Comercio); el reclamo, su concepto. Emite el
 * evento listo para la API; el padre lo registra.
 */
import { computed, ref } from 'vue'
import type { ConceptoReclamo, EventoRadian, NuevoEventoRadian, TipoDocumento, TipoEventoRadian } from '@/api/tipos'
import { fechaHora } from '@/formato/fechas'
import { TIPO_DOCUMENTO } from '@/formato/tributario'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { CONCEPTO_RECLAMO, EVENTO_RADIAN, pasosRadian, type PasoRadian } from '../reglas'

const props = withDefaults(
  defineProps<{ eventos: EventoRadian[]; zona: string; puede?: boolean; cargando?: boolean; error?: string | null }>(),
  { puede: true, cargando: false, error: null },
)
const emit = defineEmits<{ registrar: [evento: NuevoEventoRadian] }>()

const pasos = computed(() => pasosRadian(props.eventos))
const quien = ref({ tipo_documento: 'CC' as TipoDocumento, documento: '', nombres: '', apellidos: '', cargo: '', area: '' })
const decision = ref<'aceptacion' | 'reclamo'>('aceptacion')
const concepto = ref<ConceptoReclamo | ''>('')
const motivo = ref('')
const problema = ref<string | null>(null)

const opcionesDocumento = (Object.keys(TIPO_DOCUMENTO) as TipoDocumento[]).map((valor) => ({ valor, etiqueta: TIPO_DOCUMENTO[valor] }))
const opcionesConcepto = (Object.keys(CONCEPTO_RECLAMO) as ConceptoReclamo[]).map((valor) => ({ valor, etiqueta: CONCEPTO_RECLAMO[valor] }))
const TITULO: Record<PasoRadian, string> = { acuse: '1. Acuse de recibo', recibo_bien: '2. Recibo del bien o servicio', decision: '3. Aceptación o reclamo' }

/** Los eventos ya registrados de un paso (la decisión agrupa aceptación y reclamo). */
const eventosDe = (paso: PasoRadian) =>
  props.eventos.filter((e) => (paso === 'decision' ? e.tipo === 'aceptacion' || e.tipo === 'reclamo' : e.tipo === paso))

function registrar(tipo: TipoEventoRadian) {
  problema.value = null
  if (tipo === 'acuse' || tipo === 'recibo_bien') {
    const q = quien.value
    if (!/^[\dA-Za-z]{3,20}$/.test(q.documento.trim()) || !q.nombres.trim() || !q.apellidos.trim()) {
      problema.value = 'Indique quién recibe: documento sin puntos, nombres y apellidos.'
      return
    }
    emit('registrar', {
      tipo,
      quien_recibe: { tipo_documento: q.tipo_documento, documento: q.documento.trim(), nombres: q.nombres.trim(), apellidos: q.apellidos.trim(), cargo: q.cargo.trim() || null, area: q.area.trim() || null },
    })
    return
  }
  if (tipo === 'reclamo' && !concepto.value) {
    problema.value = 'Elija el concepto del reclamo.'
    return
  }
  emit('registrar', { tipo, motivo: motivo.value.trim() || null, concepto_reclamo: tipo === 'reclamo' ? concepto.value || null : null })
}
</script>

<template>
  <ol
    class="radian"
    aria-label="Eventos RADIAN"
  >
    <li
      v-for="p in pasos"
      :key="p.paso"
      :class="{ hecho: p.hecho, bloqueado: !p.hecho && !p.disponible }"
      :aria-current="p.disponible ? 'step' : undefined"
    >
      <h3>{{ TITULO[p.paso] }}</h3>
      <ul
        v-if="eventosDe(p.paso).length"
        class="eventos"
      >
        <li
          v-for="e in eventosDe(p.paso)"
          :key="e.id"
        >
          <strong>{{ EVENTO_RADIAN[e.tipo] }}</strong>
          <HudInsignia :tono="e.estado === 'rechazado' ? 'peligro' : 'exito'">
            {{ e.estado === 'rechazado' ? 'Rechazado por la DIAN' : 'Enviado' }}
          </HudInsignia>
          <small>{{ e.numero ? `N.º ${e.numero} · ` : '' }}{{ fechaHora(e.creado_en, zona) }}{{ e.concepto_reclamo ? ` · ${CONCEPTO_RECLAMO[e.concepto_reclamo]}` : '' }}</small>
          <small v-if="e.respuesta">{{ e.respuesta }}</small>
        </li>
      </ul>
      <p
        v-if="!p.hecho && !p.disponible"
        class="texto-3"
      >
        Se habilita al registrar el paso anterior.
      </p>

      <form
        v-if="p.disponible && puede && p.paso !== 'decision'"
        class="formulario"
        novalidate
        :aria-label="EVENTO_RADIAN[p.paso]"
        @submit.prevent="registrar(p.paso)"
      >
        <p class="texto-3">
          Quién recibe (queda en el evento ante la DIAN).
        </p>
        <div class="campos-quien">
          <HudSelector
            v-model="quien.tipo_documento"
            etiqueta="Tipo de documento"
            :opciones="opcionesDocumento"
          />
          <HudCampo
            v-model="quien.documento"
            etiqueta="Número de documento"
            modo-entrada="numeric"
            autocompletar="off"
          />
          <HudCampo
            v-model="quien.nombres"
            etiqueta="Nombres"
            autocompletar="given-name"
          />
          <HudCampo
            v-model="quien.apellidos"
            etiqueta="Apellidos"
            autocompletar="family-name"
          />
          <HudCampo
            v-model="quien.cargo"
            etiqueta="Cargo (opcional)"
          />
          <HudCampo
            v-model="quien.area"
            etiqueta="Área (opcional)"
          />
        </div>
        <HudBoton
          tipo="submit"
          :cargando="cargando"
        >
          Registrar {{ EVENTO_RADIAN[p.paso].toLowerCase() }}
        </HudBoton>
      </form>

      <form
        v-if="p.disponible && puede && p.paso === 'decision'"
        class="formulario"
        novalidate
        aria-label="Aceptación o reclamo"
        @submit.prevent="registrar(decision)"
      >
        <fieldset class="opciones">
          <legend class="solo-lector">
            Decisión sobre la factura
          </legend>
          <label class="casilla">
            <input
              v-model="decision"
              type="radio"
              value="aceptacion"
            >
            Aceptarla
          </label>
          <label class="casilla">
            <input
              v-model="decision"
              type="radio"
              value="reclamo"
            >
            Reclamarla
          </label>
        </fieldset>
        <HudSelector
          v-if="decision === 'reclamo'"
          v-model="concepto"
          etiqueta="Concepto del reclamo"
          vacio="Elija el concepto"
          :opciones="opcionesConcepto"
        />
        <HudCampo
          v-model="motivo"
          :etiqueta="decision === 'reclamo' ? 'Detalle de lo reclamado' : 'Observaciones (opcional)'"
          multilinea
        />
        <HudBoton
          tipo="submit"
          :cargando="cargando"
        >
          {{ decision === 'reclamo' ? 'Registrar reclamo' : 'Registrar aceptación' }}
        </HudBoton>
      </form>
    </li>
  </ol>
  <p
    v-if="problema || error"
    class="error"
    role="alert"
  >
    {{ problema ?? error }}
  </p>
</template>

<style scoped>
.radian {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.radian > li {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--linea);
  border-left: 3px solid var(--cian);
  background: var(--superficie);
}

.radian > li.hecho {
  border-left-color: var(--verde);
}

.radian > li.bloqueado {
  border-left-color: var(--linea);
}

h3 {
  margin: 0;
  font-size: 17px;
}

.eventos {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.eventos li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
}

small,
.texto-3 {
  margin: 0;
  color: var(--texto-3);
}

.formulario {
  display: grid;
  gap: 10px;
}

.campos-quien {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 10px 12px;
}

.opciones {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  margin: 0;
  padding: 0;
  border: 0;
}

.casilla {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  cursor: pointer;
}

.casilla input {
  width: 20px;
  height: 20px;
  accent-color: var(--cian);
}

.error {
  margin: 0;
  color: var(--magenta);
}
</style>
