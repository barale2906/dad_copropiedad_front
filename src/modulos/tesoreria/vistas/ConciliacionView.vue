<script setup lang="ts">
/**
 * Conciliación bancaria de una cuenta (`:id`; sin él, elegir el banco), por pestañas: cargar el
 * extracto (asistente con mapeo de columnas), conciliar (automática y luego a mano en dos
 * columnas, partidas conciliatorias y recibos desde el extracto), historial (deshacer) e informe
 * a una fecha de corte, imprimible.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { Conciliacion, CuentaTesoreria, Extracto, InformeConciliacion, LineaLibros, LineaRef, MovimientoExtracto } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { usePestana } from '@/composables/usePestana'
import { comparar, moneda } from '@/formato/decimales'
import { fechaCalendario, fechaHora, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import IImprimir from '~icons/tabler/printer'
import {
  conciliaciones as pedirConciliaciones,
  conciliarAutomatico,
  conciliarManual,
  cuentasTesoreria,
  deshacerConciliacion,
  extractos as pedirExtractos,
  informeConciliacion,
  lineasLibros,
  marcarPartida,
  movimientosExtracto,
  reciboDesdeMovimiento,
} from '../api'
import AsistenteExtracto from '../componentes/AsistenteExtracto.vue'
import ConciliadorDosColumnas from '../componentes/ConciliadorDosColumnas.vue'

const PESTANAS = [
  { id: 'conciliar', texto: 'Conciliar' },
  { id: 'extracto', texto: 'Cargar extracto' },
  { id: 'historial', texto: 'Historial' },
  { id: 'informe', texto: 'Informe' },
] as const

const route = useRoute()
const entidad = useEntidad()
const pestana = usePestana(PESTANAS)
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const cuentaId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (c = '') => ({ name: 'modulo', params: { ...route.params, accion: 'conciliacion', id: c }, query: {} })
const concilia = computed(() => entidad.tienePermiso('tesoreria.conciliar'))
const hoy = hoyEn(zona.value)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const cuentas = ref<CuentaTesoreria[]>([])
const cuenta = computed(() => cuentas.value.find((c) => c.id === cuentaId.value) ?? null)
const bancos = computed(() => cuentas.value.filter((c) => c.tipo === 'banco'))
const listaExtractos = ref<Extracto[]>([])
const movimientos = ref<MovimientoExtracto[]>([])
const libros = ref<LineaLibros[]>([])
const historial = ref<Conciliacion[]>([])
const informe = ref<InformeConciliacion | null>(null)
const resultado = ref<string | null>(null)
const desde = ref(`${hoy.slice(0, 8)}01`)
const hasta = ref(hoy)
const tolerancia = ref('3')
const corte = ref(hoy)
const descripcionRecibo = ref('Consignación por identificar')

const pendientes = computed(() => movimientos.value.filter((m) => m.estado !== 'conciliado'))
/** Diferencia del informe: sin saldo del extracto no se puede decir si cuadra. */
const diferencia = computed((): { texto: string; tono: 'neutro' | 'exito' | 'peligro' } => {
  const d = informe.value?.diferencia
  if (d === null || d === undefined) return { texto: 'Sin saldo del extracto', tono: 'neutro' }
  return comparar(d, '0') === 0 ? { texto: 'Cuadra', tono: 'exito' } : { texto: moneda(d), tono: 'peligro' }
})
const rango = computed(() => ({ desde: desde.value, hasta: hasta.value }))

const automatica = useAccion(() => conciliarAutomatico(id.value, cuentaId.value, rango.value, Math.min(10, Number.parseInt(tolerancia.value, 10) || 0)))
const manual = useAccion((_c, movs: string[], lins: LineaRef[]) => conciliarManual(id.value, cuentaId.value, movs, lins))
const partida = useAccion((_c, m: MovimientoExtracto, valor: boolean) => marcarPartida(id.value, m.id, valor))
const recibo = useAccion((_c, m: MovimientoExtracto) => reciboDesdeMovimiento(id.value, m.id, descripcionRecibo.value))
const deshacer = useAccion((_c, c: Conciliacion) => deshacerConciliacion(id.value, c.id))
const errores = computed(() => [automatica.error.value, manual.error.value, partida.error.value, recibo.error.value, deshacer.error.value].filter(Boolean))

async function cargarConciliar() {
  const [m, l] = await Promise.all([movimientosExtracto(id.value, cuentaId.value, rango.value), lineasLibros(id.value, cuentaId.value, { ...rango.value, solo_pendientes: true })])
  movimientos.value = m
  libros.value = l
}

async function alAutomatica() {
  const r = await automatica.ejecutar()
  if (!r.ok) return
  await cargarConciliar()
  resultado.value = r.valor.length ? `Conciliación automática: ${r.valor.length} pareja(s) conciliadas.` : 'La conciliación automática no encontró parejas: concilie a mano.'
}

