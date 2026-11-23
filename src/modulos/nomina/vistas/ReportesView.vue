<script setup lang="ts">
/**
 * Reportes de la nómina (solo con lo aprobado): aportes del mes por empleado y por
 * administradora (insumo para diligenciar la PILA en el operador), ingresos y retenciones del
 * año (insumo del certificado de ingresos y retenciones) y cesantías por consignar por fondo.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CesantiasContrato, IngresosEmpleado, ResumenAportes } from '@/api/tipos'
import { usePestana } from '@/composables/usePestana'
import { moneda, sumar } from '@/formato/decimales'
import { hoyEn } from '@/formato/fechas'
import { GRUPO_CERTIFICADO, TIPO_ADMINISTRADORA } from '@/formato/nomina'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { aportes as pedirAportes, cesantias as pedirCesantias, ingresosRetenciones } from '../api'
import { useNomina } from '../store'

const PESTANAS = [
  { id: 'aportes', texto: 'Aportes del mes' },
  { id: 'ingresos', texto: 'Ingresos y retenciones' },
  { id: 'cesantias', texto: 'Cesantías' },
] as const

const entidad = useEntidad()
const nomina = useNomina()
const pestana = usePestana(PESTANAS)
const id = computed(() => entidad.activa?.entidad_id ?? '')
const hoy = hoyEn(entidad.zonaHoraria)
const mes = ref(hoy.slice(0, 7))
const anio = ref(hoy.slice(0, 4))
const anioCesantias = ref(String(Number(hoy.slice(0, 4)) - (Number(hoy.slice(5, 7)) <= 2 ? 1 : 0)))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const aportes = ref<ResumenAportes | null>(null)
const ingresos = ref<IngresosEmpleado[]>([])
const cesantias = ref<CesantiasContrato[]>([])

const COL_APORTES = [
  { clave: 'empleado', titulo: 'Empleado' },
  { clave: 'tipo_cotizante', titulo: 'Cotizante' },
  { clave: 'dias', titulo: 'Días', alinear: 'fin' as const },
  { clave: 'ibc', titulo: 'IBC', alinear: 'fin' as const },
  { clave: 'salud', titulo: 'Salud', alinear: 'fin' as const },
  { clave: 'pension', titulo: 'Pensión', alinear: 'fin' as const },
  { clave: 'arl', titulo: 'ARL', alinear: 'fin' as const },
  { clave: 'caja', titulo: 'Caja', alinear: 'fin' as const },
]
const filasAportes = computed(() =>
  (aportes.value?.empleados ?? []).map((a) => ({ ...a, empleado: nomina.nombre(a.empleado_id), ibc: moneda(a.ibc), salud: moneda(a.salud), pension: moneda(sumar(a.pension, a.fondo_solidaridad)), arl: moneda(a.arl), caja: moneda(a.caja) })),
)
const porAdministradora = computed(() =>
  (aportes.value?.administradoras ?? []).map((t) => {
    const a = nomina.administradoras.find((x) => x.id === t.administradora_id)
    return { id: t.administradora_id, nombre: a ? `${a.nombre} (${TIPO_ADMINISTRADORA[a.tipo]})` : 'Administradora', valor: t.valor }
  }),
)

const grupos = computed(() => [...new Set(ingresos.value.flatMap((i) => i.totales.map((t) => t.grupo)))])
const COL_INGRESOS = computed(() => [{ clave: 'empleado', titulo: 'Empleado' }, ...grupos.value.map((g) => ({ clave: g, titulo: GRUPO_CERTIFICADO[g], alinear: 'fin' as const }))])
const filasIngresos = computed(() =>
  ingresos.value.map((i) => ({
    id: i.empleado_id,
    empleado: `${i.codigo} · ${i.nombre}`,
    ...Object.fromEntries(i.totales.map((t) => [t.grupo, moneda(t.valor)])),
  })),
)

const COL_CESANTIAS = [
  { clave: 'empleado', titulo: 'Empleado' },
  { clave: 'fondo', titulo: 'Fondo' },
  { clave: 'dias', titulo: 'Días', alinear: 'fin' as const },
  { clave: 'cesantias', titulo: 'Cesantías', alinear: 'fin' as const },
  { clave: 'intereses', titulo: 'Intereses', alinear: 'fin' as const },
]
const filasCesantias = computed(() =>
  cesantias.value.map((c) => ({ ...c, empleado: nomina.nombre(c.empleado_id), fondo: nomina.administradora(c.fondo_id), cesantias: moneda(c.cesantias), intereses: moneda(c.intereses) })),
)
const totalCesantias = computed(() => sumar('0', ...cesantias.value.map((c) => c.cesantias)))
const totalIntereses = computed(() => sumar('0', ...cesantias.value.map((c) => c.intereses)))

async function cargar() {
  estado.value = 'cargando'
  try {
    await nomina.asegurar(id.value)
    if (pestana.value === 'aportes') {
      const [a = '', m = ''] = mes.value.split('-')
      aportes.value = await pedirAportes(id.value, Number(a), Number(m))
    } else if (pestana.value === 'ingresos') {
      ingresos.value = await ingresosRetenciones(id.value, Number(anio.value))
    } else {
      cesantias.value = await pedirCesantias(id.value, Number(anioCesantias.value))
    }
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch([pestana, mes, anio, anioCesantias], () => void cargar())
onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-reportes-nomina">
    <header>
      <h1 id="titulo-reportes-nomina">
        Reportes de la nómina
      </h1>
      <p class="texto-2">
        Con lo aprobado. Úselos para diligenciar la PILA en el operador y el certificado de ingresos y retenciones.
      </p>
    </header>
    <HudPestanas
      :pestanas="PESTANAS"
      etiqueta="Reportes"
    />
    <div class="filtros">
      <HudCampo
        v-if="pestana === 'aportes'"
        v-model="mes"
        etiqueta="Mes"
        tipo="month"
      />
      <HudCampo
        v-else-if="pestana === 'ingresos'"
        v-model="anio"
        etiqueta="Año"
        modo-entrada="numeric"
      />
      <HudCampo
        v-else
        v-model="anioCesantias"
        etiqueta="Año"
        modo-entrada="numeric"
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

    <template v-else-if="pestana === 'aportes'">
      <HudEstado
        v-if="!filasAportes.length"
        estado="vacio"
        mensaje="No hay nómina aprobada en ese mes."
      />
      <template v-else>
        <HudTabla
          :filas="filasAportes"
          :columnas="COL_APORTES"
          clave="contrato_id"
          titulo="Aportes por empleado"
        />
        <HudPanel etiqueta="Por administradora">
          <ul
            class="lista"
            aria-label="Aportes por administradora"
          >
            <li
              v-for="a in porAdministradora"
              :key="a.id"
            >
              <span class="crece">{{ a.nombre }}</span>
              <span class="cifra">{{ moneda(a.valor) }}</span>
            </li>
            <li>
              <span class="crece">ICBF</span>
              <span class="cifra">{{ moneda(aportes?.icbf ?? '0') }}</span>
            </li>
            <li>
              <span class="crece">SENA</span>
              <span class="cifra">{{ moneda(aportes?.sena ?? '0') }}</span>
            </li>
          </ul>
        </HudPanel>
      </template>
    </template>

    <template v-else-if="pestana === 'ingresos'">
      <HudEstado
        v-if="!filasIngresos.length"
        estado="vacio"
        mensaje="No hay nómina aprobada en ese año."
      />
      <HudTabla
        v-else
        :filas="filasIngresos"
        :columnas="COL_INGRESOS"
        clave="id"
        titulo="Ingresos y retenciones por empleado"
      />
    </template>

    <template v-else>
      <HudEstado
        v-if="!filasCesantias.length"
        estado="vacio"
        mensaje="No hay cesantías por consignar en ese año."
      />
      <template v-else>
        <p class="texto-2 cifra">
          Total: {{ moneda(totalCesantias) }} de cesantías (se consignan en el fondo a más tardar el 14 de febrero) y
          {{ moneda(totalIntereses) }} de intereses (se pagan al empleado en enero).
        </p>
        <HudTabla
          :filas="filasCesantias"
          :columnas="COL_CESANTIAS"
          clave="contrato_id"
          titulo="Cesantías por consignar"
        />
      </template>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
