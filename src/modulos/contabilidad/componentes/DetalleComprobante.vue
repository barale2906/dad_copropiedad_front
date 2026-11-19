<script setup lang="ts">
/**
 * Un comprobante: en borrador se edita (guardar, previsualizar, contabilizar o eliminar);
 * contabilizado queda en solo lectura y se **revierte** con motivo (crea el inverso). Los
 * errores del backend (`regla_contable`: no cuadra, cuenta sin movimiento, periodo cerrado) se
 * muestran con su mensaje.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { Comprobante } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaCalendario, fechaHora, hoyEn } from '@/formato/fechas'
import { moneda } from '@/formato/decimales'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import { useTercerosConocidos } from '@/stores/terceros'
import IVolver from '~icons/tabler/arrow-left'
import { borrarComprobante, comprobante as pedirComprobante, contabilizar, crearComprobante, guardarComprobante, previsualizar, revertir } from '../api'
import {
  accionesComprobante,
  type ComprobanteEditable,
  comprobanteVacio,
  editableDe,
  ESTADO_COMPROBANTE,
  peticionComprobante,
  totales,
} from '../reglas'
import EditorComprobante from './EditorComprobante.vue'

const props = defineProps<{ comprobanteId: string | null; tituloId: string }>()

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const plan = usePlanCuentas()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const ruta = (c = '') => ({ name: 'modulo', params: { ...route.params, accion: 'comprobantes', id: c }, query: {} })

/** Nombres de los terceros: las líneas del backend solo traen `persona_id`. */
const terceros = useTercerosConocidos()

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const c = ref<Comprobante | null>(null)
const modelo = ref<ComprobanteEditable>(comprobanteVacio(hoyEn(zona.value)))
const guardado = ref('')
const resultado = ref<string | null>(null)
const confirmando = ref(false)
const eliminando = ref(false)
const revirtiendo = ref(false)
let recienCreado = ''

const peticion = computed(() => peticionComprobante(modelo.value))
const cambios = computed(() => JSON.stringify(peticion.value) !== guardado.value)
const q = computed(() => ({
  crear: entidad.tienePermiso('contabilidad.comprobantes.crear'),
  contabilizar: entidad.tienePermiso('contabilidad.comprobantes.contabilizar'),
  revertir: entidad.tienePermiso('contabilidad.comprobantes.revertir'),
}))
const acciones = computed(() => accionesComprobante(c.value ?? { estado: 'borrador', revierte_a: null, revertido_por: null }, q.value))
const editable = computed(() => acciones.value.includes('editar'))
const t = computed(() => totales(c.value?.lineas ?? []))
const titulo = computed(() => (c.value ? (c.value.numero ? `${c.value.tipo}-${c.value.numero}` : `${c.value.tipo} en borrador`) : 'Nuevo comprobante'))

const filas = computed(() =>
  (c.value?.lineas ?? []).map((l, i) => {
    const cuenta = plan.porId.get(l.cuenta_id)
    return {
      clave: String(i),
      cuenta: cuenta ? `${cuenta.codigo} · ${cuenta.nombre}` : 'Cuenta desconocida',
      tercero: terceros.nombre(l.persona_id, 'Con tercero'),
      centro: l.centro_costo_id ? (plan.centroPorId.get(l.centro_costo_id)?.codigo ?? '—') : '—',
      debito: l.debito,
      credito: l.credito,
    }
  }),
)
const COLUMNAS = [
  { clave: 'cuenta', titulo: 'Cuenta' },
  { clave: 'tercero', titulo: 'Tercero' },
  { clave: 'centro', titulo: 'Centro' },
  { clave: 'debito', titulo: 'Débito', alinear: 'fin' as const },
  { clave: 'credito', titulo: 'Crédito', alinear: 'fin' as const },
]

const vista = useAccion(() => previsualizar(id.value, peticion.value))
const guardar = useAccion(async (clave) => {
  const actual = c.value
  return actual ? guardarComprobante(id.value, actual.id, peticion.value) : crearComprobante(id.value, peticion.value, clave)
}, { alConflicto: () => cargar() })
const asentar = useAccion((_c, cid: string) => contabilizar(id.value, cid), { alConflicto: () => cargar() })
const borrar = useAccion((_c, cid: string) => borrarComprobante(id.value, cid))
const reverso = useAccion((_c, cid: string, motivo: string) => revertir(id.value, cid, motivo), { alConflicto: () => cargar() })
const errores = computed(() => [vista.error.value, guardar.error.value, asentar.error.value, borrar.error.value].filter(Boolean))