async function alManual(movs: string[], lins: LineaRef[]) {
  const r = await manual.ejecutar(movs, lins)
  if (!r.ok) return
  await cargarConciliar()
  resultado.value = `Conciliados ${movs.length} movimiento(s) con ${lins.length} línea(s) de libros.`
}

async function alPartida(m: MovimientoExtracto, valor: boolean) {
  const r = await partida.ejecutar(m, valor)
  if (!r.ok) return
  await cargarConciliar()
  resultado.value = valor ? `«${m.descripcion}» quedó como partida conciliatoria.` : `«${m.descripcion}» volvió a pendiente.`
}

async function alRecibo(m: MovimientoExtracto) {
  const r = await recibo.ejecutar(m)
  if (!r.ok) return
  await cargarConciliar()
  resultado.value = `Recibo por identificar creado por ${moneda(r.valor.valor)} y conciliado con el movimiento.`
}

async function alDeshacer(c: Conciliacion) {
  const r = await deshacer.ejecutar(c)
  if (!r.ok) return
  historial.value = await pedirConciliaciones(id.value, cuentaId.value)
  resultado.value = 'Conciliación deshecha: sus partidas volvieron a pendiente.'
}

/** Tras importar, solo se recarga la lista: el asistente queda en su paso «hecho», que ya lo anuncia. */
async function alImportar() {
  listaExtractos.value = await pedirExtractos(id.value, cuentaId.value).catch(() => listaExtractos.value)
}

function imprimir() {
  window.print()
}

