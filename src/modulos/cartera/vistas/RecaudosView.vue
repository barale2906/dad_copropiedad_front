<script setup lang="ts">
/**
 * Recaudos (`?vista=`): registrar el pago de una unidad (se imputa solo según la política; si la
 * política lo permite se eligen las obligaciones; lo que sobra queda como anticipo) y ver la
 * imputación resultante; anular un recaudo de la sesión con motivo. Recaudo por referencia desde
 * el extracto del banco y aplicación a una unidad de los recibos «por identificar».
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CuentaTesoreria, EstadoCuenta, MedioRecibo, PoliticaCartera, Recaudo, RecaudoExtracto, Recibo } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { usePestana } from '@/composables/usePestana'
import { comparar, esDecimal, moneda } from '@/formato/decimales'
import { fechaCalendario, hoyEn, sumarDias } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import * as api from '../api'
import ElegirUnidad from '../componentes/ElegirUnidad.vue'
import { conSaldo, MEDIO, resumenRecaudo, textoPeriodo } from '../reglas'
import { useCartera } from '../store'

const PESTANAS = [
  { id: 'pago', texto: 'Pago de una unidad' },
  { id: 'referencia', texto: 'Por referencia (extracto)' },
  { id: 'identificar', texto: 'Por identificar' },
] as const

const entidad = useEntidad()
const cartera = useCartera()
const pestana = usePestana(PESTANAS)
const id = computed(() => entidad.activa?.entidad_id ?? '')
const hoy = hoyEn(entidad.zonaHoraria)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const cuentas = ref<CuentaTesoreria[]>([])
const politica = ref<PoliticaCartera | null>(null)
const form = ref({ bien: '', cuenta: '', fecha: hoy, valor: '', medio: 'transferencia' as MedioRecibo, referencia: '' })
const elegidas = ref<string[]>([])
const cuentaBien = ref<EstadoCuenta | null>(null)
const problema = ref<string | null>(null)
const resultados = ref<Recaudo[]>([])
const anulando = ref<Recaudo | null>(null)
const abiertoAnular = computed({ get: () => anulando.value !== null, set: (v) => !v && (anulando.value = null) })
const resultado = ref<string | null>(null)
const lote = ref({ cuenta: '', desde: sumarDias(hoy, -7), hasta: hoy })
const extracto = ref<RecaudoExtracto | null>(null)
const porIdentificar = ref<Recibo[]>([])
const destino = ref<Record<string, string>>({})

const opcionesCuenta = computed(() => cuentas.value.filter((c) => c.activa).map((c) => ({ valor: c.id, etiqueta: c.nombre })))
const opcionesMedio = (Object.keys(MEDIO) as MedioRecibo[]).map((valor) => ({ valor, etiqueta: MEDIO[valor] }))
const pendientes = computed(() => conSaldo(cuentaBien.value?.obligaciones ?? []))
const concepto = (obligacionId: string) => {
  const o = cuentaBien.value?.obligaciones.find((x) => x.id === obligacionId)
  return o ? `${o.concepto_nombre} de ${textoPeriodo(o.periodo)}` : 'Obligación'
}

const registrar = useAccion((clave) =>
  api.recaudar(
    id.value,
    {
      bien_privado_id: form.value.bien,
      cuenta_tesoreria_id: form.value.cuenta,
      fecha: form.value.fecha,
      valor: form.value.valor,
      medio: form.value.medio,
      referencia: form.value.referencia.trim() || null,
      obligaciones_elegidas: elegidas.value,
    },
    clave,
  ),
)
const anular = useAccion((_c, r: Recaudo, motivo: string) => api.anularRecaudo(id.value, r.recibo.id, motivo), { alConflicto: () => undefined })
const recaudarLote = useAccion(() => api.recaudarPorReferencia(id.value, lote.value.cuenta, lote.value.desde, lote.value.hasta))
const aplicar = useAccion((_c, r: Recibo) => api.aplicarRecibo(id.value, r.id, destino.value[r.id] ?? ''))

async function alRegistrar() {
  const f = form.value
  problema.value = !f.bien || !f.cuenta ? 'Elija la unidad y la cuenta donde entró el dinero.' : !esDecimal(f.valor) || comparar(f.valor, '0') <= 0 ? 'Escriba el valor recibido.' : null
  if (problema.value) return
  const r = await registrar.ejecutar()
  if (!r.ok) return
  resultados.value = [r.valor, ...resultados.value]
  resultado.value = `Pago de ${cartera.codigo(r.valor.bien_privado_id)} por ${moneda(r.valor.recibo.valor)}: ${resumenRecaudo(r.valor, moneda)}.`
  form.value = { ...form.value, valor: '', referencia: '' }
  elegidas.value = []
  await cargarCuentaBien()
}

async function alAnular(motivo: string) {
  if (!anulando.value) return
  const r = await anular.ejecutar(anulando.value, motivo)
  if (!r.ok) return
  resultados.value = resultados.value.filter((x) => x.recibo.id !== r.valor.id)
  anulando.value = null
  resultado.value = 'Recaudo anulado: las obligaciones recuperaron su saldo.'
  await cargarCuentaBien()
}

async function alRecaudarLote() {
  const r = await recaudarLote.ejecutar()
  if (r.ok) extracto.value = r.valor
}

async function alAplicar(r: Recibo) {
  const a = await aplicar.ejecutar(r)
  if (!a.ok) return
  resultado.value = `Recibo de ${moneda(r.valor)} aplicado a ${cartera.codigo(destino.value[r.id] ?? '')}.`
  porIdentificar.value = await api.recibosPorIdentificar(id.value).catch(() => [])
}

async function cargarCuentaBien() {
  cuentaBien.value = form.value.bien ? await api.estadoCuenta(id.value, form.value.bien).catch(() => null) : null
}

async function cargar() {
  try {
    const [c, p, r] = await Promise.all([api.cuentasTesoreria(id.value), api.politicas(id.value), api.recibosPorIdentificar(id.value).catch(() => []), cartera.asegurar(id.value)])
    cuentas.value = c
    politica.value = p[0] ?? null
    porIdentificar.value = r
    form.value.cuenta ||= opcionesCuenta.value[0]?.valor ?? ''
    lote.value.cuenta ||= opcionesCuenta.value[0]?.valor ?? ''
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(() => form.value.bien, () => {
  elegidas.value = []
  void cargarCuentaBien()
})
onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-recaudos">
    <header>
      <h1 id="titulo-recaudos">
        Recaudos
      </h1>
      <p class="texto-2">
        El pago se aplica solo a lo que debe la unidad según la política; lo que sobra queda como anticipo para la próxima liquidación.
      </p>
    </header>
    <HudPestanas
      :pestanas="PESTANAS"
      etiqueta="Formas de recaudar"
    />
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

    <template v-else-if="pestana === 'pago'">
      <HudPanel etiqueta="Registrar un pago">
        <form
          class="campos"
          novalidate
          @submit.prevent="alRegistrar"
        >
          <div class="filtros">
            <ElegirUnidad v-model="form.bien" />
            <HudSelector
              v-model="form.cuenta"
              etiqueta="Cuenta donde entró"
              vacio="Elija la cuenta"
              :opciones="opcionesCuenta"
            />
            <HudFecha
              v-model="form.fecha"
              etiqueta="Fecha del pago"
              :maximo="hoy"
            />
            <HudCampoMonto
              v-model="form.valor"
              etiqueta="Valor recibido"
            />
            <HudSelector
              v-model="form.medio"
              etiqueta="Medio"
              :opciones="opcionesMedio"
            />
            <HudCampo
              v-model="form.referencia"
              etiqueta="Referencia (opcional)"
              autocompletar="off"
            />
          </div>
          <template v-if="cuentaBien">
            <p class="texto-2">
              {{ cuentaBien.bien.codigo }} debe {{ moneda(cuentaBien.saldo) }} ({{ moneda(cuentaBien.vencido) }} vencido){{ comparar(cuentaBien.anticipos, '0') > 0 ? ` y tiene ${moneda(cuentaBien.anticipos)} de anticipo` : '' }}.
            </p>
            <fieldset
              v-if="politica?.permite_elegir_obligacion && pendientes.length"
              class="elegir"
            >
              <legend>Cubrir primero (opcional)</legend>
              <label
                v-for="o in pendientes"
                :key="o.id"
                class="casilla"
              >
                <input
                  v-model="elegidas"
                  type="checkbox"
                  :value="o.id"
                >
                {{ o.concepto_nombre }} de {{ textoPeriodo(o.periodo) }} · {{ moneda(o.saldo) }}
              </label>
            </fieldset>
          </template>
          <p
            v-if="problema ?? registrar.error.value"
            class="error"
            role="alert"
          >
            {{ problema ?? registrar.error.value }}
          </p>
          <div class="botones">
            <HudBoton
              tipo="submit"
              :cargando="registrar.cargando.value"
            >
              Registrar pago
            </HudBoton>
          </div>
        </form>
      </HudPanel>

      <HudPanel
        v-if="resultados.length"
        etiqueta="Pagos registrados en esta sesión"
      >
        <ul
          class="lista"
          aria-label="Pagos registrados"
        >
          <li
            v-for="r in resultados"
            :key="r.recibo.id"
          >
            <span class="crece">
              <strong>{{ cartera.codigo(r.bien_privado_id) }} · {{ moneda(r.recibo.valor) }}</strong>
              <small
                v-for="a in r.aplicado"
                :key="a.obligacion_id"
              >{{ concepto(a.obligacion_id) }}: {{ moneda(a.valor) }}</small>
              <small v-if="comparar(r.anticipo, '0') > 0">Anticipo: {{ moneda(r.anticipo) }}</small>
            </span>
            <HudBoton
              variante="fantasma"
              @click="anulando = r"
            >
              Anular<span class="solo-lector"> el pago de {{ cartera.codigo(r.bien_privado_id) }}</span>
            </HudBoton>
          </li>
        </ul>
      </HudPanel>
    </template>

    <HudPanel
      v-else-if="pestana === 'referencia'"
      etiqueta="Recaudar por referencia"
    >
      <form
        class="campos"
        novalidate
        @submit.prevent="alRecaudarLote"
      >
        <p class="texto-2">
          Toma los créditos del extracto cargado en la conciliación cuya referencia es la de una unidad, los recauda y los concilia.
        </p>
        <div class="filtros">
          <HudSelector
            v-model="lote.cuenta"
            etiqueta="Cuenta del extracto"
            :opciones="opcionesCuenta"
          />
          <HudFecha
            v-model="lote.desde"
            etiqueta="Desde"
            :maximo="lote.hasta"
          />
          <HudFecha
            v-model="lote.hasta"
            etiqueta="Hasta"
            :minimo="lote.desde"
          />
        </div>
        <p
          v-if="recaudarLote.error.value"
          class="error"
          role="alert"
        >
          {{ recaudarLote.error.value }}
        </p>
        <div class="botones">
          <HudBoton
            tipo="submit"
            :cargando="recaudarLote.cargando.value"
          >
            Recaudar por referencia
          </HudBoton>
        </div>
      </form>
      <div
        v-if="extracto"
        class="campos"
        role="status"
      >
        <p class="ok">
          {{ extracto.recaudos.length }} recaudo(s) identificados{{ extracto.sin_identificar ? `; ${extracto.sin_identificar} crédito(s) sin identificar (aplíquelos en «Por identificar»)` : '' }}.
        </p>
        <ul
          v-if="extracto.recaudos.length"
          class="lista"
          aria-label="Recaudos identificados"
        >
          <li
            v-for="r in extracto.recaudos"
            :key="r.recibo.id"
          >
            <span class="crece"><strong>{{ cartera.codigo(r.bien_privado_id) }}</strong><small>{{ fechaCalendario(r.recibo.fecha) }}</small></span>
            <span class="cifra">{{ moneda(r.recibo.valor) }}</span>
          </li>
        </ul>
      </div>
    </HudPanel>

    <HudPanel
      v-else
      etiqueta="Recibos por identificar"
    >
      <p
        v-if="porIdentificar.length === 0"
        class="texto-2"
      >
        No hay recibos por identificar.
      </p>
      <ul
        v-else
        class="lista"
        aria-label="Recibos por identificar"
      >
        <li
          v-for="r in porIdentificar"
          :key="r.id"
        >
          <span class="crece">
            <strong>{{ moneda(r.sin_aplicar) }} sin aplicar</strong>
            <small>{{ fechaCalendario(r.fecha) }} · {{ r.descripcion }}{{ r.referencia ? ` · ref. ${r.referencia}` : '' }}</small>
          </span>
          <ElegirUnidad
            :model-value="destino[r.id] ?? ''"
            :etiqueta="`Unidad del recibo de ${moneda(r.valor)}`"
            @update:model-value="destino = { ...destino, [r.id]: $event }"
          />
          <HudBoton
            variante="secundario"
            :cargando="aplicar.cargando.value"
            :deshabilitado="!destino[r.id]"
            @click="alAplicar(r)"
          >
            Aplicar<span class="solo-lector"> el recibo de {{ moneda(r.valor) }}</span>
          </HudBoton>
        </li>
      </ul>
      <p
        v-if="aplicar.error.value"
        class="error"
        role="alert"
      >
        {{ aplicar.error.value }}
      </p>
    </HudPanel>

    <ConfirmarConMotivo
      v-model:abierto="abiertoAnular"
      titulo="Anular el pago"
      accion="Anular pago"
      descripcion="Se anula el recibo y se revierte su pronto pago: las obligaciones recuperan su saldo."
      :cargando="anular.cargando.value"
      :error="anular.error.value"
      @confirmar="alAnular"
    />
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
.elegir {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--linea);
}
</style>
