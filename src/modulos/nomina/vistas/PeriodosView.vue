<script setup lang="ts">
/**
 * Periodos de la nómina y, con `:id`, el periodo con sus liquidaciones. Abierto → liquidado (se
 * puede volver a liquidar) → aprobado (por **otra** cuenta: a quien liquidó se le muestra
 * «pendiente de aprobación») → pagado. Desde que se aprueba hay desprendibles (PDF y correo).
 * Con la contabilidad, aprobar y pagar contabilizan solos.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { guardarBlob, type ArchivoRecibido } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { EnvioDesprendibles, LiquidacionNomina, PeriodicidadPago, PeriodoNomina } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { opcionesDe } from '@/composables/textos-acceso'
import { moneda, sumar } from '@/formato/decimales'
import { fechaCalendario, fechaHora, hoyEn } from '@/formato/fechas'
import { ESTADO_PERIODO, PERIODICIDAD, textoPeriodo } from '@/formato/nomina'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import VisorPdf from '@/hud/componentes/VisorPdf.vue'
import { useCuenta } from '@/stores/cuenta'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { abrirPeriodo, aprobar, desprendible, enviarDesprendibles, liquidar, pagar, periodo as pedirPeriodo, periodos as pedirPeriodos } from '../api'
import LiquidacionEmpleado from '../componentes/LiquidacionEmpleado.vue'
import { accionesPeriodo, conDesprendibles, iniciosDePeriodo, pendienteDeOtro } from '../reglas'
import { useNomina } from '../store'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const cuenta = useCuenta()
const nomina = useNomina()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const hoy = hoyEn(entidad.zonaHoraria)
const periodoId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (x = '') => ({ name: 'modulo', params: { ...route.params, accion: 'periodos', id: x }, query: {} })
const rutaReglas = computed(() => ({ name: 'modulo', params: { ...route.params, seccion: 'contabilidad', accion: 'configuracion', id: '' }, query: {} }))
const q = computed(() => ({ liquidar: entidad.tienePermiso('nomina.liquidar'), aprobar: entidad.tienePermiso('nomina.aprobar') }))
const verSalarios = computed(() => entidad.tienePermiso('nomina.salarios.ver'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<PeriodoNomina[]>([])
const actual = ref<PeriodoNomina | null>(null)
const liquidaciones = ref<LiquidacionNomina[]>([])
const resultado = ref<string | null>(null)
const envio = ref<EnvioDesprendibles | null>(null)

const filas = computed(() => lista.value.map((p) => ({ ...p, texto: textoPeriodo(p), mio: pendienteDeOtro(p, cuenta.id) })))
const COLUMNAS = [
  { clave: 'texto', titulo: 'Periodo' },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'fecha_pago', titulo: 'Pagado el' },
]
const acciones = computed(() => (actual.value ? accionesPeriodo(actual.value, q.value, cuenta.id) : []))
const totalNeto = computed(() => sumar('0', ...liquidaciones.value.map((l) => l.neto)))
const totalAportes = computed(() => sumar('0', ...liquidaciones.value.map((l) => l.aportes_empleador)))
const ordenadas = computed(() => [...liquidaciones.value].sort((a, b) => nomina.nombre(a.empleado_id).localeCompare(nomina.nombre(b.empleado_id), 'es', { numeric: true })))

// Abrir un periodo
const abriendo = ref(false)
const periodicidad = ref<PeriodicidadPago>('mensual')
const mes = ref(hoy.slice(0, 7))
const inicio = ref('')
const inicios = computed(() => (mes.value ? iniciosDePeriodo(periodicidad.value, mes.value) : []).map((valor) => ({ valor, etiqueta: fechaCalendario(valor) })))
const abrir = useAccion(() => abrirPeriodo(id.value, periodicidad.value, inicio.value))
watch(inicios, (o) => (inicio.value = o[0]?.valor ?? ''), { immediate: true })

function abrirDialogo() {
  abrir.reiniciar()
  abriendo.value = true
}

async function alAbrir() {
  const r = await abrir.ejecutar()
  if (!r.ok) return
  abriendo.value = false
  resultado.value = `Periodo abierto: ${textoPeriodo(r.valor)}. Ya se puede liquidar.`
  await router.push(ruta(r.valor.id))
}

// Acciones del periodo
const liquidacion = useAccion(() => liquidar(id.value, periodoId.value), { alConflicto: () => cargar() })
const aprobacion = useAccion(() => aprobar(id.value, periodoId.value))
const pagando = ref(false)
const fechaPago = ref(hoy)
const pago = useAccion(() => pagar(id.value, periodoId.value, fechaPago.value), { alConflicto: () => cargar() })
const envioCorreo = useAccion(() => enviarDesprendibles(id.value, periodoId.value), { alConflicto: () => cargar() })
/**
 * 409 `conflicto` al aprobar: hubo novedades después de liquidar (a quien liquidó no se le
 * ofrece aprobar), así que se ofrece liquidar de nuevo.
 */
