<script setup lang="ts">
/**
 * Contabiliza las facturas emitidas antes de llevar contabilidad (exige el módulo). Se elige el
 * periodo y se muestra el informe: contabilizadas, las que se habían pagado a mano (registre su
 * recaudo en la contabilidad) y las que fallaron con su motivo. Repetir no duplica nada.
 */
import { computed, ref } from 'vue'
import type { InformeContabilizacion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import TarjetaResumen from '@/hud/componentes/TarjetaResumen.vue'
import { useEntidad } from '@/stores/entidad'
import { contabilizar, type Periodo } from '../api'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const hoy = hoyEn(entidad.zonaHoraria)
const periodo = ref<Periodo>({ desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy })
const informe = ref<InformeContabilizacion | null>(null)
const errorPeriodo = computed(() => (periodo.value.hasta < periodo.value.desde ? 'La fecha final es anterior a la inicial.' : null))

const ejecutar = useAccion(() => contabilizar(id.value, { ...periodo.value }))

async function alContabilizar() {
  if (errorPeriodo.value) return
  const r = await ejecutar.ejecutar()
  if (r.ok) informe.value = r.valor
}
</script>

<template>
  <section aria-labelledby="titulo-contabilizacion">
    <header>
      <h1 id="titulo-contabilizacion">
        Contabilizar lo facturado
      </h1>
      <p class="texto-2">
        Lleva a la contabilidad las facturas emitidas antes de tenerla. Cada una va por separado y repetir el periodo no duplica nada.
      </p>
    </header>
    <form
      class="filtros"
      novalidate
      @submit.prevent="alContabilizar"
    >
      <HudFecha
        v-model="periodo.desde"
        etiqueta="Desde"
        :maximo="periodo.hasta || undefined"
      />
      <HudFecha
        v-model="periodo.hasta"
        etiqueta="Hasta"
        :minimo="periodo.desde || undefined"
      />
      <HudBoton
        tipo="submit"
        :cargando="ejecutar.cargando.value"
      >
        Contabilizar el periodo
      </HudBoton>
    </form>
    <p
      v-if="errorPeriodo ?? ejecutar.error.value"
      class="error"
      role="alert"
    >
      {{ errorPeriodo ?? ejecutar.error.value }}
    </p>

    <template v-if="informe">
      <div
        class="filtros"
        role="status"
      >
        <TarjetaResumen
          titulo="Contabilizadas"
          :valor="String(informe.contabilizadas.length)"
          tono="exito"
        />
        <TarjetaResumen
          titulo="Pagadas a mano"
          :valor="String(informe.pagadas_a_mano.length)"
          detalle="Registre su recaudo en la contabilidad."
          :tono="informe.pagadas_a_mano.length ? 'aviso' : 'neutro'"
        />
        <TarjetaResumen
          titulo="Fallidas"
          :valor="String(informe.fallidas.length)"
          :tono="informe.fallidas.length ? 'peligro' : 'neutro'"
        />
      </div>
      <HudPanel
        v-if="informe.fallidas.length"
        etiqueta="Facturas que no se contabilizaron"
      >
        <ul
          class="lista"
          aria-label="Facturas fallidas"
        >
          <li
            v-for="f in informe.fallidas"
            :key="f.factura_id"
          >
            <span class="crece">
              <RouterLink :to="{ name: 'modulo', params: { entidadId: id, seccion: 'facturacion', accion: 'facturas', id: f.factura_id } }">Ver la factura</RouterLink>
              <small>{{ f.motivo }}</small>
            </span>
          </li>
        </ul>
      </HudPanel>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
