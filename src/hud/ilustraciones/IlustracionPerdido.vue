<script setup lang="ts">
/**
 * Ilustración de la página «no encontrado»: la maqueta (conjunto de la PH u oficina de la
 * empresa) en SVG isométrico, con un holograma «404» y una persona que se rasca la cabeza.
 * Solo SVG y CSS: no carga three.js. Decorativa (`aria-hidden`): el texto va en la página.
 */
withDefaults(defineProps<{ escenario?: 'conjunto' | 'oficina' }>(), { escenario: 'oficina' })
</script>

<template>
  <svg
    class="ilustracion"
    viewBox="0 0 400 310"
    aria-hidden="true"
    focusable="false"
  >
    <g v-if="escenario === 'conjunto'">
      <polygon class="losa cara-izq" points="28.5,202.6 200.0,301.6 200.0,295.0 28.5,196.0"/>
      <polygon class="losa cara-der" points="371.5,202.6 200.0,301.6 200.0,295.0 371.5,196.0"/>
      <polygon class="losa cara-sup" points="200.0,97.0 371.5,196.0 200.0,295.0 28.5,196.0"/>
      <line class="reticula" x1="219.1" y1="108.0" x2="47.6" y2="207.0"/>
      <line class="reticula" x1="180.9" y1="108.0" x2="352.4" y2="207.0"/>
      <line class="reticula" x1="238.1" y1="119.0" x2="66.6" y2="218.0"/>
      <line class="reticula" x1="161.9" y1="119.0" x2="333.4" y2="218.0"/>
      <line class="reticula" x1="257.2" y1="130.0" x2="85.7" y2="229.0"/>
      <line class="reticula" x1="142.8" y1="130.0" x2="314.3" y2="229.0"/>
      <line class="reticula" x1="276.2" y1="141.0" x2="104.7" y2="240.0"/>
      <line class="reticula" x1="123.8" y1="141.0" x2="295.3" y2="240.0"/>
      <line class="reticula" x1="295.3" y1="152.0" x2="123.8" y2="251.0"/>
      <line class="reticula" x1="104.7" y1="152.0" x2="276.2" y2="251.0"/>
      <line class="reticula" x1="314.3" y1="163.0" x2="142.8" y2="262.0"/>
      <line class="reticula" x1="85.7" y1="163.0" x2="257.2" y2="262.0"/>
      <line class="reticula" x1="333.4" y1="174.0" x2="161.9" y2="273.0"/>
      <line class="reticula" x1="66.6" y1="174.0" x2="238.1" y2="273.0"/>
      <line class="reticula" x1="352.4" y1="185.0" x2="180.9" y2="284.0"/>
      <line class="reticula" x1="47.6" y1="185.0" x2="219.1" y2="284.0"/>
      <polygon class="bloque cara-izq" points="161.9,141.0 200.0,163.0 200.0,42.0 161.9,20.0"/>
      <polygon class="bloque cara-der" points="238.1,141.0 200.0,163.0 200.0,42.0 238.1,20.0"/>
      <polygon class="bloque cara-sup" points="200.0,-2.0 238.1,20.0 200.0,42.0 161.9,20.0"/>
      <line class="ventana" x1="165.7" y1="132.2" x2="196.2" y2="149.8"/>
      <line class="ventana tenue" x1="234.3" y1="132.2" x2="203.8" y2="149.8"/>
      <line class="ventana" x1="165.7" y1="116.8" x2="196.2" y2="134.4"/>
      <line class="ventana tenue" x1="234.3" y1="116.8" x2="203.8" y2="134.4"/>
      <line class="ventana" x1="165.7" y1="101.4" x2="196.2" y2="119.0"/>
      <line class="ventana tenue" x1="234.3" y1="101.4" x2="203.8" y2="119.0"/>
      <line class="ventana" x1="165.7" y1="86.0" x2="196.2" y2="103.6"/>
      <line class="ventana tenue" x1="234.3" y1="86.0" x2="203.8" y2="103.6"/>
      <line class="ventana" x1="165.7" y1="70.6" x2="196.2" y2="88.2"/>
      <line class="ventana tenue" x1="234.3" y1="70.6" x2="203.8" y2="88.2"/>
      <line class="ventana" x1="165.7" y1="55.2" x2="196.2" y2="72.8"/>
      <line class="ventana tenue" x1="234.3" y1="55.2" x2="203.8" y2="72.8"/>
      <line class="ventana" x1="165.7" y1="39.8" x2="196.2" y2="57.4"/>
      <line class="ventana tenue" x1="234.3" y1="39.8" x2="203.8" y2="57.4"/>
      <polygon class="bloque cara-izq" points="219.1,174.0 257.2,196.0 257.2,108.0 219.1,86.0"/>
      <polygon class="bloque cara-der" points="295.3,174.0 257.2,196.0 257.2,108.0 295.3,86.0"/>
      <polygon class="bloque cara-sup" points="257.2,64.0 295.3,86.0 257.2,108.0 219.1,86.0"/>
      <line class="ventana" x1="222.9" y1="165.2" x2="253.3" y2="182.8"/>
      <line class="ventana tenue" x1="291.5" y1="165.2" x2="261.0" y2="182.8"/>
      <line class="ventana" x1="222.9" y1="149.8" x2="253.3" y2="167.4"/>
      <line class="ventana tenue" x1="291.5" y1="149.8" x2="261.0" y2="167.4"/>
      <line class="ventana" x1="222.9" y1="134.4" x2="253.3" y2="152.0"/>
      <line class="ventana tenue" x1="291.5" y1="134.4" x2="261.0" y2="152.0"/>
      <line class="ventana" x1="222.9" y1="119.0" x2="253.3" y2="136.6"/>
      <line class="ventana tenue" x1="291.5" y1="119.0" x2="261.0" y2="136.6"/>
      <line class="ventana" x1="222.9" y1="103.6" x2="253.3" y2="121.2"/>
      <line class="ventana tenue" x1="291.5" y1="103.6" x2="261.0" y2="121.2"/>
      <polygon class="acceso cara-izq" points="276.2,201.5 304.8,218.0 304.8,193.8 276.2,177.3"/>
      <polygon class="acceso cara-der" points="333.4,201.5 304.8,218.0 304.8,193.8 333.4,177.3"/>
      <polygon class="acceso cara-sup" points="304.8,160.8 333.4,177.3 304.8,193.8 276.2,177.3"/>
      <polygon class="piscina" points="142.8,162.4 190.5,189.9 161.9,206.4 114.3,178.9"/>
      <line class="tronco" x1="247.6" y1="223.5" x2="247.6" y2="202.9"/>
      <circle class="copa" cx="247.6" cy="200.9" r="7"/>
      <line class="tronco" x1="238.1" y1="245.5" x2="238.1" y2="224.9"/>
      <circle class="copa" cx="238.1" cy="222.9" r="7"/>
    </g>
    <g v-else>
      <polygon class="losa cara-izq" points="28.5,202.6 200.0,301.6 200.0,295.0 28.5,196.0"/>
      <polygon class="losa cara-der" points="371.5,202.6 200.0,301.6 200.0,295.0 371.5,196.0"/>
      <polygon class="losa cara-sup" points="200.0,97.0 371.5,196.0 200.0,295.0 28.5,196.0"/>
      <line class="reticula" x1="219.1" y1="108.0" x2="47.6" y2="207.0"/>
      <line class="reticula" x1="180.9" y1="108.0" x2="352.4" y2="207.0"/>
      <line class="reticula" x1="238.1" y1="119.0" x2="66.6" y2="218.0"/>
      <line class="reticula" x1="161.9" y1="119.0" x2="333.4" y2="218.0"/>
      <line class="reticula" x1="257.2" y1="130.0" x2="85.7" y2="229.0"/>
      <line class="reticula" x1="142.8" y1="130.0" x2="314.3" y2="229.0"/>
      <line class="reticula" x1="276.2" y1="141.0" x2="104.7" y2="240.0"/>
      <line class="reticula" x1="123.8" y1="141.0" x2="295.3" y2="240.0"/>
      <line class="reticula" x1="295.3" y1="152.0" x2="123.8" y2="251.0"/>
      <line class="reticula" x1="104.7" y1="152.0" x2="276.2" y2="251.0"/>
      <line class="reticula" x1="314.3" y1="163.0" x2="142.8" y2="262.0"/>
      <line class="reticula" x1="85.7" y1="163.0" x2="257.2" y2="262.0"/>
      <line class="reticula" x1="333.4" y1="174.0" x2="161.9" y2="273.0"/>
      <line class="reticula" x1="66.6" y1="174.0" x2="238.1" y2="273.0"/>
      <line class="reticula" x1="352.4" y1="185.0" x2="180.9" y2="284.0"/>
      <line class="reticula" x1="47.6" y1="185.0" x2="219.1" y2="284.0"/>
      <polygon class="bloque cara-izq" points="142.8,163.0 219.1,207.0 219.1,102.5 142.8,58.5"/>
      <polygon class="bloque cara-der" points="276.2,174.0 219.1,207.0 219.1,102.5 276.2,69.5"/>
      <polygon class="bloque cara-sup" points="200.0,25.5 276.2,69.5 219.1,102.5 142.8,58.5"/>
      <line class="ventana" x1="146.7" y1="154.2" x2="215.2" y2="193.8"/>
      <line class="ventana tenue" x1="272.4" y1="165.2" x2="222.9" y2="193.8"/>
      <line class="ventana" x1="146.7" y1="138.8" x2="215.2" y2="178.4"/>
      <line class="ventana tenue" x1="272.4" y1="149.8" x2="222.9" y2="178.4"/>
      <line class="ventana" x1="146.7" y1="123.4" x2="215.2" y2="163.0"/>
      <line class="ventana tenue" x1="272.4" y1="134.4" x2="222.9" y2="163.0"/>
      <line class="ventana" x1="146.7" y1="108.0" x2="215.2" y2="147.6"/>
      <line class="ventana tenue" x1="272.4" y1="119.0" x2="222.9" y2="147.6"/>
      <line class="ventana" x1="146.7" y1="92.6" x2="215.2" y2="132.2"/>
      <line class="ventana tenue" x1="272.4" y1="103.6" x2="222.9" y2="132.2"/>
      <line class="ventana" x1="146.7" y1="77.2" x2="215.2" y2="116.8"/>
      <line class="ventana tenue" x1="272.4" y1="88.2" x2="222.9" y2="116.8"/>
      <polygon class="cornisa cara-izq" points="131.4,58.5 219.1,109.1 219.1,103.6 131.4,53.0"/>
      <polygon class="cornisa cara-der" points="287.6,69.5 219.1,109.1 219.1,103.6 287.6,64.0"/>
      <polygon class="cornisa cara-sup" points="200.0,13.4 287.6,64.0 219.1,103.6 131.4,53.0"/>
      <polygon class="acceso cara-izq" points="177.1,196.0 200.0,209.2 200.0,189.4 177.1,176.2"/>
      <polygon class="acceso cara-der" points="211.4,202.6 200.0,209.2 200.0,189.4 211.4,182.8"/>
      <polygon class="acceso cara-sup" points="188.6,169.6 211.4,182.8 200.0,189.4 177.1,176.2"/>
      <line class="tronco" x1="290.5" y1="193.2" x2="290.5" y2="172.7"/>
      <circle class="copa" cx="290.5" cy="170.7" r="7"/>
      <line class="tronco" x1="257.2" y1="212.5" x2="257.2" y2="191.9"/>
      <circle class="copa" cx="257.2" cy="189.9" r="7"/>
    </g>

    <g class="holograma">
      <polygon
        class="panel"
        points="150.5,43.1 217.1,81.6 217.1,125.6 150.5,87.1"
      />
      <text
        class="cifra"
        transform="matrix(0.866 0.5 0 1 183.8 84.3)"
        text-anchor="middle"
        dominant-baseline="central"
      >404</text>
    </g>

    <g
      class="persona"
      transform="translate(161.9 251) scale(1.05)"
    >
      <ellipse
        class="sombra"
        cx="0"
        cy="0"
        rx="15"
        ry="5"
      />
      <path
        class="extremidad"
        d="M-5 -26 L-7 -2 M5 -26 L7 -2"
      />
      <path
        class="cuerpo"
        d="M-10 -50 Q0 -56 10 -50 L8 -24 L-8 -24 Z"
      />
      <rect
        class="propulsor"
        x="-6"
        y="-48"
        width="12"
        height="15"
        rx="2"
      />
      <path
        class="luz"
        d="M-3 -44 v7 M3 -44 v7"
      />
      <path
        class="extremidad"
        d="M-9 -48 L-14 -29 M9 -48 L18 -59"
      />
      <circle
        class="cuerpo"
        cx="0"
        cy="-64"
        r="8"
      />
      <g class="antebrazo">
        <path
          class="extremidad"
          d="M18 -59 L7 -70"
        />
        <circle
          class="mano"
          cx="7"
          cy="-70"
          r="2.8"
        />
      </g>
      <text
        class="duda"
        x="16"
        y="-82"
      >?</text>
      <text
        class="duda segunda"
        x="-22"
        y="-78"
      >?</text>
    </g>
  </svg>