function recordarTerceros() {
  terceros.recordar(modelo.value.lineas.flatMap((l) => (l.tercero ? [l.tercero] : [])))
}

function usar(x: Comprobante) {
  c.value = x
  modelo.value = editableDe(x, plan.porId, plan.centroPorId, new Map(Object.entries(terceros.nombres)))
  guardado.value = JSON.stringify(peticionComprobante(modelo.value))
}

async function alPrevisualizar() {
  resultado.value = null
  const r = await vista.ejecutar()
  if (r.ok) resultado.value = `Cuadra: el asiento suma ${moneda(r.valor.total)}.${cambios.value ? ' Todavía no está guardado.' : ''}`
}

async function alGuardar(): Promise<Comprobante | null> {
  resultado.value = null
  recordarTerceros()
  const nuevo = !c.value
  const r = await guardar.ejecutar()
  if (!r.ok) return null
  usar(r.valor)
  resultado.value = 'Borrador guardado.'
  if (nuevo) {
    recienCreado = r.valor.id
    await router.replace(ruta(r.valor.id))
  }
  return r.valor
}

async function alContabilizar() {
  if (!confirmando.value) {
    if (acciones.value.includes('contabilizar')) confirmando.value = true
    return
  }
  const actual = cambios.value || !c.value ? await alGuardar() : c.value
  if (!actual) {
    confirmando.value = false
    return
  }
  const r = await asentar.ejecutar(actual.id)
  confirmando.value = false
  if (!r.ok) return
  usar(r.valor)
  resultado.value = `Contabilizado como ${r.valor.tipo}-${r.valor.numero}.`
}

async function alEliminar() {
  if (!c.value) return
  const r = await borrar.ejecutar(c.value.id)
  eliminando.value = false
  if (r.ok) await router.push(ruta())
}

async function alRevertir(motivo: string) {
  if (!c.value) return
  const r = await reverso.ejecutar(c.value.id, motivo)
  if (!r.ok) return
  revirtiendo.value = false
  await router.push(ruta(r.valor.id))
}

