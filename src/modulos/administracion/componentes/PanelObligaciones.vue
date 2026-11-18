<script setup lang="ts">
/**
 * Obligaciones periódicas (certificación de ascensores, lavado de tanques…): agregarlas desde el
 * catálogo sugerido o propias, ver la próxima fecha con su semáforo y registrar cumplimientos
 * con soporte (mueve la próxima fecha).
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Cumplimiento, ObligacionMantenimiento, ObligacionSugerida } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useAdjuntos } from '@/composables/useAdjuntos'
import { aUtc, fechaCalendario, hoyEn } from '@/formato/fechas'
import HudAdjuntos from '@/hud/componentes/HudAdjuntos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SemaforoVencimiento from '@/hud/componentes/SemaforoVencimiento.vue'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import { crearObligacion, cumplimientos, obligaciones, obligacionesSugeridas, registrarCumplimiento } from '../api'
import { textoPeriodicidad } from '../reglas'

const props = defineProps<{ entidadId: string }>()

const PROPIA = 'propia'
const entidad = useEntidad()
const zona = computed(() => entidad.zonaHoraria)
const puedePlanificar = computed(() => entidad.tienePermiso('mantenimiento.planificar'))
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<ObligacionMantenimiento[]>([])
const sugeridas = ref<ObligacionSugerida[]>([])
const historial = ref<Record<string, Cumplimiento[]>>({})
const resultado = ref<string | null>(null)
/** El semáforo se calcula a las 23:59 de la próxima fecha, en la zona de la entidad. */
const venceEn = (o: ObligacionMantenimiento) => aUtc(`${o.proxima}T23:59`, zona.value)
const vencida = (o: ObligacionMantenimiento) => o.proxima < hoyEn(zona.value)

// Agregar
const agregando = ref(false)
const sugerida = ref('')
const nombre = ref('')
const meses = ref('12')
const proxima = ref('')
const errorForm = ref<string | null>(null)
const opcionesSugeridas = computed(() => [
  ...sugeridas.value.filter((s) => !lista.value.some((o) => o.activa && o.codigo_sugerido === s.codigo)).map((s) => ({ valor: s.codigo, etiqueta: `${s.nombre} (${textoPeriodicidad(s.periodicidad_meses)})` })),
  { valor: PROPIA, etiqueta: 'Otra (escribirla)' },
])
const crear = useAccion((clave) => {
  const s = sugeridas.value.find((x) => x.codigo === sugerida.value)
  return crearObligacion(
    props.entidadId,
    {
      codigo_sugerido: s?.codigo ?? null,
      nombre: s?.nombre ?? nombre.value.trim(),
      descripcion: s?.descripcion ?? null,
      periodicidad_meses: s?.periodicidad_meses ?? parseInt(meses.value, 10),
      proxima: proxima.value,
    },
    clave,
  )
})

// Cumplimiento
const cumpliendo = ref<ObligacionMantenimiento | null>(null)
const abiertoCumplimiento = computed({ get: () => !!cumpliendo.value, set: (si: boolean) => !si && (cumpliendo.value = null) })
const realizada = ref('')
const observacion = ref('')
const soporte = useAdjuntos(() => props.entidadId, 'interno')
const cumplir = useAccion(() =>
  registrarCumplimiento(props.entidadId, cumpliendo.value?.id ?? '', realizada.value, soporte.ids()[0] ?? null, observacion.value.trim() || null),
)

function abrirAgregar() {
  sugerida.value = opcionesSugeridas.value[0]?.valor ?? PROPIA
  nombre.value = ''
  meses.value = '12'
  proxima.value = hoyEn(zona.value)
  errorForm.value = null
  crear.reiniciar()
  agregando.value = true
}

async function agregar() {
  errorForm.value = !proxima.value ? 'Elija la próxima fecha.' : sugerida.value === PROPIA && (!nombre.value.trim() || !/^[1-9]\d*$/.test(meses.value)) ? 'Escriba el nombre y cada cuántos meses.' : null
  if (errorForm.value) return
  if (!(await crear.ejecutar()).ok) return
  agregando.value = false
  resultado.value = 'Obligación agregada.'
  await cargar()
}

function abrirCumplimiento(o: ObligacionMantenimiento) {
  realizada.value = hoyEn(zona.value)
  observacion.value = ''
  soporte.limpiar()
  cumplir.reiniciar()
  cumpliendo.value = o
}

async function registrar() {
  const o = cumpliendo.value
  if (!o || !realizada.value) return
  const r = await cumplir.ejecutar()
  if (!r.ok) return
  cumpliendo.value = null
  resultado.value = `Cumplimiento registrado: la próxima es el ${fechaCalendario(r.valor.proxima)}.`
  await cargar()
}

async function verHistorial(o: ObligacionMantenimiento) {
  if (historial.value[o.id]) {
    historial.value = Object.fromEntries(Object.entries(historial.value).filter(([k]) => k !== o.id))
    return
  }
  const h = await cumplimientos(props.entidadId, o.id).catch(() => [])
  historial.value = { ...historial.value, [o.id]: h }
}

