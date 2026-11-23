<script setup lang="ts">
/**
 * Planillas de la nómina: empleados con su primer contrato (las administradoras van por su
 * código PILA) y novedades del periodo (el empleado por su código). Cada una con su vista previa
 * de errores; se aplica todo o nada.
 */
import { computed } from 'vue'
import type { Importacion } from '@/api/tipos'
import { usePestana } from '@/composables/usePestana'
import { TIPO_CONTRATO, TIPO_NOVEDAD } from '@/formato/nomina'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import { useEntidad } from '@/stores/entidad'
import { confirmarEmpleados, confirmarNovedades, importarEmpleados, importarNovedades, plantillaEmpleados, plantillaNovedades } from '../api'
import ImportarPlanilla from '../componentes/ImportarPlanilla.vue'
import { useNomina } from '../store'

const entidad = useEntidad()
const nomina = useNomina()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const PESTANAS = computed(() =>
  [
    { id: 'empleados', texto: 'Empleados', ver: entidad.tienePermiso('nomina.empleados.gestionar') },
    { id: 'novedades', texto: 'Novedades', ver: entidad.tienePermiso('nomina.novedades.registrar') },
  ].filter((p) => p.ver),
)
const pestana = usePestana(PESTANAS.value)

const plantillaDeEmpleados = () => plantillaEmpleados(id.value)
const plantillaDeNovedades = () => plantillaNovedades(id.value)
const confirmarDeEmpleados = (i: string) => confirmarEmpleados(id.value, i)
const confirmarDeNovedades = (i: string) => confirmarNovedades(id.value, i)
const hechoEmpleados = (i: Importacion) => `Listo: se crearon ${i.resumen.empleados} empleados con su contrato.`
const hechoNovedades = (i: Importacion) => `Listo: se registraron ${i.resumen.novedades} novedades.`

async function subirEmpleados(a: File) {
  const r = await importarEmpleados(id.value, a)
  return { importacion: r.importacion, filas: r.filas.map((f) => ({ fila: f.fila, codigo: f.codigo, detalle: TIPO_CONTRATO[f.tipo_contrato] })) }
}

async function subirNovedades(a: File) {
  const r = await importarNovedades(id.value, a)
  return { importacion: r.importacion, filas: r.filas.map((f) => ({ fila: f.fila, codigo: f.codigo, detalle: TIPO_NOVEDAD[f.tipo] ?? f.tipo })) }
}
</script>

<template>
  <section aria-labelledby="titulo-importar-nomina">
    <header>
      <h1 id="titulo-importar-nomina">
        Importar planillas
      </h1>
      <p class="texto-2">
        Cargue de una vez los empleados con su contrato o las novedades del periodo.
      </p>
    </header>
    <p
      v-if="!PESTANAS.length"
      class="aviso"
    >
      Su rol no puede crear empleados ni registrar novedades.
    </p>
    <template v-else>
      <HudPestanas
        :pestanas="PESTANAS"
        etiqueta="Planillas"
      />
      <HudPanel
        v-if="pestana === 'empleados'"
        etiqueta="Planilla de empleados"
      >
        <ImportarPlanilla
          key="empleados"
          que="empleados"
          columnas="codigo, nombre, tipo_documento, documento, tipo_contrato, fecha_inicio, fecha_fin, cargo, salario y el código PILA de cada administradora"
          :plantilla="plantillaDeEmpleados"
          :subir="subirEmpleados"
          :confirmar="confirmarDeEmpleados"
          :hecho="hechoEmpleados"
          @aplicada="nomina.recargar(id)"
        />
      </HudPanel>
      <HudPanel
        v-else
        etiqueta="Planilla de novedades"
      >
        <ImportarPlanilla
          key="novedades"
          que="novedades"
          columnas="codigo del empleado, tipo, desde, hasta (días), cantidad (horas o pesos) y descripcion"
          :plantilla="plantillaDeNovedades"
          :subir="subirNovedades"
          :confirmar="confirmarDeNovedades"
          :hecho="hechoNovedades"
        />
      </HudPanel>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
