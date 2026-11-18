<script setup lang="ts">
/**
 * Reglas de contabilización por evento (`cartera.cuota`, `tesoreria.recibo`…): cada evento tiene
 * versiones; la vigente es la última cuyo `vigente_desde` ya pasó. Una regla nueva es una versión
 * nueva con sus líneas (concepto, cara, cuenta y de dónde salen el tercero y el centro).
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { LineaReglaContable, ReglaContable } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SelectorCuenta from '@/hud/componentes/SelectorCuenta.vue'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import IMas from '~icons/tabler/plus'
import IQuitar from '~icons/tabler/trash'
import { crearRegla, reglas as pedirReglas } from '../../api'

const props = defineProps<{ entidadId: string; editable: boolean }>()

const entidad = useEntidad()
const plan = usePlanCuentas()
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<ReglaContable[]>([])
const resultado = ref<string | null>(null)

/** Por evento, la última versión primero. */
const porEvento = computed(() => {
  const m = new Map<string, ReglaContable[]>()
  for (const r of lista.value) m.set(r.evento, [...(m.get(r.evento) ?? []), r])
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([evento, v]) => ({ evento, versiones: v.sort((a, b) => b.version - a.version) }))
})
const cuenta = (cid: string) => {
  const c = plan.porId.get(cid)
  return c ? `${c.codigo} · ${c.nombre}` : 'Cuenta desconocida'
}
const tipo = (tid: string) => plan.tipos.find((t) => t.id === tid)?.codigo ?? ''

// Nueva versión
const abierto = ref(false)
const evento = ref('')
const tipoComprobante = ref('')
const descripcion = ref('')
const desde = ref(hoyEn(entidad.zonaHoraria))
const lineas = ref<LineaReglaContable[]>([])
const lineaVacia = (cara: 'debito' | 'credito'): LineaReglaContable => ({ concepto: '', cara, cuenta: '', tercero: 'ninguno', centro: 'ninguno', centro_costo: null })
const opcionesTipo = computed(() => plan.tipos.map((t) => ({ valor: t.codigo, etiqueta: `${t.codigo} · ${t.nombre}` })))
const opcionesCuenta = computed(() => plan.imputables.map((c) => ({ codigo: c.codigo, nombre: c.nombre })))
const opcionesCentro = computed(() => plan.centros.filter((c) => c.activo).map((c) => ({ valor: c.codigo, etiqueta: c.codigo })))
const CARAS = [
  { valor: 'debito' as const, etiqueta: 'Débito' },
  { valor: 'credito' as const, etiqueta: 'Crédito' },
]
const TERCERO = [
  { valor: 'documento' as const, etiqueta: 'Del documento' },
  { valor: 'ninguno' as const, etiqueta: 'Sin tercero' },
]
const CENTRO = [
  { valor: 'documento' as const, etiqueta: 'Del documento' },
  { valor: 'fijo' as const, etiqueta: 'Fijo' },
  { valor: 'ninguno' as const, etiqueta: 'Sin centro' },
]

const crear = useAccion((clave) =>
  crearRegla(props.entidadId, { evento: evento.value.trim(), tipo_comprobante: tipoComprobante.value, descripcion: descripcion.value.trim() || null, vigente_desde: desde.value, lineas: lineas.value }, clave),
)

function nueva(base?: ReglaContable) {
  evento.value = base?.evento ?? ''
  tipoComprobante.value = base ? tipo(base.tipo_comprobante_id) : (plan.tipos[0]?.codigo ?? '')
  descripcion.value = base?.descripcion ?? ''
  lineas.value = base
    ? base.lineas.map((l) => ({ concepto: l.concepto, cara: l.cara, cuenta: plan.porId.get(l.cuenta_id)?.codigo ?? '', tercero: l.tercero, centro: l.centro, centro_costo: l.centro_costo_id ? (plan.centroPorId.get(l.centro_costo_id)?.codigo ?? null) : null }))
    : [lineaVacia('debito'), lineaVacia('credito')]
  abierto.value = true
}

async function alCrear() {
  const r = await crear.ejecutar()
  if (!r.ok) return
  abierto.value = false
  resultado.value = `Regla ${r.valor.evento} guardada como versión ${r.valor.version}.`
  await cargar()
}

