<script setup lang="ts">
/**
 * Reportes contables (`?vista=`): balance de prueba (jerárquico y plegable, por tercero o centro),
 * libro diario, libro mayor (o auxiliar de un tercero) y estados financieros con sus notas. Se
 * imprimen o guardan como PDF desde el navegador (encabezado con la entidad y el rango) y, con
 * `contabilidad.exportar`, se descargan en CSV con la huella SHA-256 que entrega el backend. En la
 * sección «Reportes» de las empresas solo se ofrecen los estados financieros.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { Descarga } from '@/api/archivos'
import { buscarTerceros } from '@/api/contabilidad'
import { mensajeDeError } from '@/api/errores'
import type { Comprobante, EstadosFinancieros, FilaBalance, LibroMayor } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda } from '@/formato/decimales'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import SelectorCuenta from '@/hud/componentes/SelectorCuenta.vue'
import SelectorPersona, { type OpcionPersona } from '@/hud/componentes/SelectorPersona.vue'
import { usePestana } from '@/composables/usePestana'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import IImprimir from '~icons/tabler/printer'
import { balancePrueba, estadosFinancieros, exportarBalance, exportarDiario, exportarMayor, libroDiario, libroMayor } from '../api'
import ReporteContable from '../componentes/ReporteContable.vue'
import { arbolBalance, saldoCorrido, saldoNatural, totalesBalance } from '../reglas'

const TODAS = [
  { id: 'balance', texto: 'Balance de prueba' },
  { id: 'diario', texto: 'Libro diario' },
  { id: 'mayor', texto: 'Libro mayor' },
  { id: 'estados', texto: 'Estados financieros' },
] as const
type Vista = (typeof TODAS)[number]['id']

const route = useRoute()
const entidad = useEntidad()
const plan = usePlanCuentas()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const soloEstados = computed(() => route.params.seccion === 'reportes')
const PESTANAS = computed(() => (soloEstados.value ? TODAS.filter((p) => p.id === 'estados') : TODAS))
const elegida = usePestana(TODAS)
const vista = computed<Vista>(() => (soloEstados.value ? 'estados' : elegida.value))
const exporta = computed(() => entidad.tienePermiso('contabilidad.exportar'))

const hoy = hoyEn(zona.value)
const desde = ref(`${hoy.slice(0, 4)}-01-01`)
const hasta = ref(hoy)
const corte = ref(hoy)
const porTercero = ref(false)
const porCentro = ref(false)
const cuenta = ref('')
const tercero = ref<OpcionPersona | null>(null)
const rango = computed(() => ({ desde: desde.value, hasta: hasta.value }))
const textoRango = computed(() => (vista.value === 'estados' ? `Corte al ${fechaCalendario(corte.value)}` : `Del ${fechaCalendario(desde.value)} al ${fechaCalendario(hasta.value)}`))

const estado = ref<'inicio' | 'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const balance = ref<FilaBalance[]>([])
const diario = ref<Comprobante[]>([])
const mayor = ref<LibroMayor | null>(null)
const estados = ref<EstadosFinancieros | null>(null)
const huella = ref<Descarga | null>(null)

const nombres = computed(() => new Map(plan.cuentas.map((c) => [c.codigo, c.nombre])))
const etiquetaDetalle = (f: FilaBalance) => {
  const partes = [f.persona_id ? 'Tercero' : '', f.centro_costo_id ? `Centro ${plan.centroPorId.get(f.centro_costo_id)?.codigo ?? ''}` : ''].filter(Boolean)
  return porTercero.value || porCentro.value ? partes.join(' · ') || 'Sin detalle' : null
}
const arbol = computed(() => arbolBalance(balance.value, nombres.value, etiquetaDetalle))
const totales = computed(() => totalesBalance(balance.value))
const opcionesMayor = computed(() => plan.cuentas.map((c) => ({ codigo: c.codigo, nombre: c.nombre })))
const movimientos = computed(() => (mayor.value ? saldoCorrido(mayor.value) : []))
const filasDiario = computed(() =>
  diario.value.flatMap((c) =>
    c.lineas.map((l, i) => {
      const cta = plan.porId.get(l.cuenta_id)
      return { clave: `${c.id}-${i}`, fecha: i === 0 ? fechaCalendario(c.fecha) : '', comprobante: i === 0 ? `${c.tipo}-${c.numero ?? ''}` : '', cuenta: cta ? `${cta.codigo} · ${cta.nombre}` : '', debito: l.debito, credito: l.credito }
    }),
  ),
)
const COLUMNAS_DIARIO = [
  { clave: 'fecha', titulo: 'Fecha' },
  { clave: 'comprobante', titulo: 'Comprobante' },
  { clave: 'cuenta', titulo: 'Cuenta' },
  { clave: 'debito', titulo: 'Débito', alinear: 'fin' as const },
  { clave: 'credito', titulo: 'Crédito', alinear: 'fin' as const },
]
const filasMayor = computed(() => movimientos.value.map((m, i) => ({ ...m, clave: `${m.comprobante_id}-${i}`, fechaTexto: fechaCalendario(m.fecha), comprobante: `${m.tipo}-${m.numero}` })))
const COLUMNAS_MAYOR = [
  { clave: 'fechaTexto', titulo: 'Fecha' },
  { clave: 'comprobante', titulo: 'Comprobante' },
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'debito', titulo: 'Débito', alinear: 'fin' as const },
  { clave: 'credito', titulo: 'Crédito', alinear: 'fin' as const },
  { clave: 'saldo', titulo: 'Saldo', alinear: 'fin' as const },
]
const monto = (t: string) => (/^-?0(\.0+)?$/.test(t) ? '' : moneda(t))
const rutaComprobante = (c: string) => ({ name: 'modulo', params: { ...route.params, seccion: 'contabilidad', accion: 'comprobantes', id: c }, query: {} })

const exportar = useAccion(async () => {
  if (vista.value === 'balance') return exportarBalance(id.value, { ...rango.value, por_tercero: porTercero.value, por_centro_costo: porCentro.value })
  if (vista.value === 'diario') return exportarDiario(id.value, rango.value)
  return exportarMayor(id.value, cuenta.value, rango.value, tercero.value?.id)
})

async function alExportar() {
  huella.value = null
  const r = await exportar.ejecutar()
  if (r.ok) huella.value = r.valor
}

async function buscarTercero(q: string): Promise<OpcionPersona[]> {
  const r = await buscarTerceros(id.value, q)
  return r.datos.map((x) => ({ id: x.persona_id, nombre: x.nombre, detalle: x.documento ?? null }))
}

async function cargar() {
  huella.value = null
  if (vista.value === 'mayor' && !cuenta.value) {
    estado.value = 'inicio'
    return
  }
  estado.value = 'cargando'
  try {
    await plan.asegurar()
    if (vista.value === 'balance') balance.value = await balancePrueba(id.value, { ...rango.value, por_tercero: porTercero.value, por_centro_costo: porCentro.value })
    else if (vista.value === 'diario') diario.value = await libroDiario(id.value, rango.value)
    else if (vista.value === 'mayor') mayor.value = await libroMayor(id.value, cuenta.value, rango.value, tercero.value?.id)
    else estados.value = await estadosFinancieros(id.value, corte.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

function imprimir() {
  window.print()
}

watch([vista, desde, hasta, corte, porTercero, porCentro, cuenta, tercero], () => void cargar())
onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-reportes">
    <header class="encabezado">
      <h1 id="titulo-reportes">
        {{ soloEstados ? 'Estados financieros' : 'Reportes contables' }}
      </h1>
      <div class="botones">
        <HudBoton
          variante="secundario"
          :deshabilitado="estado !== 'listo'"
          @click="imprimir"
        >
          <IImprimir aria-hidden="true" /> Imprimir o guardar como PDF
        </HudBoton>
        <HudBoton
          v-if="exporta && vista !== 'estados'"
          variante="fantasma"
          :deshabilitado="estado !== 'listo'"
          :cargando="exportar.cargando.value"
          @click="alExportar"
        >
          Exportar CSV
        </HudBoton>
      </div>
    </header>
    <HudPestanas
      v-if="!soloEstados"
      :pestanas="PESTANAS"
      etiqueta="Reportes"
    />
    <p
      v-if="huella"
      class="ok"
      role="status"
    >
      Descargado {{ huella.nombre }}.<template v-if="huella.sha256">
        Huella SHA-256 para verificar el archivo: <code class="huella">{{ huella.sha256 }}</code>
      </template>
    </p>
    <p
      v-if="exportar.error.value"
      class="error"
      role="alert"
    >
      {{ exportar.error.value }}
    </p>

    <div class="filtros">
      <template v-if="vista === 'estados'">
        <HudFecha
          v-model="corte"
          etiqueta="Fecha de corte"
        />
      </template>
      <template v-else>
        <HudFecha
          v-model="desde"
          etiqueta="Desde"
        />
        <HudFecha
          v-model="hasta"
          etiqueta="Hasta"
        />
      </template>
      <template v-if="vista === 'balance'">
        <label class="casilla">
          <input
            v-model="porTercero"
            type="checkbox"
          > Por tercero
        </label>
        <label class="casilla">
          <input
            v-model="porCentro"
            type="checkbox"
          > Por centro de costo
        </label>
      </template>
      <template v-if="vista === 'mayor'">
        <SelectorCuenta
          v-model="cuenta"
          :opciones="opcionesMayor"
          etiqueta="Cuenta del mayor"
        />
        <div class="tercero-mayor">
          <SelectorPersona
            v-if="!tercero"
            etiqueta="Auxiliar de un tercero (opcional)"
            :buscar="buscarTercero"
            @elegir="(p) => (tercero = p)"
          />
          <p
            v-else
            class="texto-2"
          >
            Auxiliar de <strong>{{ tercero.nombre }}</strong>
            <HudBoton
              variante="fantasma"
              @click="tercero = null"
            >
              Quitar el tercero
            </HudBoton>
          </p>
        </div>
      </template>
    </div>

    <HudEstado
      v-if="estado === 'inicio'"
      estado="vacio"
      mensaje="Elija la cuenta para ver su libro mayor."
    />
    <HudEstado
      v-else-if="estado === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="estado === 'error'"
      estado="error"
      :mensaje="error ?? undefined"
      @reintentar="cargar"
    />
    <div
      v-else
      class="area-impresion"
    >
      <div class="solo-impresion cabeza-impresa">
        <strong>{{ entidad.activa?.nombre }}</strong><template v-if="entidad.activa?.nit">
          · NIT {{ entidad.activa.nit }}
        </template>
        <p>{{ PESTANAS.find((p) => p.id === vista)?.texto }} · {{ textoRango }}</p>
      </div>

      <HudPanel
        v-if="vista === 'balance'"
        etiqueta="Balance de prueba"
      >
        <HudEstado
          v-if="!balance.length"
          estado="vacio"
          mensaje="No hay movimientos contabilizados en el rango."
        />
        <template v-else>
          <ReporteContable
            :arbol="arbol"
            titulo="Balance de prueba"
          />
          <p
            class="totales"
            :class="totales.cuadra ? 'texto-2' : 'aviso'"
          >
            Débitos {{ moneda(totales.debitos) }} · Créditos {{ moneda(totales.creditos) }} ·
            {{ totales.cuadra ? 'Sumas iguales' : 'Las sumas no son iguales: revise los comprobantes del rango' }}
          </p>
        </template>
      </HudPanel>

      <HudPanel
        v-else-if="vista === 'diario'"
        etiqueta="Libro diario"
      >
        <HudEstado
          v-if="!filasDiario.length"
          estado="vacio"
          mensaje="No hay comprobantes contabilizados en el rango."
        />
        <HudTabla
          v-else
          :filas="filasDiario"
          :columnas="COLUMNAS_DIARIO"
          clave="clave"
          titulo="Libro diario"
        >
          <template #celda-debito="{ fila }">
            <span class="cifra">{{ monto(fila.debito) }}</span>
          </template>
          <template #celda-credito="{ fila }">
            <span class="cifra">{{ monto(fila.credito) }}</span>
          </template>
        </HudTabla>
      </HudPanel>

      <HudPanel
        v-else-if="vista === 'mayor' && mayor"
        :etiqueta="`Mayor de ${mayor.cuenta.codigo} · ${mayor.cuenta.nombre}`"
      >
        <dl class="datos">
          <div>
            <dt>Saldo inicial</dt>
            <dd class="cifra">
              {{ moneda(saldoNatural(mayor.saldo_inicial, mayor.cuenta.naturaleza)) }}
            </dd>
          </div>
          <div>
            <dt>Saldo final</dt>
            <dd class="cifra">
              {{ moneda(saldoNatural(mayor.saldo_final, mayor.cuenta.naturaleza)) }}
            </dd>
          </div>
          <div>
            <dt>Naturaleza</dt>
            <dd>{{ mayor.cuenta.naturaleza === 'debito' ? 'Débito' : 'Crédito' }}</dd>
          </div>
        </dl>
        <HudEstado
          v-if="!filasMayor.length"
          estado="vacio"
          mensaje="La cuenta no tuvo movimientos en el rango."
        />
        <HudTabla
          v-else
          :filas="filasMayor"
          :columnas="COLUMNAS_MAYOR"
          clave="clave"
          titulo="Movimientos del mayor"
        >
          <template #celda-comprobante="{ fila }">
            <RouterLink :to="rutaComprobante(fila.comprobante_id)">
              {{ fila.comprobante }}
            </RouterLink>
          </template>
          <template #celda-debito="{ fila }">
            <span class="cifra">{{ monto(fila.debito) }}</span>
          </template>
          <template #celda-credito="{ fila }">
            <span class="cifra">{{ monto(fila.credito) }}</span>
          </template>
          <template #celda-saldo="{ fila }">
            <span class="cifra">{{ moneda(fila.saldo) }}</span>
          </template>
        </HudTabla>
      </HudPanel>

      <template v-else-if="vista === 'estados' && estados">
        <HudPanel etiqueta="Estado de situación financiera">
          <table
            class="estado"
            aria-label="Estado de situación financiera"
          >
            <tbody>
              <tr
                v-for="r in estados.situacion_financiera"
                :key="r.codigo"
              >
                <th scope="row">
                  {{ r.nombre }}
                </th>
                <td class="cifra">
                  {{ moneda(r.valor) }}
                </td>
              </tr>
            </tbody>
          </table>
        </HudPanel>
        <HudPanel etiqueta="Estado de resultados">
          <table
            class="estado"
            aria-label="Estado de resultados"
          >
            <tbody>
              <tr
                v-for="r in estados.resultados"
                :key="r.codigo"
              >
                <th scope="row">
                  {{ r.nombre }}
                </th>
                <td class="cifra">
                  {{ moneda(r.valor) }}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">
                  {{ estados.resultado_ejercicio.startsWith('-') ? 'Déficit del ejercicio' : 'Excedente del ejercicio' }}
                </th>
                <td class="cifra">
                  {{ moneda(estados.resultado_ejercicio) }}
                </td>
              </tr>
            </tfoot>
          </table>
          <p class="texto-2">
            {{ estados.cierre_contabilizado ? 'El cierre del año ya está contabilizado: el resultado está en el patrimonio.' : 'Sin cierre anual: el resultado aún no se traslada al patrimonio.' }}
          </p>
        </HudPanel>
        <HudPanel
          v-if="estados.notas.length"
          etiqueta="Notas"
        >
          <ol class="lista">
            <li
              v-for="n in estados.notas"
              :key="n.id"
            >
              <span class="crece">
                <strong>Nota {{ n.numero }}. {{ n.titulo }}</strong>
                <span>{{ n.texto }}</span>
              </span>
            </li>
          </ol>
        </HudPanel>
      </template>
    </div>
  </section>
</template>

<style scoped src="./contabilidad.css"></style>
<style scoped>
.estado {
  width: 100%;
  border-collapse: collapse;
}

.estado th,
.estado td {
  padding: 8px;
  border-bottom: 1px solid var(--linea);
  text-align: left;
  font-weight: 400;
}

.estado td {
  text-align: right;
}

.estado tfoot th,
.estado tfoot td {
  font-weight: 700;
}

.totales {
  font-family: var(--fuente-mono);
}

.huella {
  overflow-wrap: anywhere;
  font-family: var(--fuente-mono);
}

.tercero-mayor {
  grid-column: span 2;
}

.cabeza-impresa p {
  margin: 4px 0 12px;
}

@media (width < 720px) {
  .tercero-mayor {
    grid-column: auto;
  }
}
</style>
