<script setup lang="ts">
/**
 * Ilustración de la pantalla de carga: en un hangar, una persona suelda el casco de una nave
 * mientras la grúa baja una pieza; lo que falta se ve como plano holográfico. Solo SVG y CSS
 * (sin three.js) para que se vea antes que todo lo demás. Decorativa (`aria-hidden`).
 */
</script>

<template>
  <svg
    class="ilustracion"
    viewBox="0 0 400 260"
    aria-hidden="true"
    focusable="false"
  >
    <!-- Piso del hangar en perspectiva -->
    <path
      class="piso"
      d="M0 228 H400"
    />
    <path
      class="reticula"
      d="M200 228 L40 260 M200 228 L120 260 M200 228 L200 260 M200 228 L280 260 M200 228 L360 260 M0 240 H400 M0 252 H400"
    />

    <!-- Pórtico y grúa -->
    <path
      class="portico"
      d="M46 228 V36 M66 228 V36 M354 228 V36 M334 228 V36 M46 36 H354 M46 52 H354"
    />
    <path
      class="portico tenue"
      d="M46 70 L66 90 M66 70 L46 90 M46 120 L66 140 M66 120 L46 140 M46 170 L66 190 M66 170 L46 190 M334 70 L354 90 M354 70 L334 90 M334 120 L354 140 M354 120 L334 140 M334 170 L354 190 M354 170 L334 190"
    />
    <g class="grua">
      <rect
        class="carro"
        x="176"
        y="40"
        width="28"
        height="10"
        rx="2"
      />
      <path
        class="cable"
        d="M190 50 V82"
      />
      <path
        class="pieza"
        d="M162 82 H218 L210 96 H170 Z"
      />
    </g>

    <!-- Nave: casco armado + plano holográfico de lo que falta -->
    <g class="nave">
      <path
        class="plano"
        d="M168 104 L196 130 L150 130 Z"
      />
      <path
        class="plano"
        d="M182 168 L140 214 H236 L250 170"
      />
      <path
        class="casco"
        d="M84 166 C112 132 222 120 300 132 L346 148 C336 160 304 168 262 172 L108 178 Q90 176 84 166 Z"
      />
      <path
        class="cabina"
        d="M262 133 C282 133 306 138 322 146 C304 150 284 150 264 146 Z"
      />
      <path
        class="panel-casco"
        d="M140 142 L136 174 M190 132 L188 176 M236 128 L236 173"
      />
      <path
        class="motor"
        d="M84 150 H66 V160 H84 M86 164 H62 V176 H92"
      />
      <path
        class="llama"
        d="M62 154 L48 155 L62 157 M62 168 L44 170 L62 172"
      />
    </g>

    <!-- Persona soldando desde el piso, bajo el casco -->
    <ellipse
      class="sombra"
      cx="238"
      cy="228"
      rx="12"
      ry="3"
    />
    <g transform="translate(238 227) scale(0.62)">
      <path
        class="extremidad"
        d="M-5 -26 L-8 -1 M5 -26 L8 -1"
      />
      <path
        class="cuerpo"
        d="M-10 -50 Q0 -56 10 -50 L8 -24 L-8 -24 Z"
      />
      <path
        class="extremidad"
        d="M-9 -48 L-2 -64 L6 -76 M9 -48 L12 -66"
      />
      <circle
        class="cuerpo"
        cx="0"
        cy="-64"
        r="8"
      />
      <path
        class="visor"
        d="M0 -68 H8"
      />
    </g>
    <path
      class="soplete"
      d="M241 180 L243 175"
    />

    <!-- Chispas de la soldadura -->
    <g class="chispas">
      <circle
        class="chispa c1"
        cx="243"
        cy="173"
        r="1.8"
      />
      <circle
        class="chispa c2"
        cx="243"
        cy="173"
        r="1.4"
      />
      <circle
        class="chispa c3"
        cx="243"
        cy="173"
        r="1.6"
      />
      <circle
        class="chispa c4"
        cx="243"
        cy="173"
        r="1.2"
      />
      <circle
        class="chispa c5"
        cx="243"
        cy="173"
        r="1.5"
      />
    </g>
    <circle
      class="destello"
      cx="243"
      cy="173"
      r="5"
    />
  </svg>
