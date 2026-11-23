<script setup lang="ts">
/**
 * La liquidación de un empleado en el periodo: devengos, deducciones, neto y aportes del
 * empleador, con el detalle de las líneas agrupadas por clase. Las provisiones son informativas:
 * no se suman al neto.
 */
import { computed } from 'vue'
import type { LiquidacionNomina } from '@/api/tipos'
import { moneda, numero } from '@/formato/decimales'
import { CLASE_LINEA, CONCEPTO_NOMINA } from '@/formato/nomina'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import { agruparLineas } from '../reglas'

const props = withDefaults(defineProps<{ liquidacion: LiquidacionNomina; nombre: string; conDesprendible?: boolean; cargando?: boolean }>(), {
  conDesprendible: false,
  cargando: false,
})
const emit = defineEmits<{ desprendible: [] }>()

const grupos = computed(() => agruparLineas(props.liquidacion.lineas))
</script>

<template>
  <article class="liquidacion">
    <header class="encabezado">
      <h3>{{ nombre }}</h3>
      <small>{{ liquidacion.dias }} días · IBC {{ moneda(liquidacion.ibc) }}</small>
    </header>
    <dl class="datos">
      <div>
        <dt>Devengos</dt>
        <dd class="cifra">
          {{ moneda(liquidacion.devengos) }}
        </dd>
      </div>
      <div>
        <dt>Deducciones</dt>
        <dd class="cifra">
          {{ moneda(liquidacion.deducciones) }}
        </dd>
      </div>
      <div>
        <dt>Neto a pagar</dt>
        <dd class="cifra neto">
          {{ moneda(liquidacion.neto) }}
        </dd>
      </div>
      <div>
        <dt>Aportes del empleador</dt>
        <dd class="cifra">
          {{ moneda(liquidacion.aportes_empleador) }}
        </dd>
      </div>
    </dl>
    <details>
      <summary>Ver el detalle<span class="solo-lector"> de {{ nombre }}</span></summary>
      <section
        v-for="g in grupos"
        :key="g.clase"
        class="grupo"
        :aria-label="CLASE_LINEA[g.clase]"
      >
        <h4>{{ CLASE_LINEA[g.clase] }}</h4>
        <ul class="lineas">
          <li
            v-for="(l, i) in g.lineas"
            :key="`${l.concepto}-${i}`"
          >
            <span class="crece">{{ CONCEPTO_NOMINA[l.concepto] }} <small>{{ numero(l.cantidad) }}</small></span>
            <span class="cifra">{{ moneda(l.valor) }}</span>
          </li>
        </ul>
        <p class="subtotal">
          <span>Total</span><span class="cifra">{{ moneda(g.total) }}</span>
        </p>
      </section>
    </details>
    <div
      v-if="conDesprendible"
      class="botones"
    >
      <HudBoton
        variante="secundario"
        :cargando="cargando"
        @click="emit('desprendible')"
      >
        Ver el desprendible<span class="solo-lector"> de {{ nombre }}</span>
      </HudBoton>
    </div>
  </article>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
<style scoped>
.liquidacion {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--linea);
  background: var(--superficie);
}

h3,
h4 {
  margin: 0;
}

h4 {
  color: var(--texto-2);
  font-size: 14px;
}

.neto {
  color: var(--cian);
  font-size: 18px;
}

summary {
  min-height: 40px;
  color: var(--cian);
  cursor: pointer;
}

.grupo {
  gap: 6px;
  margin-top: 10px;
}

.lineas {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lineas li,
.subtotal {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
}

.subtotal {
  margin: 0;
  padding-top: 4px;
  border-top: 1px solid var(--linea);
  color: var(--texto-2);
}
</style>