async function cargar() {
  try {
    const [o, s] = await Promise.all([obligaciones(props.entidadId), obligacionesSugeridas(props.entidadId).catch(() => [])])
    lista.value = [...o].sort((a, b) => a.proxima.localeCompare(b.proxima))
    sugeridas.value = s
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <div class="campos">
    <div
      v-if="puedePlanificar"
      class="botones"
    >
      <HudBoton @click="abrirAgregar">
        <IMas aria-hidden="true" /> Agregar obligación
      </HudBoton>
    </div>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
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
    <HudEstado
      v-else-if="lista.length === 0"
      estado="vacio"
      mensaje="Aún no hay obligaciones periódicas."
    />
    <ul
      v-else
      class="lista"
      aria-label="Obligaciones periódicas"
    >
      <li
        v-for="o in lista"
        :key="o.id"
        :class="{ urgente: vencida(o) }"
      >
        <span class="crece">
          <strong>{{ o.nombre }}</strong>
          <small>{{ textoPeriodicidad(o.periodicidad_meses) }} · próxima {{ fechaCalendario(o.proxima) }}{{ o.activa ? '' : ' · inactiva' }}</small>
          <ul
            v-if="historial[o.id]"
            class="historial"
            :aria-label="`Cumplimientos de ${o.nombre}`"
          >
            <li v-if="!historial[o.id]?.length">
              Sin cumplimientos registrados.
            </li>
            <li
              v-for="(c, i) in historial[o.id]"
              :key="i"
            >
              {{ fechaCalendario(c.realizada_el) }}{{ c.observacion ? ` · ${c.observacion}` : '' }}
            </li>
          </ul>
        </span>
        <SemaforoVencimiento
          v-if="o.activa"
          :vence-en="venceEn(o)"
          :vencido="vencida(o)"
        />
        <div class="botones">
          <HudBoton
            variante="fantasma"
            @click="verHistorial(o)"
          >
            {{ historial[o.id] ? 'Ocultar' : 'Historial' }}<span class="solo-lector"> de {{ o.nombre }}</span>
          </HudBoton>
          <HudBoton
            v-if="puedePlanificar && o.activa"
            variante="secundario"
            @click="abrirCumplimiento(o)"
          >
            Registrar cumplimiento<span class="solo-lector"> de {{ o.nombre }}</span>
          </HudBoton>
        </div>
      </li>
    </ul>

    <HudDialogo
      v-model:abierto="agregando"
      titulo="Agregar obligación"
    >
      <form
        id="formulario-obligacion"
        class="campos"
        novalidate
        @submit.prevent="agregar"
      >
        <HudSelector
          v-model="sugerida"
          etiqueta="Obligación"
          :opciones="opcionesSugeridas"
        />
        <template v-if="sugerida === PROPIA">
          <HudCampo
            v-model="nombre"
            etiqueta="Nombre"
            autocompletar="off"
          />
          <HudCampo
            v-model="meses"
            etiqueta="Cada cuántos meses"
            modo-entrada="numeric"
          />
        </template>
        <HudFecha
          v-model="proxima"
          etiqueta="Próxima fecha"
        />
        <p
          v-if="errorForm || crear.error.value"
          class="error"
          role="alert"
        >
          {{ errorForm ?? crear.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="agregando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-obligacion"
          :cargando="crear.cargando.value"
        >
          Agregar
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="abiertoCumplimiento"
      :titulo="cumpliendo ? `Cumplimiento: ${cumpliendo.nombre}` : ''"
    >
      <form
        id="formulario-cumplimiento"
        class="campos"
        @submit.prevent="registrar"
      >
        <HudFecha
          v-model="realizada"
          etiqueta="Se realizó el"
          :maximo="hoyEn(zona)"
        />
        <HudCampo
          v-model="observacion"
          etiqueta="Observación (opcional)"
          autocompletar="off"
        />
        <div>
          <p class="texto-2">
            Soporte (certificado, factura…)
          </p>
          <HudAdjuntos
            :adjuntos="soporte.adjuntos.value"
            acepta="image/*,application/pdf"
            :subiendo="soporte.subiendo.value"
            @subir="soporte.subir"
            @abrir="soporte.abrir"
            @quitar="soporte.quitar"
          />
        </div>
        <p
          v-if="cumplir.error.value || soporte.error.value"
          class="error"
          role="alert"
        >
          {{ cumplir.error.value ?? soporte.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="cumpliendo = null"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-cumplimiento"
          :cargando="cumplir.cargando.value"
          :deshabilitado="soporte.subiendo.value"
        >
          Registrar
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped src="../vistas/administracion.css"></style>
<style scoped>
.historial {
  margin: 6px 0 0;
  padding-left: 18px;
  color: var(--texto-2);
}
</style>
