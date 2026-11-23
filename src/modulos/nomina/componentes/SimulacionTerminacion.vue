<script setup lang="ts">
/** Lo que costaría terminar el contrato en la fecha y con el motivo (no guarda nada). */
import type { SimulacionTerminacion } from '@/api/tipos'
import { moneda, numero } from '@/formato/decimales'
import { CONCEPTO_NOMINA } from '@/formato/nomina'

defineProps<{ simulacion: SimulacionTerminacion }>()
</script>

<template>
  <div class="campos">
    <ul
      class="lista"
      aria-label="Liquidación del contrato"
    >
      <li
        v-for="l in simulacion.lineas"
        :key="l.concepto"
      >
        <span class="crece">
          <strong>{{ CONCEPTO_NOMINA[l.concepto] }}</strong>
          <small>{{ numero(l.cantidad) }}</small>
        </span>
        <span class="cifra">{{ moneda(l.valor) }}</span>
      </li>
    </ul>
    <p class="total">
      <span>Total a pagar al terminar</span>
      <strong class="cifra">{{ moneda(simulacion.total) }}</strong>
    </p>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
<style scoped>
.total {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  font-size: 18px;
}
</style>
