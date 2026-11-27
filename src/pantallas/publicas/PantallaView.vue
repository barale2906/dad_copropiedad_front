<script setup lang="ts">
/**
 * Pantalla del lobby (televisor, `X-Pantalla`): rota las piezas sin controles, se actualiza cada
 * 5 minutos y, si la red falla, sigue mostrando lo último y reintenta solo. El token se conserva
 * en el fragmento para que el televisor se recupere si recarga.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { tomarCredencial } from '@/api/credencial-externa'
import { cartelera, enlaceNoValido } from '@/api/publico'
import type { PiezaPublicidad } from '@/api/tipos'
import { useRefresco } from '@/composables/useRefresco'
import { enlaceSeguro } from '@/formato/directorio'
import HudCodigoQr from '@/hud/componentes/HudCodigoQr.vue'
import EnlaceNoValido from './EnlaceNoValido.vue'
import MarcaDad from '../componentes/MarcaDad.vue'

/** Segundos que se muestra cada pieza. */
const ROTACION = 12
/** Con red, la cartelera se vuelve a pedir cada 5 minutos; sin red, cada minuto. */
const ACTUALIZACION = 300_000

const route = useRoute()
const id = String(route.params.copropiedadId ?? '')
const piezas = ref<PiezaPublicidad[]>([])
const indice = ref(0)
const estado = ref<'cargando' | 'listo' | 'enlace'>('cargando')
const sinRed = ref(false)
let ultima = 0
let reloj: ReturnType<typeof setInterval> | undefined

const actual = computed(() => piezas.value[indice.value % Math.max(piezas.value.length, 1)] ?? null)
const enlace = computed(() => enlaceSeguro(actual.value?.enlace))

async function cargar() {
  try {
    piezas.value = await cartelera(id)
    ultima = Date.now()
    sinRed.value = false
    estado.value = 'listo'
  } catch (e) {
    if (enlaceNoValido(e)) estado.value = 'enlace'
    // Sin red: se conserva lo último y el próximo ciclo reintenta.
    else {
      sinRed.value = true
      if (estado.value === 'cargando') estado.value = 'listo'
    }
  }
}

/** Cada minuto: reintenta si no hay red, o actualiza si ya pasaron 5 minutos. */
function tic() {
  if (estado.value === 'enlace') return
  if (sinRed.value || Date.now() - ultima >= ACTUALIZACION) return cargar()
}

useRefresco(tic, { cada: 60_000 })
onMounted(() => {
  if (!tomarCredencial('pantalla', { conservar: true })) {
    estado.value = 'enlace'
    return
  }
  void cargar()
  reloj = setInterval(() => (indice.value = (indice.value + 1) % Math.max(piezas.value.length, 1)), ROTACION * 1000)
})
onBeforeUnmount(() => clearInterval(reloj))
</script>

<template>
  <main class="pantalla">
    <div
      class="fondo-hud"
      aria-hidden="true"
    />
    <header class="cabecera">
      <MarcaDad />
      <p class="rotulo">
        Ofertas del sector
      </p>
    </header>
    <div
      v-if="estado === 'enlace'"
      class="centro"
    >
      <EnlaceNoValido quien="a la plataforma DAD" />
    </div>
    <p
      v-else-if="estado === 'cargando'"
      class="centro mensaje"
    >
      Cargando…
    </p>
    <p
      v-else-if="!actual"
      class="centro mensaje"
    >
      Pronto verá aquí las ofertas de los comercios del sector.
    </p>
    <Transition
      v-else
      name="vista"
      mode="out-in"
    >
      <article
        :key="actual.creativo_id"
        class="pieza"
        aria-live="polite"
      >
        <img
          v-if="actual.imagen_url"
          :src="actual.imagen_url"
          alt=""
          class="imagen"
        >
        <div class="texto">
          <p class="comercio">
            {{ actual.nombre_comercial }}
          </p>
          <h1>{{ actual.titulo }}</h1>
          <p class="cuerpo">
            {{ actual.texto }}
          </p>
          <p
            v-if="actual.condiciones"
            class="condiciones"
          >
            {{ actual.condiciones }}
          </p>
        </div>
        <div
          v-if="enlace"
          class="qr"
        >
          <HudCodigoQr
            :texto="enlace"
            :descripcion="`Código QR de ${actual.nombre_comercial}`"
          />
          <p>Escanee para ver más</p>
        </div>
      </article>
    </Transition>
    <p
      v-if="sinRed"
      class="sin-red"
      role="status"
    >
      Sin conexión: se muestra lo último y se reintenta solo.
    </p>
  </main>
</template>

<style scoped>
.imagen {
  max-inline-size: 40%;
  max-block-size: 60vh;
  object-fit: contain;
}
.pantalla {
  display: grid;
  grid-template-rows: auto 1fr auto;
  position: relative;
  min-height: 100dvh;
  padding: clamp(16px, 3vw, 48px);
  cursor: none;
}

.cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.rotulo {
  margin: 0;
  color: var(--cian);
  font-size: clamp(16px, 2vw, 26px);
}

.centro {
  align-self: center;
  justify-self: center;
  max-width: 720px;
}

.mensaje {
  color: var(--texto-2);
  font-size: clamp(20px, 3vw, 36px);
  text-align: center;
}

.pieza {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: clamp(24px, 4vw, 80px);
}

.texto {
  max-width: 900px;
}

.comercio {
  margin: 0;
  color: var(--cian);
  font-size: clamp(20px, 2.6vw, 34px);
}

h1 {
  margin: 8px 0;
  font-size: clamp(34px, 6vw, 88px);
  line-height: 1.05;
}

.cuerpo {
  margin: 0;
  color: var(--texto-2);
  font-size: clamp(20px, 2.6vw, 38px);
}

.condiciones {
  margin: 14px 0 0;
  color: var(--texto-3);
  font-size: clamp(14px, 1.4vw, 20px);
}

.qr {
  display: grid;
  justify-items: center;
  gap: 8px;
  width: clamp(160px, 18vw, 280px);
}

.qr p {
  margin: 0;
  color: var(--texto-2);
}

.sin-red {
  margin: 0;
  color: var(--ambar);
  text-align: center;
}
</style>
