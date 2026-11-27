<script setup lang="ts">
/** Cartera de clientes por edades a una fecha de corte. */
import { carteraPorEdades } from '../api'
import CarteraPorEdades from '../componentes/CarteraPorEdades.vue'
</script>

<template>
  <CarteraPorEdades
    titulo="Cartera de clientes"
    tercero="Cliente"
    vacio="Ningún cliente tiene saldo a esa fecha."
    :cargar-filas="carteraPorEdades"
  />
</template>
