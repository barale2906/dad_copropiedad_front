<script setup lang="ts">
/** Ayuda visible de los atajos del editor de comprobantes (se abre con `?`). */
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'

const abierto = defineModel<boolean>('abierto', { required: true })

const ATAJOS = [
  ['Enter', 'Siguiente celda: cuenta → tercero → centro → débito → crédito → siguiente línea'],
  ['Ctrl + Enter', 'Nueva línea'],
  ['Ctrl + D', 'Duplicar la línea'],
  ['=', 'En débito o crédito, completa con lo que falta para cuadrar'],
  ['F2', 'Abrir la búsqueda de cuentas'],
  ['Ctrl + Supr', 'Quitar la línea'],
  ['Alt + P', 'Previsualizar'],
  ['Ctrl + S', 'Guardar el borrador'],
  ['Ctrl + Mayús + Enter', 'Contabilizar (pide confirmación)'],
  ['?', 'Esta ayuda'],
] as const
</script>

<template>
  <HudDialogo
    v-model:abierto="abierto"
    titulo="Atajos de teclado"
  >
    <dl class="atajos">
      <div
        v-for="[tecla, accion] in ATAJOS"
        :key="tecla"
      >
        <dt><kbd>{{ tecla }}</kbd></dt>
        <dd>{{ accion }}</dd>
      </div>
    </dl>
    <template #acciones>
      <HudBoton @click="abierto = false">
        Entendido
      </HudBoton>
    </template>
  </HudDialogo>
</template>

<style scoped>
.atajos {
  display: grid;
  gap: 8px;
  margin: 0;
}

.atajos div {
  display: grid;
  grid-template-columns: minmax(130px, auto) 1fr;
  gap: 12px;
  align-items: baseline;
}

.atajos dd {
  margin: 0;
  color: var(--texto-2);
}

kbd {
  padding: 2px 8px;
  border: 1px solid var(--linea-fuerte);
  border-radius: var(--radio);
  background: var(--superficie-solida);
  font-family: var(--fuente-mono);
  font-size: 14px;
}
</style>