const reliquidar = computed(() => aprobacion.codigo.value === 'conflicto')
const reglaContable = computed(() => [aprobacion.codigo.value, pago.codigo.value].includes('regla_contable'))
const errores = computed(() => [liquidacion.error.value, aprobacion.error.value, pago.error.value, envioCorreo.error.value].filter(Boolean))

async function alLiquidar() {
  aprobacion.reiniciar()
  const r = await liquidacion.ejecutar()
  if (!r.ok) return
  actual.value = r.valor.periodo
  liquidaciones.value = r.valor.liquidaciones
  resultado.value = `Periodo liquidado: ${r.valor.liquidaciones.length} empleados. Lo aprueba otra persona con permiso para hacerlo.`
}

async function alAprobar() {
  const r = await aprobacion.ejecutar()
  if (!r.ok) return
  actual.value = r.valor
  resultado.value = 'Periodo aprobado: ya puede pagarlo y enviar los desprendibles.'
}

function abrirPago() {
  fechaPago.value = hoy
  pago.reiniciar()
  pagando.value = true
}

async function alPagar() {
  const r = await pago.ejecutar()
  if (!r.ok) return
  pagando.value = false
  actual.value = r.valor
  resultado.value = `Periodo pagado el ${fechaCalendario(fechaPago.value)}.`
}

async function alEnviar() {
  const r = await envioCorreo.ejecutar()
  if (!r.ok) return
  envio.value = r.valor
  resultado.value = `Se enviaron ${r.valor.enviados} desprendibles por correo.`
}

// Desprendible en el visor
const viendo = ref<{ nombre: string; archivo: ArchivoRecibido } | null>(null)
const abiertoVisor = computed({ get: () => !!viendo.value, set: (v: boolean) => !v && (viendo.value = null) })
const pidiendo = ref<string | null>(null)
const errorPdf = ref<string | null>(null)

async function verDesprendible(l: LiquidacionNomina) {
  errorPdf.value = null
  pidiendo.value = l.id
  try {
    viendo.value = { nombre: nomina.nombre(l.empleado_id), archivo: await desprendible(id.value, l.id) }
  } catch (e) {
    errorPdf.value = mensajeDeError(e)
  } finally {
    pidiendo.value = null
  }
}

function guardarDesprendible() {
  if (viendo.value) guardarBlob(viendo.value.archivo.blob, viendo.value.archivo.nombre)
}