async function cargar() {
  estado.value = 'cargando'
  try {
    await plan.asegurar()
    if (props.comprobanteId) {
      const x = await pedirComprobante(id.value, props.comprobanteId)
      await terceros.resolver(id.value, x.lineas.map((l) => l.persona_id))
      usar(x)
    }
    else {
      c.value = null
      modelo.value = comprobanteVacio(hoyEn(zona.value), plan.tipos.find((x) => x.manual && x.activo)?.codigo ?? '')
      guardado.value = ''
    }
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(() => props.comprobanteId, (nuevo) => {
  if (nuevo && nuevo === recienCreado) return
  resultado.value = null
  void cargar()
}, { immediate: true })
</script>

<template>
  <RouterLink
    :to="ruta()"
    class="volver"
  >
    <IVolver aria-hidden="true" /> Comprobantes
  </RouterLink>
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
    <header class="encabezado">
      <h1 :id="tituloId">
        {{ titulo }}
      </h1>
      <HudInsignia
        v-if="c"
        :tono="ESTADO_COMPROBANTE[c.estado].tono"
      >
        {{ ESTADO_COMPROBANTE[c.estado].texto }}
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
      v-for="e in errores"
      :key="e ?? ''"
      class="error"
      role="alert"
    >
      {{ e }}
    </p>

    <template v-if="editable || !c">
      <HudPanel etiqueta="Comprobante">
        <EditorComprobante
          v-model="modelo"
          :entidad-id="id"
          :tipos="plan.tipos"
          :cuentas="plan.cuentas"
          :centros="plan.centros"
          @guardar="alGuardar"
          @previsualizar="alPrevisualizar"
          @contabilizar="alContabilizar"
        />
      </HudPanel>
      <div class="botones">
        <HudBoton
          variante="secundario"
          aria-keyshortcuts="Alt+P"
          :cargando="vista.cargando.value"
          @click="alPrevisualizar"
        >
          Previsualizar
        </HudBoton>
        <HudBoton
          variante="secundario"
          aria-keyshortcuts="Control+S"
          :cargando="guardar.cargando.value"
          :deshabilitado="!!c && !cambios"
          @click="alGuardar"
        >
          {{ cambios || !c ? 'Guardar borrador' : 'Borrador guardado' }}
        </HudBoton>
        <HudBoton
          v-if="q.contabilizar"
          aria-keyshortcuts="Control+Shift+Enter"
          :cargando="asentar.cargando.value"
          @click="alContabilizar"
        >
          Contabilizar
        </HudBoton>
        <HudBoton
          v-if="c && acciones.includes('eliminar')"
          variante="fantasma"
          @click="eliminando = true"
        >
          Eliminar el borrador
        </HudBoton>
      </div>
    </template>

    <template v-else-if="c">
      <HudPanel etiqueta="Datos">
        <dl class="datos">
          <div>
            <dt>Fecha</dt>
            <dd>{{ fechaCalendario(c.fecha) }}</dd>
          </div>
          <div>
            <dt>Descripción</dt>
            <dd>{{ c.descripcion }}</dd>
          </div>
          <div v-if="c.contabilizado_en">
            <dt>Contabilizado</dt>
            <dd>{{ fechaHora(c.contabilizado_en, zona) }}</dd>
          </div>
          <div v-if="c.motivo_reverso">
            <dt>Motivo del reverso</dt>
            <dd>{{ c.motivo_reverso }}</dd>
          </div>
        </dl>
        <p
          v-if="c.revierte_a || c.revertido_por"
          class="aviso"
        >
          <template v-if="c.revierte_a">
            Este comprobante revierte <RouterLink :to="ruta(c.revierte_a)">el original</RouterLink>.
          </template>
          <template v-else-if="c.revertido_por">
            Este comprobante se revirtió: vea <RouterLink :to="ruta(c.revertido_por)">el reverso</RouterLink>.
          </template>
        </p>
      </HudPanel>
      <HudPanel etiqueta="Líneas">
        <HudTabla
          :filas="filas"
          :columnas="COLUMNAS"
          clave="clave"
          titulo="Líneas del comprobante"
        >
          <template #celda-debito="{ fila }">
            <span class="cifra">{{ fila.debito === '0' || fila.debito === '0.00' ? '' : moneda(fila.debito) }}</span>
          </template>
          <template #celda-credito="{ fila }">
            <span class="cifra">{{ fila.credito === '0' || fila.credito === '0.00' ? '' : moneda(fila.credito) }}</span>
          </template>
        </HudTabla>
        <p class="texto-2 cifra">
          Débitos {{ moneda(t.debito) }} · Créditos {{ moneda(t.credito) }}
        </p>
      </HudPanel>
      <div
        v-if="acciones.includes('revertir')"
        class="botones"
      >
        <HudBoton
          variante="secundario"
          @click="revirtiendo = true"
        >
          Revertir
        </HudBoton>
      </div>
    </template>

    <HudDialogo
      v-model:abierto="confirmando"
      titulo="Contabilizar el comprobante"
    >
      <p>Al contabilizarlo recibe su número y queda definitivo: ya no se edita ni se borra, solo se revierte.</p>
      <p
        v-if="cambios"
        class="texto-2"
      >
        Antes se guardan los cambios del borrador.
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="confirmando = false"
        >
          Volver
        </HudBoton>
        <HudBoton
          :cargando="asentar.cargando.value || guardar.cargando.value"
          @click="alContabilizar"
        >
          Contabilizar
        </HudBoton>
      </template>
    </HudDialogo>
    <HudDialogo
      v-model:abierto="eliminando"
      titulo="Eliminar el borrador"
    >
      <p>El borrador se borra por completo. Esta acción no se puede deshacer.</p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="eliminando = false"
        >
          Volver
        </HudBoton>
        <HudBoton
          :cargando="borrar.cargando.value"
          @click="alEliminar"
        >
          Eliminar
        </HudBoton>
      </template>
    </HudDialogo>
    <ConfirmarConMotivo
      v-model:abierto="revirtiendo"
      titulo="Revertir el comprobante"
      accion="Revertir"
      descripcion="Se crea un comprobante con los mismos valores al revés, con fecha de hoy. El original queda marcado como revertido."
      :cargando="reverso.cargando.value"
      :error="reverso.error.value"
      @confirmar="alRevertir"
    />
  </template>
</template>

<style scoped src="../vistas/contabilidad.css"></style>
