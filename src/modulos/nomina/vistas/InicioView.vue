<script setup lang="ts">
/**
 * Inicio de la nómina: el periodo en curso y su estado, los contratos a término fijo que vencen
 * en 45 días (el mismo plazo del aviso por correo; en rojo si ya no alcanza el preaviso de 30),
 * las cesantías por consignar en enero y febrero y los accesos a las tareas.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { CesantiasContrato, ContratoPorVencer, PeriodoNomina } from '@/api/tipos'
import { useCuenta } from '@/stores/cuenta'
import { moneda, sumar } from '@/formato/decimales'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import { ESTADO_PERIODO, textoPeriodo } from '@/formato/nomina'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import TarjetaResumen from '@/hud/componentes/TarjetaResumen.vue'
import { useEntidad } from '@/stores/entidad'
import { cesantias as pedirCesantias, periodos as pedirPeriodos, porVencer as pedirPorVencer } from '../api'
import { pendienteDeOtro, periodoDeLaFecha, semaforoContrato } from '../reglas'

const route = useRoute()
const entidad = useEntidad()
const cuenta = useCuenta()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const hoy = hoyEn(entidad.zonaHoraria)
const mes = Number(hoy.slice(5, 7))
const ruta = (accion: string, recurso = '') => ({ name: 'modulo', params: { ...route.params, accion, id: recurso }, query: {} })
const verSalarios = computed(() => entidad.tienePermiso('nomina.salarios.ver'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const periodos = ref<PeriodoNomina[]>([])
const porVencer = ref<ContratoPorVencer[]>([])
const cesantias = ref<CesantiasContrato[]>([])

const enCurso = computed(() => periodoDeLaFecha(periodos.value, hoy))
const porAprobar = computed(() => periodos.value.filter((p) => p.estado === 'liquidado'))
const sinPreaviso = computed(() => porVencer.value.filter((c) => semaforoContrato(c.fecha_fin, hoy).tono === 'peligro').length)
/** Las cesantías del año anterior se consignan a más tardar el 14 de febrero. */
const tiempoDeCesantias = computed(() => verSalarios.value && mes <= 2)
const totalCesantias = computed(() => sumar('0', ...cesantias.value.map((c) => c.cesantias)))

async function cargar() {
  estado.value = 'cargando'
  try {
    const [p, v, c] = await Promise.all([
      pedirPeriodos(id.value),
      pedirPorVencer(id.value),
      tiempoDeCesantias.value ? pedirCesantias(id.value, Number(hoy.slice(0, 4)) - 1).catch(() => []) : Promise.resolve([]),
      cuenta.asegurar().catch(() => undefined),
    ])
    ;[periodos.value, porVencer.value, cesantias.value] = [p, v, c]
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-inicio-nomina">
    <header>
      <h1 id="titulo-inicio-nomina">
        Nómina
      </h1>
      <p class="texto-2">
        Lo que hay que hacer en la nómina al {{ fechaCalendario(hoy) }}.
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
      <div class="filtros">
        <TarjetaResumen
          titulo="Periodo en curso"
          :valor="enCurso ? ESTADO_PERIODO[enCurso.estado].texto : 'Sin abrir'"
          :detalle="enCurso ? textoPeriodo(enCurso) : 'Abra el periodo del mes para liquidarlo.'"
          :tono="enCurso ? ESTADO_PERIODO[enCurso.estado].tono : 'aviso'"
          :a="ruta('periodos', enCurso?.id ?? '')"
        />
        <TarjetaResumen
          titulo="Contratos por vencer"
          :valor="String(porVencer.length)"
          :detalle="sinPreaviso ? `${sinPreaviso} sin tiempo para el preaviso` : 'En los próximos 45 días'"
          :tono="sinPreaviso ? 'peligro' : porVencer.length ? 'aviso' : 'exito'"
          :a="ruta('empleados')"
        />
        <TarjetaResumen
          v-if="tiempoDeCesantias"
          titulo="Cesantías por consignar"
          :valor="moneda(totalCesantias)"
          detalle="Del año pasado, a más tardar el 14 de febrero"
          tono="info"
          :a="ruta('reportes')"
        />
      </div>

      <HudPanel
        v-if="porAprobar.length"
        etiqueta="Periodos por aprobar"
      >
        <ul
          class="lista"
          aria-label="Periodos por aprobar"
        >
          <li
            v-for="p in porAprobar"
            :key="p.id"
          >
            <span class="crece">
              <strong>{{ textoPeriodo(p) }}</strong>
              <small v-if="pendienteDeOtro(p, cuenta.id)">Usted lo liquidó: lo aprueba otra persona.</small>
            </span>
            <RouterLink :to="ruta('periodos', p.id)">
              Revisar<span class="solo-lector"> el periodo {{ textoPeriodo(p) }}</span>
            </RouterLink>
          </li>
        </ul>
      </HudPanel>

      <HudPanel etiqueta="Contratos a término fijo por vencer">
        <p
          v-if="porVencer.length === 0"
          class="texto-2"
        >
          Ningún contrato a término fijo vence en los próximos 45 días.
        </p>
        <template v-else>
          <p class="texto-2">
            Para no prorrogarlo, entregue el preaviso a más tardar 30 días antes de que venza. Si la
            fecha límite ya pasó, el contrato se prorroga solo si no se termina.
          </p>
          <ul
            class="lista"
            aria-label="Contratos por vencer"
          >
            <li
              v-for="c in porVencer"
              :key="c.contrato_id"
            >
              <span class="crece">
                <RouterLink :to="ruta('empleados', c.empleado_id)">{{ c.codigo }} · {{ c.nombre }}</RouterLink>
                <small>Vence el {{ fechaCalendario(c.fecha_fin) }} · preaviso hasta el {{ fechaCalendario(c.fecha_limite_preaviso) }}</small>
              </span>
              <HudInsignia :tono="semaforoContrato(c.fecha_fin, hoy).tono">
                {{ semaforoContrato(c.fecha_fin, hoy).texto }}
              </HudInsignia>
            </li>
          </ul>
        </template>
      </HudPanel>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