async function cargar() {
  estado.value = 'cargando'
  try {
    await Promise.all([cuenta.asegurar().catch(() => undefined), nomina.asegurar(id.value)])
    if (periodoId.value) {
      if (verSalarios.value) {
        const r = await pedirPeriodo(id.value, periodoId.value)
        actual.value = r.periodo
        liquidaciones.value = r.liquidaciones
      } else {
        actual.value = (await pedirPeriodos(id.value)).find((p) => p.id === periodoId.value) ?? null
        liquidaciones.value = []
      }
    } else {
      lista.value = await pedirPeriodos(id.value)
    }
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(periodoId, () => {
  envio.value = null
  liquidacion.reiniciar()
  aprobacion.reiniciar()
  void cargar()
})
onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-periodos">
    <template v-if="periodoId">
      <RouterLink
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Periodos
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
      <HudEstado
        v-else-if="!actual"
        estado="vacio"
        mensaje="El periodo no existe."
      />
      <template v-else>
        <header class="encabezado">
          <div>
            <h1 id="titulo-periodos">
              Nómina {{ PERIODICIDAD[actual.periodicidad].toLowerCase() }}
            </h1>
            <p class="texto-2">
              {{ fechaCalendario(actual.desde) }} al {{ fechaCalendario(actual.hasta) }}
            </p>
          </div>
          <HudInsignia :tono="ESTADO_PERIODO[actual.estado].tono">
            {{ ESTADO_PERIODO[actual.estado].texto }}
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
        <p
          v-if="liquidacion.codigo.value === 'validacion'"
          class="aviso"
        >
          Falta un parámetro o una tabla vigente del catálogo laboral: la plataforma debe cargarlo antes de liquidar.
        </p>
        <p
          v-if="reglaContable"
          class="aviso"
        >
          Falta la regla contable de la nómina.
          <RouterLink :to="rutaReglas">
            Configure las reglas en la contabilidad
          </RouterLink>.
        </p>
        <p
          v-if="pendienteDeOtro(actual, cuenta.id)"
          class="aviso"
        >
          Pendiente de aprobación por otra persona: usted liquidó este periodo.
        </p>

        <div
          v-if="acciones.length || reliquidar"
          class="botones"
        >
          <HudBoton
            v-if="acciones.includes('liquidar')"
            :variante="actual.estado === 'abierto' || reliquidar ? 'primario' : 'secundario'"
            :cargando="liquidacion.cargando.value"
            @click="alLiquidar"
          >
            {{ actual.estado === 'abierto' ? 'Liquidar el periodo' : 'Liquidar de nuevo' }}
          </HudBoton>
          <HudBoton
            v-if="acciones.includes('aprobar')"
            :cargando="aprobacion.cargando.value"
            @click="alAprobar"
          >
            Aprobar la nómina
          </HudBoton>
          <HudBoton
            v-if="acciones.includes('pagar')"
            @click="abrirPago"
          >
            Registrar el pago
          </HudBoton>
          <HudBoton
            v-if="acciones.includes('desprendibles')"
            variante="secundario"
            :cargando="envioCorreo.cargando.value"
            @click="alEnviar"
          >
            Enviar desprendibles por correo
          </HudBoton>
        </div>
        <p
          v-if="envio && envio.sin_correo"
          class="aviso"
        >
          {{ envio.sin_correo }} empleado{{ envio.sin_correo === 1 ? '' : 's' }} no tiene{{ envio.sin_correo === 1 ? '' : 'n' }} correo:
          descargue su desprendible abajo y entrégueselo.
        </p>

        <HudPanel etiqueta="Datos del periodo">
          <dl class="datos">
            <div v-if="actual.liquidado_en">
              <dt>Liquidado</dt>
              <dd>{{ fechaHora(actual.liquidado_en, zona) }}{{ actual.liquidado_por === cuenta.id ? ' por usted' : '' }}</dd>
            </div>
            <div v-if="actual.aprobado_en">
              <dt>Aprobado</dt>
              <dd>{{ fechaHora(actual.aprobado_en, zona) }}{{ actual.aprobado_por === cuenta.id ? ' por usted' : '' }}</dd>
            </div>
            <div v-if="actual.fecha_pago">
              <dt>Pagado</dt>
              <dd>{{ fechaCalendario(actual.fecha_pago) }}</dd>
            </div>
            <div v-if="liquidaciones.length">
              <dt>Neto a pagar</dt>
              <dd class="cifra">
                {{ moneda(totalNeto) }}
              </dd>
            </div>
            <div v-if="liquidaciones.length">
              <dt>Aportes del empleador</dt>
              <dd class="cifra">
                {{ moneda(totalAportes) }}
              </dd>
            </div>
          </dl>
        </HudPanel>

        <HudPanel
          v-if="verSalarios"
          etiqueta="Liquidaciones"
        >
          <p
            v-if="!liquidaciones.length"
            class="texto-2"
          >
            El periodo aún no se ha liquidado.
          </p>
          <p
            v-if="errorPdf"
            class="error"
            role="alert"
          >
            {{ errorPdf }}
          </p>
          <div class="campos">
            <LiquidacionEmpleado
              v-for="l in ordenadas"
              :key="l.id"
              :liquidacion="l"
              :nombre="nomina.nombre(l.empleado_id)"
              :con-desprendible="conDesprendibles(actual.estado)"
              :cargando="pidiendo === l.id"
              @desprendible="verDesprendible(l)"
            />
          </div>
        </HudPanel>
        <p
          v-else
          class="texto-2"
        >
          Su rol no ve los salarios: las liquidaciones no se muestran.
        </p>

        <HudDialogo
          v-model:abierto="pagando"
          titulo="Registrar el pago"
        >
          <p>Marca pagada la nómina de {{ textoPeriodo(actual) }}{{ entidad.tieneModulo('contabilidad') ? ' y la contabiliza' : '' }}.</p>
          <HudFecha
            v-model="fechaPago"
            etiqueta="Fecha del pago"
            requerido
          />
          <template #acciones>
            <HudBoton
              variante="fantasma"
              @click="pagando = false"
            >
              Volver
            </HudBoton>
            <HudBoton
              :cargando="pago.cargando.value"
              :deshabilitado="!fechaPago"
              @click="alPagar"
            >
              Registrar el pago
            </HudBoton>
          </template>
        </HudDialogo>

        <HudDialogo
          v-model:abierto="abiertoVisor"
          :titulo="`Desprendible de ${viendo?.nombre ?? ''}`"
        >
          <VisorPdf
            v-if="viendo"
            :archivo="viendo.archivo.blob"
            :titulo="`Desprendible de ${viendo.nombre}`"
            @descargar="guardarDesprendible"
          />
          <template #acciones>
            <HudBoton
              variante="fantasma"
              @click="viendo = null"
            >
              Cerrar
            </HudBoton>
          </template>
        </HudDialogo>
      </template>
    </template>

    <template v-else>
      <header class="encabezado">
        <h1 id="titulo-periodos">
          Periodos de nómina
        </h1>
        <HudBoton
          v-if="q.liquidar"
          @click="abrirDialogo"
        >
          <IMas aria-hidden="true" /> Abrir periodo
        </HudBoton>
      </header>
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
        v-else-if="!filas.length"
        estado="vacio"
        mensaje="Aún no hay periodos. Abra el del mes para liquidarlo."
      />
      <HudTabla
        v-else
        :filas="filas"
        :columnas="COLUMNAS"
        clave="id"
        titulo="Periodos de nómina"
      >
        <template #celda-texto="{ fila }">
          <RouterLink :to="ruta(fila.id)">
            {{ fila.texto }}
          </RouterLink>
        </template>
        <template #celda-estado="{ fila }">
          <HudInsignia :tono="ESTADO_PERIODO[fila.estado].tono">
            {{ ESTADO_PERIODO[fila.estado].texto }}
          </HudInsignia>
          <small v-if="fila.mio"> · lo aprueba otra persona</small>
        </template>
        <template #celda-fecha_pago="{ fila }">
          {{ fila.fecha_pago ? fechaCalendario(fila.fecha_pago) : '—' }}
        </template>
      </HudTabla>

      <HudDialogo
        v-model:abierto="abriendo"
        titulo="Abrir periodo"
      >
        <div class="campos">
          <HudSelector
            v-model="periodicidad"
            etiqueta="Periodicidad"
            :opciones="opcionesDe(PERIODICIDAD)"
          />
          <HudCampo
            v-model="mes"
            etiqueta="Mes"
            tipo="month"
            requerido
          />
          <HudSelector
            v-if="periodicidad === 'quincenal'"
            v-model="inicio"
            etiqueta="Quincena que empieza el"
            :opciones="inicios"
          />
          <p
            v-if="abrir.error.value"
            class="error"
            role="alert"
          >
            {{ abrir.error.value }}
          </p>
        </div>
        <template #acciones>
          <HudBoton
            variante="fantasma"
            @click="abriendo = false"
          >
            Volver
          </HudBoton>
          <HudBoton
            :cargando="abrir.cargando.value"
            :deshabilitado="!inicio"
            @click="alAbrir"
          >
            Abrir el periodo
          </HudBoton>
        </template>
      </HudDialogo>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
