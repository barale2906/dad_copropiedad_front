<script setup lang="ts">
/** Una pieza publicitaria: título, texto, condiciones, vigencia, enlace del comercio, cupón y reporte. */
import { computed } from 'vue'
import type { CuponPublicidad, PiezaPublicidad } from '@/api/tipos'
import { FORMATO_PIEZA } from '@/composables/textos-publicidad'
import { enlaceSeguro } from '@/formato/directorio'
import { fecha } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import SecretoUnaVez from '@/hud/componentes/SecretoUnaVez.vue'
import IEnlace from '~icons/tabler/external-link'

const props = withDefaults(
  defineProps<{ pieza: PiezaPublicidad; zona: string; cupon?: CuponPublicidad | null; pidiendoCupon?: boolean }>(),
  { cupon: null, pidiendoCupon: false },
)
defineEmits<{ cupon: []; clic: []; reportar: [] }>()

const enlace = computed(() => enlaceSeguro(props.pieza.enlace))
const vence = computed(() => fecha(props.pieza.vence_en, props.zona))
</script>

<template>
  <article class="pieza">
    <header>
      <p class="comercio">
        {{ pieza.nombre_comercial }}
      </p>
      <HudInsignia :tono="pieza.es_promocion ? 'aviso' : 'info'">
        {{ pieza.es_promocion ? 'Promoción' : FORMATO_PIEZA[pieza.formato] }}
      </HudInsignia>
    </header>
    <h2>{{ pieza.titulo }}</h2>
    <p class="texto">
      {{ pieza.texto }}
    </p>
    <p
      v-if="pieza.condiciones"
      class="condiciones"
    >
      Condiciones: {{ pieza.condiciones }}
    </p>
    <p class="vence">
      Vigente hasta el {{ vence }}
    </p>
    <SecretoUnaVez
      v-if="cupon"
      :valor="cupon.codigo"
      etiqueta="Código del cupón"
      :aviso="`Preséntelo en ${cupon.nombre_comercial} antes del ${fecha(cupon.vence_en, zona)}.`"
    />
    <div class="botones">
      <HudBoton
        v-if="pieza.tiene_cupon && !cupon"
        :cargando="pidiendoCupon"
        @click="$emit('cupon')"
      >
        Obtener cupón<span class="solo-lector"> de {{ pieza.titulo }}</span>
      </HudBoton>
      <a
        v-if="enlace"
        class="enlace"
        :href="enlace"
        target="_blank"
        rel="noopener noreferrer"
        @click="$emit('clic')"
      >
        {{ pieza.boton || 'Ver más' }}<span class="solo-lector"> de {{ pieza.nombre_comercial }} (se abre en otra pestaña)</span>
        <IEnlace aria-hidden="true" />
      </a>
      <HudBoton
        variante="fantasma"
        @click="$emit('reportar')"
      >
        Reportar<span class="solo-lector"> el anuncio {{ pieza.titulo }}</span>
      </HudBoton>
    </div>
  </article>
</template>

<style scoped>
.pieza {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--linea);
  background: var(--superficie);
}

header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 10px;
}

.comercio {
  margin: 0;
  color: var(--texto-2);
  font-size: 14px;
}

h2 {
  margin: 0;
  font-size: 20px;
  overflow-wrap: anywhere;
}

.texto,
.condiciones,
.vence {
  margin: 0;
  overflow-wrap: anywhere;
}

.condiciones,
.vence {
  color: var(--texto-3);
  font-size: 14px;
}

.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.enlace {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--linea-fuerte);
  color: var(--cian);
  text-decoration: none;
}

.enlace:hover,
.enlace:focus-visible {
  background: var(--cian-tenue);
}
</style>
