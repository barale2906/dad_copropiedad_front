<script setup lang="ts">
/** Tarifas de IVA y de ICA (por municipio y actividad), versionadas por vigencia. */
import { computed, onMounted, ref } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { CatalogoTributario, TratamientoIva } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { leerDecimal, numero, porcentaje } from '@/formato/decimales'
import { hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { catalogoTributario, crearTarifaIca, crearTarifaIva } from '../api-normativa'
import { TRATAMIENTO_IVA } from '../reglas'
import EditorTablaNormativa from './EditorTablaNormativa.vue'
import InsigniaVigencia from './InsigniaVigencia.vue'

const entidad = useEntidad()
const hoy = hoyEn(entidad.zonaHoraria)
const catalogo = ref<CatalogoTributario | null>(null)
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)
const resultado = ref<string | null>(null)
const anioIva = ref('')
const anioIca = ref('')
const vacioIva = () => ({ codigo: '', nombre: '', tratamiento: 'gravado' as TratamientoIva, tarifa: '', fuente: '', desde: hoy })
const vacioIca = () => ({ municipio: '', actividad: '', nombre: '', tarifa: '', fuente: '', desde: hoy })
const iva = ref(vacioIva())
const ica = ref(vacioIca())

const anioDe = (d: string) => Number(d.slice(0, 4))
const filasIva = computed(() => (catalogo.value?.iva ?? []).filter((t) => !anioIva.value || t.vigente_desde.startsWith(anioIva.value)))
const filasIca = computed(() => (catalogo.value?.ica ?? []).filter((t) => !anioIca.value || t.vigente_desde.startsWith(anioIca.value)))
const TRATAMIENTOS = (Object.keys(TRATAMIENTO_IVA) as TratamientoIva[]).map((t) => ({ valor: t, etiqueta: TRATAMIENTO_IVA[t] }))
const COLUMNAS_IVA = [
  { clave: 'nombre', titulo: 'Tarifa' },
  { clave: 'tarifa', titulo: 'Porcentaje', alinear: 'fin' as const },
  { clave: 'vigencia', titulo: 'Vigencia' },
]
const COLUMNAS_ICA = [
  { clave: 'nombre', titulo: 'Actividad' },
  { clave: 'tarifa_por_mil', titulo: 'Tarifa', alinear: 'fin' as const },
  { clave: 'vigencia', titulo: 'Vigencia' },
]
const ivaCompleta = computed(() => !!(iva.value.codigo.trim() && iva.value.nombre.trim() && leerDecimal(iva.value.tarifa, 4) && iva.value.fuente.trim()))
const icaCompleta = computed(() => {
  const t = ica.value
  return !!(/^\d{5}$/.test(t.municipio) && t.actividad.trim() && t.nombre.trim() && leerDecimal(t.tarifa, 4) && t.fuente.trim())
})

const crearIva = useAccion((clave) =>
  crearTarifaIva({ codigo: iva.value.codigo.trim(), nombre: iva.value.nombre.trim(), tratamiento: iva.value.tratamiento, tarifa: leerDecimal(iva.value.tarifa, 4) ?? '0', fuente: iva.value.fuente.trim(), vigente_desde: iva.value.desde }, clave),
)
const crearIca = useAccion((clave) =>
  crearTarifaIca(
    { municipio_dane: ica.value.municipio, actividad: ica.value.actividad.trim(), nombre: ica.value.nombre.trim(), tarifa_por_mil: leerDecimal(ica.value.tarifa, 4) ?? '0', fuente: ica.value.fuente.trim(), vigente_desde: ica.value.desde },
    clave,
  ),
)

async function cargar() {
  estado.value = 'cargando'
  try {
    catalogo.value = await catalogoTributario()
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
    estado.value = 'error'
  }
}

async function enviarIva(cerrar: () => void) {
  if (!ivaCompleta.value || !(await crearIva.ejecutar()).ok) return
  resultado.value = 'Tarifa de IVA registrada.'
  iva.value = vacioIva()
  cerrar()
  await cargar()
}

