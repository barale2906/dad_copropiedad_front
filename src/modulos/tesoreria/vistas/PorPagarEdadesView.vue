<script setup lang="ts">
/** Cuentas por pagar por edades: lo que se debe a cada proveedor a una fecha de corte. */
import { porPagarPorEdades } from '../api'
import CarteraPorEdades from '../componentes/CarteraPorEdades.vue'
</script>

<template>
  <CarteraPorEdades
    titulo="Cuentas por pagar"
    tercero="Proveedor"
    vacio="No se le debe nada a ningún proveedor a esa fecha."
    :cargar-filas="porPagarPorEdades"
  />
</template>