</template>

<style scoped>
.ilustracion {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.cara-sup {
  fill: color-mix(in srgb, var(--cian) 20%, var(--fondo-2));
}

.cara-izq {
  fill: color-mix(in srgb, var(--cian) 9%, var(--fondo));
}

.cara-der {
  fill: color-mix(in srgb, var(--cian) 4%, var(--fondo));
}

.bloque,
.cornisa,
.acceso,
.losa {
  stroke: var(--linea-fuerte);
  stroke-width: 1;
  stroke-linejoin: round;
}

.losa.cara-sup {
  fill: var(--fondo-2);
}

.acceso.cara-sup,
.acceso.cara-izq,
.acceso.cara-der {
  fill: color-mix(in srgb, var(--ambar) 16%, var(--fondo));
  stroke: color-mix(in srgb, var(--ambar) 60%, transparent);
}

.reticula {
  stroke: var(--linea);
  stroke-width: 0.7;
}

.ventana {
  stroke: var(--cian);
  stroke-width: 2;
  stroke-linecap: round;
  opacity: 0.55;
}

.ventana.tenue {
  opacity: 0.28;
}

.piscina {
  fill: color-mix(in srgb, var(--cian) 32%, transparent);
  stroke: var(--cian);
  stroke-width: 1;
}

.tronco {
  stroke: var(--texto-3);
  stroke-width: 2;
}

.copa {
  fill: color-mix(in srgb, var(--verde) 30%, transparent);
  stroke: var(--verde);
  stroke-width: 1;
}

.panel {
  fill: color-mix(in srgb, var(--magenta) 14%, transparent);
  stroke: var(--magenta);
  stroke-width: 1.4;
}

.cifra {
  fill: var(--magenta);
  font-family: var(--fuente-display);
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.holograma {
  animation: parpadeo 3.2s steps(1) infinite;
}

.sombra {
  fill: rgb(0 0 0 / 45%);
}

.cuerpo {
  fill: var(--fondo-2);
  stroke: var(--ambar);
  stroke-width: 2;
  stroke-linejoin: round;
}

.propulsor {
  fill: var(--superficie-solida);
  stroke: var(--ambar);
  stroke-width: 1.4;
}

.luz {
  stroke: var(--cian);
  stroke-width: 2;
  stroke-linecap: round;
}

.extremidad {
  fill: none;
  stroke: var(--ambar);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mano {
  fill: var(--ambar);
}

/* El antebrazo gira sobre el codo (esquina inferior derecha de su caja): se rasca. */
.antebrazo {
  transform-box: fill-box;
  transform-origin: 100% 100%;
  animation: rascar 0.45s ease-in-out infinite alternate;
}

.duda {
  fill: var(--cian);
  font-family: var(--fuente-display);
  font-size: 18px;
  font-weight: 700;
  animation: flotar 2.4s ease-in-out infinite;
}

.duda.segunda {
  font-size: 13px;
  animation-delay: -1.2s;
}

@keyframes rascar {
  from {
    transform: rotate(-9deg);
  }

  to {
    transform: rotate(7deg);
  }
}

@keyframes flotar {
  0%,
  100% {
    opacity: 0.2;
    transform: translateY(4px);
  }

  50% {
    opacity: 1;
    transform: translateY(-4px);
  }
}

@keyframes parpadeo {
  0%,
  100% {
    opacity: 1;
  }

  92% {
    opacity: 0.55;
  }

  94% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .antebrazo,
  .duda,
  .holograma {
    animation: none;
  }
}
</style>