async function enviarIca(cerrar: () => void) {
  if (!icaCompleta.value || !(await crearIca.ejecutar()).ok) return
  resultado.value = 'Tarifa de ICA registrada.'
  ica.value = vacioIca()
  cerrar()
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
      v-model:anio="anioIva"
      titulo="Tarifas de IVA"
      descripcion="La versión nueva de un código deja la anterior vigente hasta el día antes."
      :anios="(catalogo?.iva ?? []).map((t) => anioDe(t.vigente_desde))"
    >
      <template #formulario="{ cerrar }">
        <form
          class="filtros"
          novalidate
          @submit.prevent="enviarIva(cerrar)"
        >
          <HudCampo
            v-model="iva.codigo"
            etiqueta="Código"
          />
          <HudCampo
            v-model="iva.nombre"
            etiqueta="Nombre"
          />
          <HudSelector
            v-model="iva.tratamiento"
            etiqueta="Tratamiento"
            :opciones="TRATAMIENTOS"
          />
          <HudCampo
            v-model="iva.tarifa"
            etiqueta="Tarifa (%)"
            modo-entrada="decimal"
          />
          <HudCampo
            v-model="iva.fuente"
            etiqueta="Norma (fuente)"
          />
          <HudFecha
            v-model="iva.desde"
            etiqueta="Vigente desde"
          />
          <div>
            <HudBoton
              tipo="submit"
              :deshabilitado="!ivaCompleta"
              :cargando="crearIva.cargando.value"
            >
              Registrar tarifa
            </HudBoton>
          </div>
        </form>
        <p
          v-if="crearIva.error.value"
          class="error"
          role="alert"
        >
          {{ crearIva.error.value }}
        </p>
      </template>
      <HudEstado
        v-if="filasIva.length === 0"
        estado="vacio"
        mensaje="No hay tarifas de IVA para ese año."
      />
      <HudTabla
        v-else
        :filas="filasIva"
        :columnas="COLUMNAS_IVA"
        clave="id"
        titulo="Tarifas de IVA"
      >
        <template #celda-nombre="{ fila }">
          <span class="crece">
            <strong>{{ fila.codigo }} · {{ fila.nombre }}</strong>
            <small>{{ TRATAMIENTO_IVA[fila.tratamiento] }} · {{ fila.fuente }}</small>
          </span>
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
      v-model:anio="anioIca"
      titulo="Tarifas de ICA"
      descripcion="Por municipio (código DANE) y actividad (CIIU), en tarifa por mil."
      :anios="(catalogo?.ica ?? []).map((t) => anioDe(t.vigente_desde))"
    >
      <template #formulario="{ cerrar }">
        <form
          class="filtros"
          novalidate
          @submit.prevent="enviarIca(cerrar)"
        >
          <HudCampo
            v-model="ica.municipio"
            etiqueta="Municipio (DANE, 5 dígitos)"
            modo-entrada="numeric"
            :maximo="5"
          />
          <HudCampo
            v-model="ica.actividad"
            etiqueta="Actividad (CIIU)"
            modo-entrada="numeric"
          />
          <HudCampo
            v-model="ica.nombre"
            etiqueta="Nombre"
          />
          <HudCampo
            v-model="ica.tarifa"
            etiqueta="Tarifa por mil"
            modo-entrada="decimal"
          />
          <HudCampo
            v-model="ica.fuente"
            etiqueta="Acuerdo municipal (fuente)"
          />
          <HudFecha
            v-model="ica.desde"
            etiqueta="Vigente desde"
          />
          <div>
            <HudBoton
              tipo="submit"
              :deshabilitado="!icaCompleta"
              :cargando="crearIca.cargando.value"
            >
              Registrar tarifa
            </HudBoton>
          </div>
        </form>
        <p
          v-if="crearIca.error.value"
          class="error"
          role="alert"
        >
          {{ crearIca.error.value }}
        </p>
      </template>
      <HudEstado
        v-if="filasIca.length === 0"
        estado="vacio"
        mensaje="No hay tarifas de ICA para ese año."
      />
      <HudTabla
        v-else
        :filas="filasIca"
        :columnas="COLUMNAS_ICA"
        clave="id"
        titulo="Tarifas de ICA"
      >
        <template #celda-nombre="{ fila }">
          <span class="crece">
            <strong>{{ fila.actividad }} · {{ fila.nombre }}</strong>
            <small>Municipio {{ fila.municipio_dane }} · {{ fila.fuente }}</small>
          </span>
        </template>
        <template #celda-tarifa_por_mil="{ fila }">
          <span class="cifra">{{ numero(fila.tarifa_por_mil, 2) }} ‰</span>
        </template>
        <template #celda-vigencia="{ fila }">
          <InsigniaVigencia
            :version="fila"
            :hoy="hoy"
          />
        </template>
      </HudTabla>
    </EditorTablaNormativa>
  </template>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
