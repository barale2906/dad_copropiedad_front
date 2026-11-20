<script setup lang="ts">
/**
 * Acuerdos de pago: proponer uno por todo lo que debe una unidad (cuotas y primer vencimiento),
 * aprobarlo (otra cuenta: cuatro ojos; suspende la mora) y anularlo (la mora se reanuda). Los
 * vigentes muestran su situación hoy (al día, cumplido o incumplido) y lo pagado.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { AcuerdoPago, EstadoAcuerdo } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda } from '@/formato/decimales'
import { fechaCalendario, hoyEn, sumarDias } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useCuenta } from '@/stores/cuenta'
import { useEntidad } from '@/stores/entidad'
import { acuerdos as pedirAcuerdos, anularAcuerdo, aprobarAcuerdo, proponerAcuerdo } from '../api'
import ElegirUnidad from '../componentes/ElegirUnidad.vue'
import { accionesAcuerdo, ESTADO_ACUERDO, SITUACION_ACUERDO } from '../reglas'
import { useCartera } from '../store'

const entidad = useEntidad()
const cartera = useCartera()
const cuenta = useCuenta()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const hoy = hoyEn(entidad.zonaHoraria)
const permisos = computed(() => ({ aprobar: entidad.tienePermiso('cartera.liquidar'), anular: entidad.tienePermiso('cartera.ajustar') }))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<AcuerdoPago[]>([])
const filtro = ref<EstadoAcuerdo | ''>('')
const resultado = ref<string | null>(null)
const proponiendo = ref(false)
const form = ref({ bien: '', cuotas: '3', primer: sumarDias(hoy, 30), observaciones: '' })
const problema = ref<string | null>(null)

const opcionesEstado = (Object.keys(ESTADO_ACUERDO) as EstadoAcuerdo[]).map((valor) => ({ valor, etiqueta: ESTADO_ACUERDO[valor].texto }))
const filas = computed(() =>
  lista.value.filter((a) => !filtro.value || a.estado === filtro.value).map((a) => ({ a, acciones: accionesAcuerdo(a, permisos.value, cuenta.id) })),
)

const proponer = useAccion((clave) =>
  proponerAcuerdo(id.value, { bien_privado_id: form.value.bien, numero_cuotas: Number(form.value.cuotas), primer_vencimiento: form.value.primer, observaciones: form.value.observaciones.trim() || null }, clave),
)
const aprobar = useAccion((_c, a: AcuerdoPago) => aprobarAcuerdo(id.value, a.id), { alConflicto: () => cargar() })
const anular = useAccion((_c, a: AcuerdoPago) => anularAcuerdo(id.value, a.id), { alConflicto: () => cargar() })
const errorAccion = computed(() => aprobar.error.value ?? anular.error.value)

async function alProponer() {
  problema.value = !form.value.bien ? 'Elija la unidad.' : !/^\d+$/.test(form.value.cuotas) || Number(form.value.cuotas) < 1 ? 'Escriba el número de cuotas.' : null
  if (problema.value) return
  const r = await proponer.ejecutar()
  if (!r.ok) return
  proponiendo.value = false
  resultado.value = `Acuerdo de ${cartera.codigo(r.valor.bien_privado_id)} por ${moneda(r.valor.valor)} propuesto: lo debe aprobar otra cuenta.`
  await cargar()
}

async function alAprobar(a: AcuerdoPago) {
  if (!(await aprobar.ejecutar(a)).ok) return
  resultado.value = `Acuerdo de ${cartera.codigo(a.bien_privado_id)} aprobado: la mora queda suspendida mientras se cumpla.`
  await cargar()
}

async function alAnular(a: AcuerdoPago) {
  if (!(await anular.ejecutar(a)).ok) return
  resultado.value = `Acuerdo de ${cartera.codigo(a.bien_privado_id)} anulado: la mora se reanuda.`
  await cargar()
}

async function cargar() {
  try {
    const [l] = await Promise.all([pedirAcuerdos(id.value), cartera.asegurar(id.value), cuenta.asegurar().catch(() => undefined)])
    lista.value = l
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-acuerdos">
    <header class="encabezado">
      <div>
        <h1 id="titulo-acuerdos">
          Acuerdos de pago
        </h1>
        <p class="texto-2">
          Quien propone un acuerdo no lo puede aprobar: lo aprueba otra cuenta con permiso para liquidar.
        </p>
      </div>
      <HudBoton
        v-if="permisos.anular && !proponiendo"
        @click="proponiendo = true"
      >
        Proponer acuerdo
      </HudBoton>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-if="errorAccion"
      class="error"
      role="alert"
    >
      {{ errorAccion }}
    </p>

    <HudPanel
      v-if="proponiendo"
      etiqueta="Proponer acuerdo"
    >
      <form
        class="campos"
        novalidate
        @submit.prevent="alProponer"
      >
        <p class="texto-2">
          El acuerdo cubre todo lo que debe la unidad hoy, repartido en cuotas mensuales.
        </p>
        <div class="filtros">
          <ElegirUnidad v-model="form.bien" />
          <HudCampo
            v-model="form.cuotas"
            etiqueta="Número de cuotas"
            modo-entrada="numeric"
          />
          <HudFecha
            v-model="form.primer"
            etiqueta="Primer vencimiento"
            :minimo="hoy"
          />
        </div>
        <HudCampo
          v-model="form.observaciones"
          etiqueta="Observaciones (opcional)"
          multilinea
        />
        <p
          v-if="problema ?? proponer.error.value"
          class="error"
          role="alert"
        >
          {{ problema ?? proponer.error.value }}
        </p>
        <div class="botones">
          <HudBoton
            tipo="submit"
            :cargando="proponer.cargando.value"
          >
            Proponer
          </HudBoton>
          <HudBoton
            variante="secundario"
            @click="proponiendo = false"
          >
            Cancelar
          </HudBoton>
        </div>
      </form>
    </HudPanel>

    <div class="filtros">
      <HudSelector
        v-model="filtro"
        etiqueta="Estado"
        vacio="Todos"
        :opciones="opcionesEstado"
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
      v-else-if="filas.length === 0"
      estado="vacio"
      :mensaje="filtro ? 'Ningún acuerdo en ese estado.' : 'Aún no hay acuerdos de pago.'"
    />
    <ul
      v-else
      class="lista"
      aria-label="Acuerdos de pago"
    >
      <li
        v-for="{ a, acciones } in filas"
        :key="a.id"
      >
        <span class="crece">
          <strong>{{ cartera.codigo(a.bien_privado_id) }} · {{ moneda(a.valor) }} en {{ a.cuotas.length }} cuota{{ a.cuotas.length === 1 ? '' : 's' }}</strong>
          <small>Desde el {{ fechaCalendario(a.fecha) }} · primera cuota el {{ a.cuotas[0] ? fechaCalendario(a.cuotas[0].vencimiento) : '—' }}{{ a.pagado ? ` · pagado ${moneda(a.pagado)}` : '' }}</small>
          <small v-if="a.observaciones">{{ a.observaciones }}</small>
          <small v-if="a.estado === 'propuesto' && a.propuesto_por === cuenta.id">Lo propuso usted: lo aprueba otra cuenta con permiso para liquidar.</small>
        </span>
        <HudInsignia :tono="ESTADO_ACUERDO[a.estado].tono">
          {{ ESTADO_ACUERDO[a.estado].texto }}
        </HudInsignia>
        <HudInsignia
          v-if="a.estado === 'vigente' && a.situacion && SITUACION_ACUERDO[a.situacion]"
          :tono="SITUACION_ACUERDO[a.situacion]!.tono"
        >
          {{ SITUACION_ACUERDO[a.situacion]!.texto }}
        </HudInsignia>
        <span class="botones">
          <HudBoton
            v-if="acciones.includes('aprobar')"
            variante="secundario"
            :cargando="aprobar.cargando.value"
            @click="alAprobar(a)"
          >
            Aprobar<span class="solo-lector"> el acuerdo de {{ cartera.codigo(a.bien_privado_id) }}</span>
          </HudBoton>
          <HudBoton
            v-if="acciones.includes('anular')"
            variante="fantasma"
            :cargando="anular.cargando.value"
            @click="alAnular(a)"
          >
            Anular<span class="solo-lector"> el acuerdo de {{ cartera.codigo(a.bien_privado_id) }}</span>
          </HudBoton>
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
