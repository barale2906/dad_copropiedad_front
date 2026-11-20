<script setup lang="ts">
/** Conceptos de retención (todas sus versiones) y el valor de la UVT por año. */
import { computed, onMounted, ref } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { CatalogoRetenciones, ImpuestoRetencion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { leerDecimal, moneda, numero, porcentaje } from '@/formato/decimales'
import { hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { crearConceptoRetencion, guardarUvt, retenciones } from '../api-normativa'
import { IMPUESTO_RETENCION } from '../reglas'
import EditorTablaNormativa from './EditorTablaNormativa.vue'
import InsigniaVigencia from './InsigniaVigencia.vue'

const entidad = useEntidad()
const hoy = hoyEn(entidad.zonaHoraria)
const catalogo = ref<CatalogoRetenciones | null>(null)
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)
const anio = ref('')
const resultado = ref<string | null>(null)
const vacio = () => ({ codigo: '', impuesto: 'renta' as ImpuestoRetencion, nombre: '', base: '', tarifa: '', cuenta: '', municipio: '', fuente: '', desde: hoy })
const nuevo = ref(vacio())
const uvt = ref({ anio: hoy.slice(0, 4), valor: '', fuente: '' })

const conceptos = computed(() =>
  (catalogo.value?.conceptos ?? []).filter((c) => !anio.value || c.vigente_desde.startsWith(anio.value)),
)
const anios = computed(() => (catalogo.value?.conceptos ?? []).map((c) => Number(c.vigente_desde.slice(0, 4))))
const uvts = computed(() => [...(catalogo.value?.uvt ?? [])].sort((a, b) => b.anio - a.anio).map((u) => ({ ...u, id: String(u.anio) })))
const IMPUESTOS = (Object.keys(IMPUESTO_RETENCION) as ImpuestoRetencion[]).map((i) => ({ valor: i, etiqueta: IMPUESTO_RETENCION[i] }))
const COLUMNAS = [
  { clave: 'nombre', titulo: 'Concepto' },
  { clave: 'base_minima_uvt', titulo: 'Base mínima', alinear: 'fin' as const },
  { clave: 'tarifa', titulo: 'Tarifa', alinear: 'fin' as const },
  { clave: 'vigencia', titulo: 'Vigencia' },
]
const COLUMNAS_UVT = [
  { clave: 'anio', titulo: 'Año' },
  { clave: 'valor', titulo: 'Valor', alinear: 'fin' as const },
  { clave: 'fuente', titulo: 'Fuente' },
]
const completo = computed(() => {
  const n = nuevo.value
  return !!(n.codigo.trim() && n.nombre.trim() && leerDecimal(n.base, 4) && leerDecimal(n.tarifa, 4) && n.fuente.trim() && n.desde)
})

const crear = useAccion((clave) => {
  const n = nuevo.value
  return crearConceptoRetencion(
    {
      codigo: n.codigo.trim(),
      impuesto: n.impuesto,
      nombre: n.nombre.trim(),
      base_minima_uvt: leerDecimal(n.base, 4) ?? '0',
      tarifa: leerDecimal(n.tarifa, 4) ?? '0',
      cuenta_sugerida: n.cuenta.trim() || null,
      municipio_dane: n.impuesto === 'ica' ? n.municipio.trim() || null : null,
      fuente: n.fuente.trim(),
      vigente_desde: n.desde,
    },
    clave,
  )
})
const guardar = useAccion(() => guardarUvt(Number(uvt.value.anio), leerDecimal(uvt.value.valor, 2) ?? '', uvt.value.fuente.trim()))

async function cargar() {
  estado.value = 'cargando'
  try {
    catalogo.value = await retenciones()
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
    estado.value = 'error'
  }
}

async function enviar(cerrar: () => void) {
  if (!completo.value || !(await crear.ejecutar()).ok) return
  resultado.value = 'Versión del concepto registrada: la anterior queda vigente hasta el día antes.'
  nuevo.value = vacio()
  cerrar()
  await cargar()
}

async function enviarUvt() {
  if (!/^\d{4}$/.test(uvt.value.anio) || !leerDecimal(uvt.value.valor, 2) || !uvt.value.fuente.trim()) return
  if (!(await guardar.ejecutar()).ok) return
  resultado.value = `UVT de ${uvt.value.anio} guardada.`
  await cargar()
}

onMounted(cargar)
</script>

<template>
  <HudEstado
    v-if="estado === 'cargando'"
    estado="cargando"
  />
  <HudEstado
    v-else-if="estado === 'error'"
    estado="error"
    :mensaje="error ?? undefined"
    :referencia="referencia"
    @reintentar="cargar()"
  />
  <template v-else>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <EditorTablaNormativa
      v-model:anio="anio"
      titulo="Conceptos de retención"
      descripcion="Retención en la fuente, ReteIVA y ReteICA con su base en UVT."
      :anios="anios"
    >
      <template #formulario="{ cerrar }">
        <form
          class="filtros"
          novalidate
          @submit.prevent="enviar(cerrar)"
        >
          <HudCampo
            v-model="nuevo.codigo"
            etiqueta="Código"
          />
          <HudSelector
            v-model="nuevo.impuesto"
            etiqueta="Impuesto"
            :opciones="IMPUESTOS"
          />
          <HudCampo
            v-model="nuevo.nombre"
            etiqueta="Nombre"
          />
          <HudCampo
            v-model="nuevo.base"
            etiqueta="Base mínima (UVT)"
            modo-entrada="decimal"
          />
          <HudCampo
            v-model="nuevo.tarifa"
            etiqueta="Tarifa (%)"
            modo-entrada="decimal"
          />
          <HudCampo
            v-model="nuevo.cuenta"
            etiqueta="Cuenta sugerida (opcional)"
            modo-entrada="numeric"
          />
          <HudCampo
            v-if="nuevo.impuesto === 'ica'"
            v-model="nuevo.municipio"
            etiqueta="Municipio (código DANE)"
            modo-entrada="numeric"
          />
          <HudCampo
            v-model="nuevo.fuente"
            etiqueta="Norma (fuente)"
          />
          <HudFecha
            v-model="nuevo.desde"
            etiqueta="Vigente desde"
          />
          <div>
            <HudBoton
              tipo="submit"
              :deshabilitado="!completo"
              :cargando="crear.cargando.value"
            >
              Registrar versión
            </HudBoton>
          </div>
        </form>
        <p
          v-if="crear.error.value"
          class="error"
          role="alert"
        >
          {{ crear.error.value }}
        </p>
      </template>
      <HudEstado
        v-if="conceptos.length === 0"
        estado="vacio"
        mensaje="No hay conceptos para ese año."
      />
      <HudTabla
        v-else
        :filas="conceptos"
        :columnas="COLUMNAS"
        clave="id"
        titulo="Conceptos de retención"
      >
        <template #celda-nombre="{ fila }">
          <span class="crece">
            <strong>{{ fila.codigo }} · {{ fila.nombre }}</strong>
            <small>{{ IMPUESTO_RETENCION[fila.impuesto] }} · {{ fila.fuente }}</small>
          </span>
        </template>
        <template #celda-base_minima_uvt="{ fila }">
          <span class="cifra">{{ numero(fila.base_minima_uvt, 2) }} UVT</span>
        </template>
        <template #celda-tarifa="{ fila }">
          <span class="cifra">{{ porcentaje(fila.tarifa, 2) }}</span>
        </template>
        <template #celda-vigencia="{ fila }">
          <InsigniaVigencia
            :version="fila"
            :hoy="hoy"
          />
        </template>
      </HudTabla>
    </EditorTablaNormativa>

    <EditorTablaNormativa
      titulo="UVT"
      descripcion="Valor de la Unidad de Valor Tributario de cada año (se puede corregir)."
      accion="Fijar o corregir la UVT"
    >
      <template #formulario>
        <form
          class="filtros"
          novalidate
          @submit.prevent="enviarUvt"
        >
          <HudCampo
            v-model="uvt.anio"
            etiqueta="Año"
            modo-entrada="numeric"
            :maximo="4"
          />
          <HudCampo
            v-model="uvt.valor"
            etiqueta="Valor (pesos)"
            modo-entrada="decimal"
          />
          <HudCampo
            v-model="uvt.fuente"
            etiqueta="Resolución DIAN"
          />
          <div>
            <HudBoton
              tipo="submit"
              :cargando="guardar.cargando.value"
            >
              Guardar UVT
            </HudBoton>
          </div>
        </form>
        <p
          v-if="guardar.error.value"
          class="error"
          role="alert"
        >
          {{ guardar.error.value }}
        </p>
      </template>
      <HudTabla
        :filas="uvts"
        :columnas="COLUMNAS_UVT"
        clave="id"
        titulo="Valores de la UVT"
      >
        <template #celda-valor="{ fila }">
          <span class="cifra">{{ moneda(fila.valor, 0) }}</span>
        </template>
      </HudTabla>
    </EditorTablaNormativa>
  </template>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
