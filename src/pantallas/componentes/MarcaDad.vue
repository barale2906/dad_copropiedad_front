<script setup lang="ts">
/** Marca provisional (la identidad de DAD aún no está definida). */
defineProps<{ compacta?: boolean }>()
</script>

<template>
  <div
    class="marca"
    :class="{ compacta }"
  >
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <path
        d="M20 3 36 12v16L20 37 4 28V12Z"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      />
      <path
        d="M13 15v10M20 11v18M27 15v10"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
      />
    </svg>
    <div class="texto">
      <strong>DAD</strong>
      <span v-if="!compacta">Copropiedad</span>
    </div>
  </div>
</template>

<style scoped>
.marca {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--cian);
}

svg {
  width: 34px;
  height: 34px;
  filter: drop-shadow(0 0 8px rgb(56 232 255 / 50%));
}

.compacta svg {
  width: 28px;
  height: 28px;
}

.texto {
  display: flex;
  flex-direction: column;
  font-family: var(--fuente-display);
  line-height: 1;
}

strong {
  font-size: 20px;
  letter-spacing: 0.28em;
  color: var(--texto);
}

span {
  font-size: 11px;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--cian);
  margin-top: 3px;
}
</style>
