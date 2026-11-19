<script setup lang="ts">
/**
 * Cuotas extraordinarias aprobadas por la asamblea: registrar una (concepto extraordinario,
 * finalidad, valor total, número de cuotas y primer mes) para que las liquidaciones de su
 * calendario la cobren, y anularla (las liquidaciones siguientes ya no la cobran).
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CuotaExtraordinaria } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { comparar, esDecimal, moneda } from '@/formato/decimales'
import { hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { anularCuota, crearCuota, cuotasExtraordinarias } from '../api'
import { moverPeriodo, periodoDe, textoPeriodo } from '../reglas'
import { useCartera } from '../store'

const props = defineProps<{ puede: boolean }>()

const entidad = useEntidad()
const cartera = useCartera()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<CuotaExtraordinaria[]>([])
const resultado = ref<string | null>(null)
const actual = periodoDe(hoyEn(entidad.zonaHoraria))
const form = ref({ concepto: '', finalidad: '', valor: '', cuotas: '6', primer: moverPeriodo(actual, 1) })
const problema = ref<string | null>(null)

const opcionesConcepto = computed(() => cartera.conceptos.filter((c) => c.tipo === 'extraordinaria' && c.activo).map((c) => ({ valor: c.id, etiqueta: `${c.codigo} · ${c.nombre}` })))
const opcionesMes = Array.from({ length: 6 }, (_, i) => moverPeriodo(actual, i)).map((p) => ({ valor: p, etiqueta: textoPeriodo(p) }))

const crear = useAccion(() =>
  crearCuota(id.value, { concepto_cobro_id: form.value.concepto, finalidad: form.value.finalidad.trim(), valor_total: form.value.valor, numero_cuotas: Number(form.value.cuotas), primer_periodo: form.value.primer }),
)
const anular = useAccion((_c, cuotaId: string) => anularCuota(id.value, cuotaId))

async function alCrear() {
  const f = form.value
  problema.value = !f.concepto || !f.finalidad.trim()
    ? 'Elija el concepto y escriba la finalidad.'
    : !esDecimal(f.valor) || comparar(f.valor, '0') <= 0 || !/^\d+$/.test(f.cuotas) || Number(f.cuotas) < 1
      ? 'Escriba el valor total y el número de cuotas.'
      : null
  if (problema.value) return
  const r = await crear.ejecutar()
  if (!r.ok) return
  resultado.value = `Cuota «${r.valor.finalidad}» registrada: se cobra desde ${textoPeriodo(r.valor.primer_periodo)}.`
  form.value = { ...form.value, finalidad: '', valor: '' }
  await cargar()
}

async function alAnular(c: CuotaExtraordinaria) {
  if (!(await anular.ejecutar(c.id)).ok) return
  resultado.value = `Cuota «${c.finalidad}» anulada.`
  await cargar()
}

async function cargar() {
  try {
    const [l] = await Promise.all([cuotasExtraordinarias(id.value), cartera.asegurar(id.value)])
    lista.value = l
    form.value.concepto ||= opcionesConcepto.value[0]?.valor ?? ''
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
    <ul
      v-else-if="lista.length"
      class="lista"
      aria-label="Cuotas extraordinarias"
    >
      <li
        v-for="c in lista"
        :key="c.id"
      >
        <span class="crece">
          <strong>{{ c.finalidad }}</strong>
          <small>{{ c.numero_cuotas }} cuotas desde {{ textoPeriodo(c.primer_periodo) }}{{ c.destinacion_especifica ? ' · destinación específica' : '' }}</small>
        </span>
        <span class="cifra">{{ moneda(c.valor_total) }}</span>
        <HudInsignia :tono="c.estado === 'vigente' ? 'info' : 'neutro'">
          {{ c.estado === 'vigente' ? 'Vigente' : 'Anulada' }}
        </HudInsignia>
        <HudBoton
          v-if="props.puede && c.estado === 'vigente'"
          variante="fantasma"
          :cargando="anular.cargando.value"
          @click="alAnular(c)"
        >
          Anular<span class="solo-lector"> {{ c.finalidad }}</span>
        </HudBoton>
      </li>
    </ul>
    <p
      v-else
      class="texto-2"
    >
      No hay cuotas extraordinarias.
    </p>
    <HudPanel
      v-if="props.puede"
      etiqueta="Registrar cuota extraordinaria"
    >
      <form
        class="campos"
        novalidate
        @submit.prevent="alCrear"
      >
        <div class="filtros">
          <HudSelector
            v-model="form.concepto"
            etiqueta="Concepto"
            vacio="Elija el concepto"
            :opciones="opcionesConcepto"
          />
          <HudCampoMonto
            v-model="form.valor"
            etiqueta="Valor total"
          />
          <HudCampo
            v-model="form.cuotas"
            etiqueta="Número de cuotas"
            modo-entrada="numeric"
          />
          <HudSelector
            v-model="form.primer"
            etiqueta="Primera cuota"
            :opciones="opcionesMes"
          />
        </div>
        <HudCampo
          v-model="form.finalidad"
          etiqueta="Finalidad"
        />
        <p
          v-if="problema ?? crear.error.value ?? anular.error.value"
          class="error"
          role="alert"
        >
          {{ problema ?? crear.error.value ?? anular.error.value }}
        </p>
        <div class="botones">
          <HudBoton
            tipo="submit"
            :cargando="crear.cargando.value"
          >
            Registrar cuota
          </HudBoton>
        </div>
      </form>
    </HudPanel>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
