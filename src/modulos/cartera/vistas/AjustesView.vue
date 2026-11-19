<script setup lang="ts">
/**
 * Ajustes de la cartera (`?vista=`): cobros puntuales (multa, uso de un bien común, daño…),
 * correcciones sobre el estado de cuenta de una unidad (lo liquidado no se edita: nota crédito;
 * un cobro manual sin pagos se anula) y la carga de la cartera inicial (vista previa con sus
 * errores; con errores no se carga nada).
 */
import { computed, onMounted, ref, watch } from 'vue'
import type { CarteraInicial, EstadoCuenta as TipoEstadoCuenta, Obligacion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { usePestana } from '@/composables/usePestana'
import { comparar, esDecimal, moneda } from '@/formato/decimales'
import { hoyEn, sumarDias } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import EstadoCuenta from '@/hud/componentes/EstadoCuenta.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import TablaErroresImportacion from '@/hud/componentes/TablaErroresImportacion.vue'
import { useEntidad } from '@/stores/entidad'
import * as api from '../api'
import ElegirUnidad from '../componentes/ElegirUnidad.vue'
import { leerCarteraInicial, textoPeriodo } from '../reglas'
import { useCartera } from '../store'

const PESTANAS = [
  { id: 'cobros', texto: 'Cobro puntual' },
  { id: 'correcciones', texto: 'Notas crédito y anulaciones' },
  { id: 'inicial', texto: 'Cartera inicial' },
] as const

const entidad = useEntidad()
const cartera = useCartera()
const pestana = usePestana(PESTANAS)
const id = computed(() => entidad.activa?.entidad_id ?? '')
const hoy = hoyEn(entidad.zonaHoraria)
const resultado = ref<string | null>(null)

// Cobro puntual
const cobro = ref({ bien: '', concepto: '', valor: '', fecha: hoy, vencimiento: sumarDias(hoy, 15), descripcion: '' })
const problemaCobro = ref<string | null>(null)
const opcionesConcepto = computed(() => cartera.conceptos.filter((c) => c.activo && c.tipo !== 'ordinaria' && c.tipo !== 'fondo_imprevistos').map((c) => ({ valor: c.id, etiqueta: `${c.codigo} · ${c.nombre}` })))
const cobrar = useAccion((clave) =>
  api.cobrar(id.value, { bien_privado_id: cobro.value.bien, concepto_cobro_id: cobro.value.concepto, valor: cobro.value.valor, fecha: cobro.value.fecha, vencimiento: cobro.value.vencimiento, descripcion: cobro.value.descripcion.trim() }, clave),
)

async function alCobrar() {
  const c = cobro.value
  problemaCobro.value = !c.bien || !c.concepto ? 'Elija la unidad y el concepto.' : !esDecimal(c.valor) || comparar(c.valor, '0') <= 0 || !c.descripcion.trim() ? 'Escriba el valor y la descripción.' : null
  if (problemaCobro.value) return
  const r = await cobrar.ejecutar()
  if (!r.ok) return
  resultado.value = `Cobro de ${moneda(r.valor.valor)} a ${cartera.codigo(r.valor.bien_privado_id)} registrado y contabilizado.`
  cobro.value = { ...cobro.value, valor: '', descripcion: '' }
}

// Correcciones
const bienCorreccion = ref('')
const cuenta = ref<TipoEstadoCuenta | null>(null)
const nota = ref<{ obligacion: Obligacion; valor: string; motivo: string } | null>(null)
const abiertaNota = computed({ get: () => nota.value !== null, set: (v) => !v && (nota.value = null) })
const anulando = ref<Obligacion | null>(null)
const abiertoAnular = computed({ get: () => anulando.value !== null, set: (v) => !v && (anulando.value = null) })
const notaCredito = useAccion(() => api.notaCredito(id.value, nota.value?.obligacion.id ?? '', { valor: nota.value?.valor ?? '', motivo: nota.value?.motivo.trim() ?? '' }))
const anular = useAccion((_c, o: Obligacion, motivo: string) => api.anularObligacion(id.value, o.id, motivo))
const anulable = (o: Obligacion) => o.origen === 'manual' && comparar(o.aplicado, '0') === 0 && comparar(o.ajustes, '0') === 0
const errorNota = computed(() => {
  const n = nota.value
  if (!n || !n.valor) return null
  return !esDecimal(n.valor) || comparar(n.valor, '0') <= 0 ? 'Escriba un valor mayor que cero.' : comparar(n.valor, n.obligacion.saldo) > 0 ? `No puede superar el saldo (${moneda(n.obligacion.saldo)}).` : null
})

async function alNota() {
  if (!nota.value || errorNota.value || !nota.value.valor || nota.value.motivo.trim().length < 3) return
  if (!(await notaCredito.ejecutar()).ok) return
  resultado.value = `Nota crédito de ${moneda(nota.value.valor)} sobre ${nota.value.obligacion.concepto_nombre} de ${textoPeriodo(nota.value.obligacion.periodo)}.`
  nota.value = null
  await cargarCuenta()
}

async function alAnular(motivo: string) {
  if (!anulando.value) return
  if (!(await anular.ejecutar(anulando.value, motivo)).ok) return
  resultado.value = `Cobro «${anulando.value.descripcion ?? anulando.value.concepto_nombre}» anulado.`
  anulando.value = null
  await cargarCuenta()
}

async function cargarCuenta() {
  cuenta.value = bienCorreccion.value ? await api.estadoCuenta(id.value, bienCorreccion.value).catch(() => null) : null
}

// Cartera inicial
const planilla = ref('')
const informe = ref<CarteraInicial | null>(null)
const leidas = computed(() => leerCarteraInicial(planilla.value))
const erroresLocales = computed(() => leidas.value.filter((f) => f.error).map((f) => ({ fila: f.fila, mensaje: f.error ?? '' })))
const filas = computed(() => leidas.value.flatMap((f) => (f.datos ? [f.datos] : [])))
const inicial = useAccion((_c, soloValidar: boolean) => api.carteraInicial(id.value, filas.value, soloValidar))

async function alInicial(soloValidar: boolean) {
  informe.value = null
  if (erroresLocales.value.length || !filas.value.length) return
  const r = await inicial.ejecutar(soloValidar)
  if (!r.ok) return
  informe.value = r.valor
  if (r.valor.cargada) {
    resultado.value = `Cartera inicial cargada: ${r.valor.filas} filas por ${moneda(r.valor.total)}.`
    planilla.value = ''
  }
}

watch(bienCorreccion, cargarCuenta)
onMounted(async () => {
  await cartera.asegurar(id.value).catch(() => undefined)
  cobro.value.concepto ||= opcionesConcepto.value[0]?.valor ?? ''
})
</script>

<template>
  <section aria-labelledby="titulo-ajustes">
    <header>
      <h1 id="titulo-ajustes">
        Ajustes de la cartera
      </h1>
      <p class="texto-2">
        Los saldos no se editan: cada corrección queda como una acción con su motivo y su comprobante.
      </p>
    </header>
    <HudPestanas
      :pestanas="PESTANAS"
      etiqueta="Tipos de ajuste"
    />
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

    <HudPanel
      v-if="pestana === 'cobros'"
      etiqueta="Cobro puntual"
    >
      <form
        class="campos"
        novalidate
        @submit.prevent="alCobrar"
      >
        <div class="filtros">
          <ElegirUnidad v-model="cobro.bien" />
          <HudSelector
            v-model="cobro.concepto"
            etiqueta="Concepto"
            vacio="Elija el concepto"
            :opciones="opcionesConcepto"
          />
          <HudCampoMonto
            v-model="cobro.valor"
            etiqueta="Valor"
          />
          <HudFecha
            v-model="cobro.fecha"
            etiqueta="Fecha"
          />
          <HudFecha
            v-model="cobro.vencimiento"
            etiqueta="Vence"
            :minimo="cobro.fecha"
          />
        </div>
        <HudCampo
          v-model="cobro.descripcion"
          etiqueta="Descripción"
          ayuda="Aparece en el estado de cuenta (p. ej. «Multa por ruido del 3 de noviembre»)."
        />
        <p
          v-if="problemaCobro ?? cobrar.error.value"
          class="error"
          role="alert"
        >
          {{ problemaCobro ?? cobrar.error.value }}
        </p>
        <div class="botones">
          <HudBoton
            tipo="submit"
            :cargando="cobrar.cargando.value"
          >
            Registrar cobro
          </HudBoton>
        </div>
      </form>
    </HudPanel>

    <template v-else-if="pestana === 'correcciones'">
      <div class="filtros">
        <ElegirUnidad v-model="bienCorreccion" />
      </div>
      <EstadoCuenta
        v-if="cuenta"
        :estado="cuenta"
        solo-pendientes
      >
        <template #acciones="{ obligacion }">
          <span class="botones">
            <HudBoton
              variante="fantasma"
              @click="nota = { obligacion, valor: '', motivo: '' }"
            >
              Nota crédito<span class="solo-lector"> a {{ obligacion.concepto_nombre }} de {{ textoPeriodo(obligacion.periodo) }}</span>
            </HudBoton>
            <HudBoton
              v-if="anulable(obligacion)"
              variante="fantasma"
              @click="anulando = obligacion"
            >
              Anular<span class="solo-lector"> {{ obligacion.concepto_nombre }}</span>
            </HudBoton>
          </span>
        </template>
      </EstadoCuenta>
      <p
        v-else
        class="texto-2"
      >
        Elija una unidad para ver lo que debe y corregirlo.
      </p>
    </template>

    <HudPanel
      v-else
      etiqueta="Cartera inicial"
    >
      <div class="campos">
        <p class="texto-2">
          Pegue la planilla: una fila por línea con unidad, concepto, periodo (AAAA-MM-DD), valor y vencimiento, separados por punto y coma o tabulador.
        </p>
        <HudCampo
          v-model="planilla"
          etiqueta="Planilla de la cartera inicial"
          multilinea
          ayuda="Ejemplo: T1-101;ADM;2025-12-01;350000;2025-12-10"
        />
        <TablaErroresImportacion
          v-if="erroresLocales.length"
          :errores="erroresLocales"
          titulo="Corrija estas filas de la planilla"
        />
        <TablaErroresImportacion
          v-else-if="informe?.errores.length"
          :errores="informe.errores"
          titulo="El sistema encontró estos errores: no se cargó nada"
        />
        <p
          v-if="informe && !informe.errores.length && !informe.cargada"
          class="ok"
          role="status"
        >
          La planilla es válida: {{ informe.filas }} filas por {{ moneda(informe.total) }}. Ya puede cargarla.
        </p>
        <p
          v-if="inicial.error.value"
          class="error"
          role="alert"
        >
          {{ inicial.error.value }}
        </p>
        <div class="botones">
          <HudBoton
            variante="secundario"
            :cargando="inicial.cargando.value"
            :deshabilitado="!filas.length || erroresLocales.length > 0"
            @click="alInicial(true)"
          >
            Validar
          </HudBoton>
          <HudBoton
            :cargando="inicial.cargando.value"
            :deshabilitado="!informe || informe.errores.length > 0 || informe.cargada"
            @click="alInicial(false)"
          >
            Cargar cartera inicial
          </HudBoton>
        </div>
      </div>
    </HudPanel>

    <HudDialogo
      v-model:abierto="abiertaNota"
      titulo="Nota crédito"
    >
      <form
        v-if="nota"
        id="form-nota-credito"
        class="campos"
        novalidate
        @submit.prevent="alNota"
      >
        <p class="texto-2">
          {{ nota.obligacion.concepto_nombre }} de {{ textoPeriodo(nota.obligacion.periodo) }}: saldo {{ moneda(nota.obligacion.saldo) }}.
        </p>
        <HudCampoMonto
          v-model="nota.valor"
          etiqueta="Valor de la nota"
          :error="errorNota"
        />
        <HudCampo
          v-model="nota.motivo"
          etiqueta="Motivo"
          multilinea
        />
        <p
          v-if="notaCredito.error.value"
          class="error"
          role="alert"
        >
          {{ notaCredito.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="secundario"
          @click="nota = null"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="form-nota-credito"
          :cargando="notaCredito.cargando.value"
        >
          Registrar nota crédito
        </HudBoton>
      </template>
    </HudDialogo>
    <ConfirmarConMotivo
      v-model:abierto="abiertoAnular"
      titulo="Anular el cobro"
      accion="Anular cobro"
      descripcion="Solo un cobro manual sin pagos ni ajustes: se revierte su comprobante."
      :cargando="anular.cargando.value"
      :error="anular.error.value"
      @confirmar="alAnular"
    />
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
