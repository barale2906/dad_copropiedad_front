<script setup lang="ts">
/**
 * Vista previa de una liquidación (no guarda nada): total y vencimiento, totales por concepto,
 * avisos que no impiden liquidar y lo que se cobrará a cada unidad (las de mayor valor primero;
 * se pueden ver todas).
 */
import { computed, ref } from 'vue'
import type { VistaLiquidacion } from '@/api/tipos'
import { moneda } from '@/formato/decimales'
import { fechaCalendario } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import { cobrosPorBien, textoPeriodo } from '../reglas'

const props = defineProps<{ vista: VistaLiquidacion }>()

const PRIMERAS = 10
const todas = ref(false)
const porBien = computed(() => cobrosPorBien(props.vista.cobros))
const visibles = computed(() => (todas.value ? porBien.value : porBien.value.slice(0, PRIMERAS)))
</script>

<template>
  <div class="campos">
    <dl class="datos">
      <div><dt>Periodo</dt><dd>{{ textoPeriodo(vista.periodo) }}</dd></div>
      <div><dt>Vence</dt><dd>{{ fechaCalendario(vista.vencimiento) }}</dd></div>
      <div><dt>Unidades</dt><dd>{{ porBien.length }}</dd></div>
      <div><dt>Total a liquidar</dt><dd class="cifra"><strong>{{ moneda(vista.total) }}</strong></dd></div>
    </dl>
    <ul
      v-if="vista.avisos.length"
      class="aviso"
      aria-label="Avisos de la liquidación"
    >
      <li
        v-for="a in vista.avisos"
        :key="a"
      >
        {{ a }}
      </li>
    </ul>
    <ul
      class="lista"
      aria-label="Totales por concepto"
    >
      <li
        v-for="c in vista.por_concepto"
        :key="c.concepto_cobro_id"
      >
        <span class="crece"><strong>{{ c.codigo }}</strong><small>{{ c.nombre }}</small></span>
        <span class="cifra">{{ moneda(c.total) }}</span>
      </li>
    </ul>
    <ul
      class="lista"
      aria-label="Cobros por unidad"
    >
      <li
        v-for="b in visibles"
        :key="b.bienId"
      >
        <span class="crece"><strong>{{ b.codigo }}</strong><small>{{ b.conceptos.join(' · ') }}</small></span>
        <span class="cifra">{{ moneda(b.total) }}</span>
      </li>
    </ul>
    <div
      v-if="porBien.length > PRIMERAS"
      class="botones"
    >
      <HudBoton
        variante="fantasma"
        @click="todas = !todas"
      >
        {{ todas ? 'Ver solo las primeras' : `Ver las ${porBien.length} unidades` }}
      </HudBoton>
    </div>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
