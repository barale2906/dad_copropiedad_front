<script setup lang="ts">
/**
 * Novedades de la nómina en un rango de fechas (el mes en curso por omisión) y, si se elige,
 * de un empleado: registrar (el formulario cambia según la medida) y anular con motivo. Las
 * anuladas se marcan; en un periodo aprobado ya no se registran ni se anulan. Sin
 * `nomina.salarios.ver` los valores llegan en 0 y no se muestran; sin
 * `personas.datos_sensibles.ver` las incapacidades no aparecen.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { NovedadNomina, NuevaNovedad, PeriodoNomina } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda, numero } from '@/formato/decimales'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import { TIPO_NOVEDAD } from '@/formato/nomina'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import { anularNovedad, novedades as pedirNovedades, periodos as pedirPeriodos, registrarNovedad } from '../api'
import FormNovedad from '../componentes/FormNovedad.vue'
import { fechaCerrada } from '../reglas'
import { useNomina } from '../store'

const entidad = useEntidad()
const nomina = useNomina()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const hoy = hoyEn(entidad.zonaHoraria)
const puedeRegistrar = computed(() => entidad.tienePermiso('nomina.novedades.registrar'))
const verValores = computed(() => entidad.tienePermiso('nomina.salarios.ver'))
const verSensibles = computed(() => entidad.tienePermiso('personas.datos_sensibles.ver'))

const desde = ref(`${hoy.slice(0, 8)}01`)
const hasta = ref(hoy)
const contrato = ref('')
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<NovedadNomina[]>([])
const periodos = ref<PeriodoNomina[]>([])
const resultado = ref<string | null>(null)

const opcionesContrato = computed(() =>
  nomina.conContratoVigente.map((x) => ({ valor: x.contrato.contrato.id, etiqueta: `${x.empleado.codigo} · ${x.empleado.nombre}` })),
)
const opcionesFiltro = computed(() =>
  [...nomina.porContrato.entries()].map(([valor, x]) => ({ valor, etiqueta: `${x.empleado.codigo} · ${x.empleado.nombre}` })).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es', { numeric: true })),
)
const filas = computed(() =>
  [...lista.value]
    .sort((a, b) => b.desde.localeCompare(a.desde))
    .map((n) => ({
      ...n,
      empleado: nomina.nombreDelContrato(n.contrato_id),
      tipoTexto: TIPO_NOVEDAD[n.tipo],
      fechas: n.desde === n.hasta ? fechaCalendario(n.desde) : `${fechaCalendario(n.desde)} al ${fechaCalendario(n.hasta)}`,
      anulable: puedeRegistrar.value && !n.anulada && !fechaCerrada(periodos.value, n.desde),
    })),
)
const COLUMNAS = [
  { clave: 'fechas', titulo: 'Fechas' },
  { clave: 'empleado', titulo: 'Empleado' },
  { clave: 'tipoTexto', titulo: 'Novedad' },
  { clave: 'cantidad', titulo: 'Cantidad', alinear: 'fin' as const },
  { clave: 'acciones', titulo: 'Acciones' },
]
const cerrada = (f: string) => fechaCerrada(periodos.value, f)
const rangoValido = computed(() => !!desde.value && !!hasta.value && desde.value <= hasta.value)

const registrando = ref(false)
const anulando = ref<NovedadNomina | null>(null)
const abiertoAnular = computed({ get: () => !!anulando.value, set: (v: boolean) => !v && (anulando.value = null) })
const registrar = useAccion((_c, contratoId: string, datos: NuevaNovedad) => registrarNovedad(id.value, contratoId, datos))
const anular = useAccion((_c, n: NovedadNomina, motivo: string) => anularNovedad(id.value, n.id, motivo), { alConflicto: () => cargar() })

function cantidadDe(n: NovedadNomina): string {
  if (n.medida === 'dias') {
    const d = Math.round((Date.parse(n.hasta) - Date.parse(n.desde)) / 86_400_000) + 1
    return `${d} ${d === 1 ? 'día' : 'días'}`
  }
  if (n.medida === 'horas') return `${numero(n.cantidad)} h`
  return verValores.value ? moneda(n.cantidad) : '—'
}

async function alRegistrar(contratoId: string, datos: NuevaNovedad) {
  const r = await registrar.ejecutar(contratoId, datos)
  if (!r.ok) return
  registrando.value = false
  resultado.value = `Novedad registrada: ${TIPO_NOVEDAD[r.valor.tipo].toLowerCase()} de ${nomina.nombreDelContrato(contratoId)}. Si el periodo ya estaba liquidado, liquídelo de nuevo.`
  await cargar()
}

async function alAnular(motivo: string) {
  if (!anulando.value) return
  const r = await anular.ejecutar(anulando.value, motivo)
  if (!r.ok) return
  anulando.value = null
  resultado.value = 'Novedad anulada: ya no entra a la liquidación.'
  await cargar()
}

function abrirRegistro() {
  registrar.reiniciar()
  registrando.value = true
}

function pedirAnular(n: NovedadNomina) {
  anular.reiniciar()
  anulando.value = n
}

async function cargar() {
  if (!rangoValido.value) return
  estado.value = 'cargando'
  try {
    const [n, p] = await Promise.all([pedirNovedades(id.value, desde.value, hasta.value, contrato.value || undefined), pedirPeriodos(id.value), nomina.asegurarFichas(id.value)])
    ;[lista.value, periodos.value] = [n, p]
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch([desde, hasta, contrato], () => void cargar())
onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-novedades">
    <header class="encabezado">
      <h1 id="titulo-novedades">
        Novedades
      </h1>
      <HudBoton
        v-if="puedeRegistrar"
        :deshabilitado="estado !== 'listo'"
        @click="abrirRegistro"
      >
        <IMas aria-hidden="true" /> Registrar novedad
      </HudBoton>
    </header>
    <p class="texto-2">
      Horas extra, recargos, ausencias, vacaciones, bonificaciones y deducciones que entran a la liquidación del periodo.
    </p>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <div class="filtros">
      <HudFecha
        v-model="desde"
        etiqueta="Desde"
      />
      <HudFecha
        v-model="hasta"
        etiqueta="Hasta"
        :minimo="desde || undefined"
        :error="rangoValido ? null : 'La fecha final va después de la inicial.'"
      />
      <HudSelector
        v-model="contrato"
        etiqueta="Empleado"
        vacio="Todos"
        :opciones="opcionesFiltro"
      />
    </div>
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
      mensaje="No hay novedades en esas fechas."
    />
    <HudTabla
      v-else
      :filas="filas"
      :columnas="COLUMNAS"
      clave="id"
      titulo="Novedades"
    >
      <template #celda-tipoTexto="{ fila }">
        <span :class="{ anulada: fila.anulada }">{{ fila.tipoTexto }}</span>
        <HudInsignia
          v-if="fila.anulada"
          tono="neutro"
        >
          Anulada
        </HudInsignia>
        <small v-if="fila.descripcion"> · {{ fila.descripcion }}</small>
      </template>
      <template #celda-cantidad="{ fila }">
        <span class="cifra">{{ cantidadDe(fila) }}</span>
      </template>
      <template #celda-acciones="{ fila }">
        <HudBoton
          v-if="fila.anulable"
          variante="fantasma"
          @click="pedirAnular(fila)"
        >
          Anular<span class="solo-lector"> {{ fila.tipoTexto }} de {{ fila.empleado }}</span>
        </HudBoton>
      </template>
    </HudTabla>

    <HudDialogo
      v-model:abierto="registrando"
      titulo="Registrar novedad"
    >
      <p
        v-if="!opcionesContrato.length"
        class="aviso"
      >
        No hay empleados con un contrato vigente.
      </p>
      <FormNovedad
        v-else
        :contratos="opcionesContrato"
        :cerrada="cerrada"
        :ver-sensibles="verSensibles"
        :fecha-inicial="hoy"
        :cargando="registrar.cargando.value"
        :error="registrar.error.value"
        @registrar="alRegistrar"
      />
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="registrando = false"
        >
          Cerrar
        </HudBoton>
      </template>
    </HudDialogo>

    <ConfirmarConMotivo
      v-model:abierto="abiertoAnular"
      titulo="Anular la novedad"
      accion="Anular"
      descripcion="La novedad deja de entrar a la liquidación. Si el periodo ya estaba liquidado, liquídelo de nuevo."
      :cargando="anular.cargando.value"
      :error="anular.error.value"
      @confirmar="alAnular"
    />
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
<style scoped>
.anulada {
  text-decoration: line-through;
}
</style>