async function cargar() {
  try {
    await plan.asegurar()
    lista.value = await pedirReglas(props.entidadId)
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
    <template v-else-if="!abierto">
      <HudBoton
        v-if="editable"
        variante="secundario"
        @click="nueva()"
      >
        <IMas aria-hidden="true" /> Nueva regla
      </HudBoton>
      <HudEstado
        v-if="!porEvento.length"
        estado="vacio"
        mensaje="Todavía no hay reglas: los módulos no podrán contabilizar sus documentos."
      />
      <ul
        v-else
        class="lista"
        aria-label="Reglas por evento"
      >
        <li
          v-for="g in porEvento"
          :key="g.evento"
        >
          <span class="crece">
            <strong>{{ g.evento }} · v{{ g.versiones[0]?.version }} ({{ tipo(g.versiones[0]?.tipo_comprobante_id ?? '') }})</strong>
            <small>{{ g.versiones[0]?.descripcion }} · desde {{ fechaCalendario(g.versiones[0]?.vigente_desde ?? '') }}{{ g.versiones.length > 1 ? ` · ${g.versiones.length - 1} versión(es) anterior(es)` : '' }}</small>
            <small
              v-for="(l, i) in g.versiones[0]?.lineas"
              :key="i"
            >{{ l.cara === 'debito' ? 'Débito' : 'Crédito' }}: {{ cuenta(l.cuenta_id) }} ({{ l.concepto }})</small>
          </span>
          <HudBoton
            v-if="editable && g.versiones[0]"
            variante="fantasma"
            @click="nueva(g.versiones[0])"
          >
            Nueva versión<span class="solo-lector"> de {{ g.evento }}</span>
          </HudBoton>
        </li>
      </ul>
    </template>
    <form
      v-else
      class="campos"
      @submit.prevent="alCrear"
    >
      <div class="filtros">
        <HudCampo
          v-model="evento"
          etiqueta="Evento"
          ayuda="Ej.: cartera.cuota, ventas.factura."
        />
        <HudSelector
          v-model="tipoComprobante"
          etiqueta="Tipo de comprobante que produce"
          :opciones="opcionesTipo"
        />
        <HudFecha
          v-model="desde"
          etiqueta="Vigente desde"
        />
      </div>
      <HudCampo
        v-model="descripcion"
        etiqueta="Descripción (opcional)"
      />
      <fieldset class="lineas-regla">
        <legend>Líneas</legend>
        <div
          v-for="(l, i) in lineas"
          :key="i"
          class="linea-regla"
        >
          <HudCampo
            v-model="l.concepto"
            :etiqueta="`Concepto de la línea ${i + 1}`"
          />
          <HudSelector
            v-model="l.cara"
            :etiqueta="`Cara de la línea ${i + 1}`"
            :opciones="CARAS"
          />
          <SelectorCuenta
            v-model="l.cuenta"
            :opciones="opcionesCuenta"
            :etiqueta="`Cuenta de la línea ${i + 1}`"
          />
          <HudSelector
            v-model="l.tercero"
            :etiqueta="`Tercero de la línea ${i + 1}`"
            :opciones="TERCERO"
          />
          <HudSelector
            v-model="l.centro"
            :etiqueta="`Centro de la línea ${i + 1}`"
            :opciones="CENTRO"
          />
          <HudSelector
            v-if="l.centro === 'fijo'"
            :model-value="l.centro_costo ?? ''"
            :etiqueta="`Centro fijo de la línea ${i + 1}`"
            :opciones="opcionesCentro"
            @update:model-value="(v) => (l.centro_costo = v || null)"
          />
          <HudBoton
            variante="fantasma"
            :deshabilitado="lineas.length <= 2"
            @click="lineas.splice(i, 1)"
          >
            <IQuitar aria-hidden="true" /><span class="solo-lector">Quitar la línea {{ i + 1 }}</span>
          </HudBoton>
        </div>
        <HudBoton
          variante="secundario"
          @click="lineas.push(lineaVacia('debito'))"
        >
          <IMas aria-hidden="true" /> Agregar línea
        </HudBoton>
      </fieldset>
      <p
        v-if="crear.error.value"
        class="error"
        role="alert"
      >
        {{ crear.error.value }}
      </p>
      <div class="botones">
        <HudBoton
          tipo="submit"
          :cargando="crear.cargando.value"
          :deshabilitado="!evento.trim() || !tipoComprobante"
        >
          Guardar la versión
        </HudBoton>
        <HudBoton
          variante="fantasma"
          @click="abierto = false"
        >
          Cancelar
        </HudBoton>
      </div>
    </form>
  </div>
</template>

<style scoped src="../../vistas/contabilidad.css"></style>
<style scoped>
.lineas-regla {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
}

.lineas-regla legend {
  margin-bottom: 6px;
  color: var(--texto-2);
}

.linea-regla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 170px), 1fr));
  gap: 8px;
  align-items: end;
  padding: 10px;
  border: 1px solid var(--linea);
}
</style>
