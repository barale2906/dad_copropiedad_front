<script setup lang="ts">
/**
 * Selección de la entidad (PH o empresa) en la que se va a trabajar. Con una sola entidad el
 * router entra directo y esta pantalla no se ve.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { EntidadDeLaCuenta } from '@/api/tipos'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import IBuscar from '~icons/tabler/search'
import IEdificio from '~icons/tabler/building-skyscraper'
import IMaletin from '~icons/tabler/briefcase'
import IFlecha from '~icons/tabler/chevron-right'
import ISalir from '~icons/tabler/logout'
import MarcaDad from './componentes/MarcaDad.vue'
import { ESTADO_ENTIDAD, TIPO_ENTIDAD } from './textos-entidad'

const sesion = useSesion()
const entidad = useEntidad()
const router = useRouter()

const filtro = ref('')
const ultima = entidad.ultima()

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const lista = computed(() => {
  const f = normalizar(filtro.value.trim())
  const todas = sesion.entidades.filter(
    (e) => !f || normalizar(`${e.nombre} ${e.nit ?? ''}`).includes(f),
  )
  // La última usada primero.
  return [...todas].sort((a, b) => Number(b.entidad_id === ultima) - Number(a.entidad_id === ultima))
})

const roles = (r: string[]) => r.map((x) => x.replace(/_/g, ' ')).join(' · ')

function abrir(e: EntidadDeLaCuenta) {
  router.push({ name: 'maqueta', params: { entidadId: e.entidad_id } })
}

async function salir() {
  await sesion.cerrar()
  router.replace({ name: 'ingresar' })
}
</script>

<template>
  <main class="selector">
    <div
      class="fondo-hud"
      aria-hidden="true"
    />
    <header class="barra">
      <MarcaDad />
      <HudBoton
        variante="fantasma"
        @click="salir"
      >
        <ISalir /> Salir
      </HudBoton>
    </header>

    <section class="contenido">
      <p class="rotulo acento">
        Selección de sector
      </p>
      <template v-if="sesion.entidades.length > 0">
        <h1>¿Dónde va a trabajar hoy?</h1>
        <p class="ayuda">
          Tiene acceso a {{ sesion.entidades.length }}
          {{ sesion.entidades.length === 1 ? 'entidad' : 'entidades' }}.
        </p>
      </template>
      <template v-else>
        <h1>Su cuenta aún no tiene roles</h1>
        <p class="vacio">
          Todavía no puede trabajar en ninguna copropiedad ni empresa. Pida al administrador de
          su entidad que le asigne un rol y vuelva a iniciar sesión.
        </p>
      </template>

      <label
        v-if="sesion.entidades.length > 5"
        class="buscar"
      >
        <IBuscar aria-hidden="true" />
        <span class="solo-lector">Buscar entidad</span>
        <input
          v-model="filtro"
          type="search"
          placeholder="Buscar por nombre o NIT"
        >
      </label>

      <ul
        v-if="lista.length > 0"
        class="rejilla"
      >
        <li
          v-for="(e, i) in lista"
          :key="e.entidad_id"
          :style="{ '--i': i }"
        >
          <button
            class="tarjeta"
            :class="{ ph: e.tipo === 'propiedad_horizontal', suspendida: e.estado === 'suspendida' }"
            @click="abrir(e)"
          >
            <span
              class="icono"
              aria-hidden="true"
            >
              <IEdificio v-if="e.tipo === 'propiedad_horizontal'" />
              <IMaletin v-else />
            </span>
            <span class="datos">
              <span class="tipo rotulo">
                {{ TIPO_ENTIDAD[e.tipo] }}
                <em v-if="e.entidad_id === ultima">· Última</em>
              </span>
              <strong>{{ e.nombre }}</strong>
              <span class="meta">
                <span v-if="e.nit">NIT {{ e.nit }}</span>
                <span
                  class="estado"
                  :data-estado="e.estado"
                >{{ ESTADO_ENTIDAD[e.estado] }}</span>
              </span>
              <span class="roles">{{ roles(e.roles) }}</span>
            </span>
            <IFlecha
              class="flecha"
              aria-hidden="true"
            />
          </button>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.selector {
  min-height: 100dvh;
  padding: 0 var(--gutter) 48px;
}

.barra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
  max-width: 1200px;
  margin: 0 auto;
}

.contenido {
  max-width: 1200px;
  margin: clamp(16px, 6vh, 64px) auto 0;
}

.acento {
  color: var(--cian);
  margin: 0 0 8px;
}

h1 {
  font-size: clamp(30px, 4.5vw, 48px);
}

.ayuda {
  color: var(--texto-2);
  margin: 8px 0 24px;
}

.buscar {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 420px;
  height: 46px;
  padding: 0 14px;
  margin-bottom: 24px;
  border: 1px solid var(--linea);
  background: rgb(5 10 20 / 60%);
  color: var(--texto-3);
}

.buscar:focus-within {
  border-color: var(--cian);
}

.buscar input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  outline: none;
  font-size: 16px;
}

.vacio {
  color: var(--texto-2);
  max-width: 60ch;
  margin-top: 12px;
}

.rejilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rejilla li {
  animation: entrar var(--medio) var(--curva) both;
  animation-delay: calc(var(--i) * 50ms);
}

@keyframes entrar {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

.tarjeta {
  --c: var(--ambar);

  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  height: 100%;
  padding: 18px;
  border: 1px solid var(--linea);
  border-left: 3px solid var(--c);
  background: var(--superficie);
  text-align: left;
  cursor: pointer;
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%);
  transition:
    transform var(--rapido) var(--curva),
    background var(--rapido),
    border-color var(--rapido);
}

.tarjeta.ph {
  --c: var(--cian);
}

.tarjeta:hover,
.tarjeta:focus-visible {
  background: var(--superficie-alta);
  border-color: var(--c);
  transform: translateY(-2px);
}

.tarjeta.suspendida {
  opacity: 0.6;
}

.icono {
  display: grid;
  place-items: center;
  flex: none;
  width: 52px;
  height: 52px;
  font-size: 26px;
  color: var(--c);
  background: color-mix(in srgb, var(--c) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
  transform: rotate(45deg);
}

.icono :deep(svg) {
  transform: rotate(-45deg);
}

.datos {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.tipo {
  color: var(--c);
}

.tipo em {
  font-style: normal;
  color: var(--texto-3);
}

strong {
  font-family: var(--fuente-display);
  font-size: 20px;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 13px;
  color: var(--texto-2);
}

.estado[data-estado='activa'] {
  color: var(--verde);
}

.estado[data-estado='suspendida'] {
  color: var(--magenta);
}

.estado[data-estado='en_configuracion'] {
  color: var(--ambar);
}

.roles {
  font-size: 12.5px;
  color: var(--texto-3);
  text-transform: capitalize;
}

.flecha {
  flex: none;
  font-size: 22px;
  color: var(--texto-3);
}

.tarjeta:hover .flecha {
  color: var(--c);
}
</style>
