<script setup lang="ts">
/**
 * Intereses de mora: la tasa de referencia vigente, la vista previa de los intereses hasta una
 * fecha (no guarda) → causar y contabilizar; y las causaciones anteriores con su detalle (base,
 * días y tasa de cada tramo) y su anulación con motivo.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CalculoMora, Causado, CausacionIntereses, DetalleCausacion, TasaReferencia } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda, porcentaje } from '@/formato/decimales'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import FlujoDosPasos, { type PasoFlujo } from '@/hud/componentes/FlujoDosPasos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import * as api from '../api'
import { textoPeriodo } from '../reglas'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const hoy = hoyEn(entidad.zonaHoraria)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const tasas = ref<TasaReferencia[]>([])
const historial = ref<CausacionIntereses[]>([])
const hasta = ref(hoy)
const paso = ref<PasoFlujo>('editar')
const calculo = ref<CalculoMora | null>(null)
const causado = ref<Causado | null>(null)
const detalle = ref<DetalleCausacion | null>(null)
const anulando = ref<CausacionIntereses | null>(null)
const abiertoAnular = computed({ get: () => anulando.value !== null, set: (v) => !v && (anulando.value = null) })
const resultado = ref<string | null>(null)

const vigente = computed(() => tasas.value.find((t) => t.vigente_desde <= hoy && t.vigente_hasta >= hoy) ?? tasas.value[0] ?? null)

const previa = useAccion(() => api.vistaIntereses(id.value, hasta.value))
const causar = useAccion((clave) => api.causarIntereses(id.value, hasta.value, clave))
const verDetalle = useAccion((_c, c: CausacionIntereses) => api.causacion(id.value, c.id))
const anular = useAccion((_c, c: CausacionIntereses, motivo: string) => api.anularCausacion(id.value, c.id, motivo), { alConflicto: () => cargar() })

async function alPrevisualizar() {
  const r = await previa.ejecutar()
  if (!r.ok) return
  calculo.value = r.valor
  paso.value = 'revisar'
}

async function alCausar() {
  const r = await causar.ejecutar()
  if (!r.ok) return
  causado.value = r.valor
  paso.value = 'hecho'
  await cargar()
}

function reiniciar() {
  paso.value = 'editar'
  calculo.value = causado.value = null
  previa.reiniciar()
  causar.reiniciar()
}

async function alVerDetalle(c: CausacionIntereses) {
  const r = await verDetalle.ejecutar(c)
  if (r.ok) detalle.value = r.valor
}

async function alAnular(motivo: string) {
  if (!anulando.value) return
  if (!(await anular.ejecutar(anulando.value, motivo)).ok) return
  anulando.value = null
  resultado.value = 'Causación anulada: se revirtió su comprobante.'
  await cargar()
}

async function cargar() {
  try {
    ;[tasas.value, historial.value] = await Promise.all([api.tasasReferencia(id.value), api.causaciones(id.value)])
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-intereses">
    <header>
      <h1 id="titulo-intereses">
        Intereses de mora
      </h1>
      <p class="texto-2">
        Se calculan sobre lo vencido de los conceptos que generan interés, con la tasa de la política (a lo sumo 1,5 veces el interés bancario corriente).
      </p>
    </header>
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
      <p
        v-if="vigente"
        class="texto-2"
      >
        Tasa de referencia vigente: <strong>{{ porcentaje(vigente.tasa_efectiva_anual) }} efectivo anual</strong>
        ({{ vigente.resolucion }}, del {{ fechaCalendario(vigente.vigente_desde) }} al {{ fechaCalendario(vigente.vigente_hasta) }}).
      </p>
      <p
        v-if="resultado"
        class="ok"
        role="status"
      >
        {{ resultado }}
      </p>

      <FlujoDosPasos
        v-model:paso="paso"
        :cargando="previa.cargando.value || causar.cargando.value"
        :error="previa.error.value ?? causar.error.value"
        accion="Causar intereses"
        @previsualizar="alPrevisualizar"
        @confirmar="alCausar"
        @reiniciar="reiniciar"
      >
        <template #formulario>
          <HudFecha
            v-model="hasta"
            etiqueta="Calcular hasta"
            :maximo="hoy"
          />
        </template>
        <template #vista-previa>
          <div
            v-if="calculo"
            class="campos"
          >
            <p class="cifra texto-2">
              {{ calculo.bienes.length }} unidad(es) · total <strong>{{ moneda(calculo.total) }}</strong> hasta el {{ fechaCalendario(calculo.hasta) }}
            </p>
            <ul
              class="lista"
              aria-label="Intereses por unidad"
            >
              <li
                v-for="b in calculo.bienes"
                :key="b.bien_privado_id"
              >
                <span class="crece">
                  <strong>{{ b.bien_codigo }}</strong>
                  <small
                    v-for="d in b.detalle"
                    :key="d.obligacion_id"
                  >{{ d.dias }} días sobre {{ moneda(d.base) }} al {{ porcentaje(d.tasa_efectiva_anual) }} EA</small>
                </span>
                <span class="cifra">{{ moneda(b.total) }}</span>
              </li>
            </ul>
          </div>
        </template>
        <template #hecho>
          <p
            v-if="causado"
            class="ok"
          >
            Intereses de {{ textoPeriodo(causado.causacion.periodo) }} causados por {{ moneda(causado.causacion.total) }}.
            {{ causado.acuerdos_revisados ? `${causado.acuerdos_revisados} acuerdo(s) cambiaron de estado.` : '' }}
          </p>
        </template>
      </FlujoDosPasos>

      <HudPanel etiqueta="Causaciones anteriores">
        <p
          v-if="historial.length === 0"
          class="texto-2"
        >
          Aún no se han causado intereses.
        </p>
        <ul
          v-else
          class="lista"
          aria-label="Causaciones de intereses"
        >
          <li
            v-for="c in historial"
            :key="c.id"
          >
            <span class="crece">
              <strong>{{ textoPeriodo(c.periodo) }}</strong>
              <small>Hasta el {{ fechaCalendario(c.hasta) }}{{ c.motivo_anulacion ? ` · ${c.motivo_anulacion}` : '' }}</small>
            </span>
            <span class="cifra">{{ moneda(c.total) }}</span>
            <HudInsignia :tono="c.estado === 'anulada' ? 'neutro' : 'exito'">
              {{ c.estado === 'anulada' ? 'Anulada' : 'Contabilizada' }}
            </HudInsignia>
            <HudBoton
              variante="fantasma"
              @click="alVerDetalle(c)"
            >
              Detalle<span class="solo-lector"> de {{ textoPeriodo(c.periodo) }}</span>
            </HudBoton>
            <HudBoton
              v-if="c.estado === 'contabilizada'"
              variante="fantasma"
              @click="anulando = c"
            >
              Anular<span class="solo-lector"> la causación de {{ textoPeriodo(c.periodo) }}</span>
            </HudBoton>
          </li>
        </ul>
        <ul
          v-if="detalle"
          class="lista"
          :aria-label="`Detalle de ${textoPeriodo(detalle.causacion.periodo)}`"
        >
          <li
            v-for="d in detalle.detalle"
            :key="`${d.obligacion_id}-${d.desde}`"
          >
            <span class="crece">{{ fechaCalendario(d.desde) }} a {{ fechaCalendario(d.hasta) }} · {{ d.dias }} días sobre {{ moneda(d.base) }} al {{ porcentaje(d.tasa_efectiva_anual) }} EA</span>
            <span class="cifra">{{ moneda(d.valor) }}</span>
          </li>
        </ul>
        <p
          v-if="verDetalle.error.value"
          class="error"
          role="alert"
        >
          {{ verDetalle.error.value }}
        </p>
      </HudPanel>

      <ConfirmarConMotivo
        v-model:abierto="abiertoAnular"
        titulo="Anular la causación"
        accion="Anular causación"
        descripcion="Solo si no hay pagos ni ajustes sobre esos intereses: se revierte su comprobante."
        :cargando="anular.cargando.value"
        :error="anular.error.value"
        @confirmar="alAnular"
      />
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