async function cargar() {
  estado.value = 'cargando'
  resultado.value = null
  try {
    cuentas.value = await cuentasTesoreria(id.value)
    if (cuentaId.value) {
      if (pestana.value === 'conciliar') await cargarConciliar()
      else if (pestana.value === 'extracto') listaExtractos.value = await pedirExtractos(id.value, cuentaId.value)
      else if (pestana.value === 'historial') historial.value = await pedirConciliaciones(id.value, cuentaId.value)
      else informe.value = await informeConciliacion(id.value, cuentaId.value, corte.value)
    }
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch([cuentaId, pestana], () => void cargar(), { immediate: true })
watch([desde, hasta], () => pestana.value === 'conciliar' && cuentaId.value && void cargarConciliar())
watch(corte, () => pestana.value === 'informe' && void cargar())
</script>

<template>
  <section aria-labelledby="titulo-conciliacion">
    <template v-if="cuentaId">
      <RouterLink
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Bancos
      </RouterLink>
      <h1 id="titulo-conciliacion">
        Conciliación: {{ cuenta?.nombre ?? '' }}
      </h1>
      <HudPestanas
        :pestanas="PESTANAS"
        etiqueta="Conciliación"
      />
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

      <template v-else-if="pestana === 'extracto'">
        <HudPanel
          v-if="concilia"
          etiqueta="Cargar extracto"
        >
          <AsistenteExtracto
            :entidad-id="id"
            :cuenta-id="cuentaId"
            @importado="alImportar"
          />
        </HudPanel>
        <HudPanel etiqueta="Extractos cargados">
          <HudEstado
            v-if="!listaExtractos.length"
            estado="vacio"
            mensaje="Todavía no se ha cargado ningún extracto en esta cuenta."
          />
          <ul
            v-else
            class="lista"
            aria-label="Extractos cargados"
          >
            <li
              v-for="x in listaExtractos"
              :key="x.id"
            >
              <span class="crece">
                <strong>Del {{ fechaCalendario(x.desde) }} al {{ fechaCalendario(x.hasta) }}</strong>
                <small>{{ x.movimientos }} movimientos · cargado el {{ fechaHora(x.cargado_en, zona) }}{{ x.saldo_final ? ` · saldo final ${moneda(x.saldo_final)}` : '' }}</small>
              </span>
            </li>
          </ul>
        </HudPanel>
      </template>

      <template v-else-if="pestana === 'conciliar'">
        <div class="filtros">
          <HudFecha
            v-model="desde"
            etiqueta="Desde"
          />
          <HudFecha
            v-model="hasta"
            etiqueta="Hasta"
          />
          <HudCampo
            v-model="tolerancia"
            etiqueta="Días de tolerancia"
            modo-entrada="numeric"
            ayuda="Diferencia de fechas admitida (máximo 10)."
          />
          <HudBoton
            v-if="concilia"
            variante="secundario"
            :cargando="automatica.cargando.value"
            @click="alAutomatica"
          >
            Conciliación automática
          </HudBoton>
        </div>
        <HudCampo
          v-if="concilia"
          v-model="descripcionRecibo"
          etiqueta="Descripción de los recibos creados desde el extracto"
        />
        <HudPanel etiqueta="Conciliar a mano">
          <ConciliadorDosColumnas
            :movimientos="pendientes"
            :lineas="libros"
            :cargando="manual.cargando.value"
            @conciliar="alManual"
            @partida="alPartida"
            @recibo="alRecibo"
          />
        </HudPanel>
      </template>

      <HudPanel
        v-else-if="pestana === 'historial'"
        etiqueta="Historial de conciliaciones"
      >
        <HudEstado
          v-if="!historial.length"
          estado="vacio"
          mensaje="Todavía no hay conciliaciones en esta cuenta."
        />
        <ul
          v-else
          class="lista"
          aria-label="Conciliaciones"
        >
          <li
            v-for="c in [...historial].reverse()"
            :key="c.id"
          >
            <span class="crece">
              <strong>{{ c.accion === 'deshacer' ? 'Deshacer' : c.modo === 'automatica' ? 'Automática' : 'Manual' }} · {{ c.movimientos.length }} movimiento(s) y {{ c.lineas.length }} línea(s)</strong>
              <small>{{ fechaHora(c.en, zona) }}</small>
            </span>
            <HudInsignia
              v-if="c.deshecha"
              tono="neutro"
            >
              Deshecha
            </HudInsignia>
            <HudBoton
              v-else-if="c.accion === 'conciliar' && concilia"
              variante="fantasma"
              :cargando="deshacer.cargando.value"
              @click="alDeshacer(c)"
            >
              Deshacer<span class="solo-lector"> la conciliación del {{ fechaHora(c.en, zona) }}</span>
            </HudBoton>
          </li>
        </ul>
      </HudPanel>

      <template v-else>
        <div class="filtros">
          <HudFecha
            v-model="corte"
            etiqueta="Fecha de corte"
          />
          <HudBoton
            variante="secundario"
            :deshabilitado="!informe"
            @click="imprimir"
          >
            <IImprimir aria-hidden="true" /> Imprimir o guardar como PDF
          </HudBoton>
        </div>
        <div
          v-if="informe"
          class="area-impresion"
        >
          <div class="solo-impresion">
            <strong>{{ entidad.activa?.nombre }}</strong>
            <p>Conciliación bancaria de {{ cuenta?.nombre }} al {{ fechaCalendario(informe.corte) }}</p>
          </div>
          <HudPanel etiqueta="Saldos">
            <dl class="datos">
              <div>
                <dt>Saldo según el extracto</dt>
                <dd class="cifra">
                  {{ informe.saldo_extracto ? moneda(informe.saldo_extracto) : 'Sin extracto' }}
                </dd>
              </div>
              <div>
                <dt>Saldo en libros</dt>
                <dd class="cifra">
                  {{ moneda(informe.saldo_libros) }}
                </dd>
              </div>
              <div>
                <dt>Saldo conciliado</dt>
                <dd class="cifra">
                  {{ moneda(informe.saldo_conciliado) }}
                </dd>
              </div>
              <div>
                <dt>Diferencia</dt>
                <dd>
                  <HudInsignia :tono="diferencia.tono">
                    {{ diferencia.texto }}
                  </HudInsignia>
                </dd>
              </div>
            </dl>
          </HudPanel>
          <HudPanel etiqueta="En libros y no en el extracto (en tránsito)">
            <HudEstado
              v-if="!informe.libros_pendientes.length"
              estado="vacio"
              mensaje="Ninguna."
            />
            <ul
              v-else
              class="lista"
              aria-label="Partidas en tránsito"
            >
              <li
                v-for="l in informe.libros_pendientes"
                :key="`${l.comprobante_id}-${l.orden}`"
              >
                <span class="crece">{{ fechaCalendario(l.fecha) }} · {{ l.descripcion }}</span>
                <span class="cifra">{{ moneda(l.valor) }}</span>
              </li>
            </ul>
          </HudPanel>
          <HudPanel etiqueta="En el extracto y no en libros">
            <HudEstado
              v-if="!informe.extracto_pendientes.length"
              estado="vacio"
              mensaje="Ninguna."
            />
            <ul
              v-else
              class="lista"
              aria-label="Partidas del extracto sin registrar"
            >
              <li
                v-for="m in informe.extracto_pendientes"
                :key="m.id"
              >
                <span class="crece">{{ fechaCalendario(m.fecha) }} · {{ m.descripcion }}</span>
                <span class="cifra">{{ moneda(m.valor) }}</span>
              </li>
            </ul>
          </HudPanel>
        </div>
      </template>
    </template>

    <template v-else>
      <h1 id="titulo-conciliacion">
        Conciliación bancaria
      </h1>
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
        v-else-if="!bancos.length"
        estado="vacio"
        mensaje="No hay cuentas bancarias para conciliar."
      />
      <ul
        v-else
        class="lista"
        aria-label="Cuentas bancarias"
      >
        <li
          v-for="c in bancos"
          :key="c.id"
        >
          <span class="crece">
            <RouterLink :to="ruta(c.id)"><strong>{{ c.nombre }}</strong></RouterLink>
            <small>{{ c.banco }} {{ c.numero_enmascarado }}</small>
          </span>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
