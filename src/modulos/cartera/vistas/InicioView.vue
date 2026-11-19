<script setup lang="ts">
/**
 * Inicio de la cartera: lo que se debe y lo vencido, las unidades en mora, las entradas del mes
 * y las tareas del periodo (liquidar el mes, causar los intereses, aprobar acuerdos). Con la
 * cartera por edades de las unidades que deben.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { AcuerdoPago, CarteraEdades, CausacionIntereses, LiquidacionCartera, MesFlujo } from '@/api/tipos'
import { comparar, moneda, restar } from '@/formato/decimales'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import TablaEdades from '@/hud/componentes/TablaEdades.vue'
import TarjetaResumen from '@/hud/componentes/TarjetaResumen.vue'
import { useEntidad } from '@/stores/entidad'
import { acuerdos as pedirAcuerdos, causaciones as pedirCausaciones, edades as pedirEdades, flujoCaja, liquidaciones as pedirLiquidaciones } from '../api'
import { periodoDe, textoPeriodo } from '../reglas'

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const hoy = hoyEn(entidad.zonaHoraria)
const periodo = periodoDe(hoy)
const ruta = (accion: string, recurso = '') => ({ name: 'modulo', params: { ...route.params, accion, id: recurso }, query: {} })

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const edades = ref<CarteraEdades | null>(null)
const liquidaciones = ref<LiquidacionCartera[]>([])
const causaciones = ref<CausacionIntereses[]>([])
const acuerdos = ref<AcuerdoPago[]>([])
const mes = ref<MesFlujo | null>(null)

const total = computed(() => edades.value?.total.total ?? '0')
const vencido = computed(() => restar(total.value, edades.value?.total.corriente ?? '0'))
const enMora = computed(() => (edades.value?.bienes ?? []).filter((b) => comparar(restar(b.total, b.corriente), '0') > 0))
const filas = computed(() => enMora.value.map((b) => ({ ...b, clave: b.bien_privado_id ?? b.codigo, nombre: b.codigo })))
const tareas = computed(() => {
  const t: { texto: string; accion: string }[] = []
  if (!liquidaciones.value.some((l) => l.periodo === periodo && l.estado === 'contabilizada')) t.push({ texto: `Liquidar ${textoPeriodo(periodo)}`, accion: 'liquidacion' })
  if (!causaciones.value.some((c) => c.periodo === periodo && c.estado === 'contabilizada')) t.push({ texto: `Causar los intereses de ${textoPeriodo(periodo)}`, accion: 'intereses' })
  const propuestos = acuerdos.value.filter((a) => a.estado === 'propuesto').length
  if (propuestos) t.push({ texto: `${propuestos} acuerdo${propuestos === 1 ? '' : 's'} de pago por aprobar`, accion: 'acuerdos' })
  return t
})

async function cargar() {
  estado.value = 'cargando'
  try {
    const [e, l, c, a, f] = await Promise.all([
      pedirEdades(id.value, hoy),
      pedirLiquidaciones(id.value),
      pedirCausaciones(id.value).catch(() => []),
      pedirAcuerdos(id.value).catch(() => []),
      flujoCaja(id.value, periodo, periodo).catch(() => []),
    ])
    ;[edades.value, liquidaciones.value, causaciones.value, acuerdos.value, mes.value] = [e, l, c, a, f[0] ?? null]
    estado.value = 'listo'
  } catch (err) {
    error.value = mensajeDeError(err)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-inicio-cartera">
    <header>
      <h1 id="titulo-inicio-cartera">
        Cartera
      </h1>
      <p class="texto-2">
        Lo que deben las unidades al {{ fechaCalendario(hoy) }} y lo que falta hacer en {{ textoPeriodo(periodo) }}.
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
          titulo="Cartera total"
          :valor="moneda(total)"
          :detalle="`${edades?.bienes.length ?? 0} unidades con saldo`"
          tono="info"
          :a="ruta('saldos')"
        />
        <TarjetaResumen
          titulo="Vencido"
          :valor="moneda(vencido)"
          :detalle="`${enMora.length} unidad${enMora.length === 1 ? '' : 'es'} en mora`"
          :tono="enMora.length ? 'aviso' : 'exito'"
          :a="ruta('saldos')"
        />
        <TarjetaResumen
          v-if="mes"
          titulo="Entradas del mes"
          :valor="moneda(mes.entradas)"
          detalle="Recaudado en las cuentas de tesorería"
          tono="exito"
          :a="ruta('recaudos')"
        />
      </div>

      <HudPanel etiqueta="Tareas del periodo">
        <p
          v-if="tareas.length === 0"
          class="texto-2"
        >
          Todo al día: el mes está liquidado y los intereses causados.
        </p>
        <ul
          v-else
          class="lista"
          aria-label="Tareas del periodo"
        >
          <li
            v-for="t in tareas"
            :key="t.texto"
          >
            <span class="crece">{{ t.texto }}</span>
            <RouterLink :to="ruta(t.accion)">
              Ir<span class="solo-lector"> a {{ t.texto.toLowerCase() }}</span>
            </RouterLink>
          </li>
        </ul>
      </HudPanel>

      <HudPanel etiqueta="Unidades en mora">
        <p
          v-if="filas.length === 0"
          class="texto-2"
        >
          Ninguna unidad tiene saldo vencido.
        </p>
        <TablaEdades
          v-else
          :filas="filas"
          titulo="Unidades en mora por edades"
        >
          <template #nombre="{ fila }">
            <RouterLink :to="ruta('saldos', fila.clave)">
              {{ fila.nombre }}
            </RouterLink>
          </template>
        </TablaEdades>
      </HudPanel>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