</template>

<style scoped>
.ilustracion {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.piso {
  stroke: var(--linea-fuerte);
  stroke-width: 1.5;
}

.reticula {
  stroke: var(--linea);
  stroke-width: 0.8;
  fill: none;
}

.portico {
  fill: none;
  stroke: var(--linea-fuerte);
  stroke-width: 2;
}

.portico.tenue {
  stroke: var(--linea);
  stroke-width: 1;
}

.carro {
  fill: var(--superficie-solida);
  stroke: var(--linea-fuerte);
}

.cable {
  stroke: var(--texto-3);
  stroke-width: 1;
}

.pieza {
  fill: color-mix(in srgb, var(--cian) 18%, var(--fondo-2));
  stroke: var(--cian);
  stroke-width: 1.2;
}

/* La grúa baja la pieza y vuelve a subir. */
.grua {
  animation: bajar 3.6s ease-in-out infinite;
}

.casco {
  fill: color-mix(in srgb, var(--cian) 14%, var(--fondo-2));
  stroke: var(--cian);
  stroke-width: 1.6;
  stroke-linejoin: round;
}

.cabina {
  fill: color-mix(in srgb, var(--cian) 40%, transparent);
  stroke: var(--cian);
  stroke-width: 1;
}

.panel-casco {
  fill: none;
  stroke: var(--linea-fuerte);
  stroke-width: 1;
}

.motor {
  fill: var(--superficie-solida);
  stroke: var(--linea-fuerte);
  stroke-width: 1.4;
}

.llama {
  fill: none;
  stroke: var(--ambar);
  stroke-width: 1.4;
  opacity: 0.4;
}

.plano {
  fill: color-mix(in srgb, var(--cian) 6%, transparent);
  stroke: var(--cian);
  stroke-width: 1;
  stroke-dasharray: 4 3;
  animation: latido 1.8s ease-in-out infinite;
}

.sombra {
  fill: rgb(0 0 0 / 45%);
}

.cuerpo {
  fill: var(--fondo-2);
  stroke: var(--ambar);
  stroke-width: 2.4;
  stroke-linejoin: round;
}

.extremidad {
  fill: none;
  stroke: var(--ambar);
  stroke-width: 4.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.visor {
  stroke: var(--cian);
  stroke-width: 3;
  stroke-linecap: round;
}

.soplete {
  stroke: var(--texto-2);
  stroke-width: 2.4;
  stroke-linecap: round;
}

.destello {
  fill: var(--ambar);
  opacity: 0.5;
  animation: chisporroteo 0.3s steps(2) infinite;
}

.chispa {
  fill: var(--ambar);
  animation: saltar 0.9s ease-out infinite;
}

.c1 {
  --dx: -16px;
  --dy: 14px;
}

.c2 {
  --dx: 12px;
  --dy: 18px;

  animation-delay: -0.2s;
}

.c3 {
  --dx: -8px;
  --dy: 24px;

  animation-delay: -0.4s;
}

.c4 {
  --dx: 18px;
  --dy: 8px;

  animation-delay: -0.6s;
}

.c5 {
  --dx: 2px;
  --dy: 28px;

  animation-delay: -0.75s;
}

@keyframes saltar {
  from {
    opacity: 1;
    transform: translate(0, 0);
  }

  to {
    opacity: 0;
    transform: translate(var(--dx), var(--dy));
  }
}

@keyframes chisporroteo {
  50% {
    opacity: 0.9;
  }
}

@keyframes latido {
  50% {
    opacity: 0.45;
  }
}

@keyframes bajar {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(10px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .grua,
  .plano,
  .destello,
  .chispa {
    animation: none;
  }

  .chispa {
    opacity: 0;
  }
}
</style>
