<script setup lang="ts">
/**
 * Vista de lista: todas las funciones sin la maqueta. Se usa sin WebGL, si falla la escena o
 * por preferencia del usuario. Siempre debe ofrecer lo mismo que la maqueta.
 */
import { computed, ref } from 'vue'
import { TEXTO_ESTADO } from '@/escena/mapa-modulos'
import IBuscar from '~icons/tabler/search'
import ICandado from '~icons/tabler/lock'
import { ICONOS } from '../iconos'
import { useNavegacion } from '../navegacion'

defineProps<{ aviso?: string | null }>()

const nav = useNavegacion()
const filtro = ref('')

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const ORDEN = { activa: 0, sin_acceso: 1, no_contratada: 2, proximamente: 3 } as const

const lista = computed(() => {
  const f = normalizar(filtro.value.trim())
  return nav.secciones.value
    .map((s) => ({
      ...s,
      acciones: f
        ? s.acciones.filter((a) => normalizar(`${a.etiqueta} ${a.descripcion}`).includes(f))
        : s.acciones,
    }))
    .filter(
      (s) =>
        !f ||
        normalizar(`${s.seccion.nombre} ${s.seccion.resumen}`).includes(f) ||
        s.acciones.length > 0,
    )
    .sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado])
})
</script>

<template>
  <section class="menu">
    <p
      v-if="aviso"
      class="aviso"
      role="status"
    >
      {{ aviso }}
    </p>
    <div class="cabecera">
      <div>
        <p class="rotulo acento">
          Módulos
        </p>
        <h1>¿Qué necesita hacer?</h1>
      </div>
      <label class="buscar">
        <IBuscar aria-hidden="true" />
        <span class="solo-lector">Buscar función</span>
        <input
          v-model="filtro"
          type="search"
          placeholder="Buscar: reservas, cartera, visitas…"
        >
      </label>
    </div>

    <ul class="rejilla">
      <li
        v-for="s in lista"
        :key="s.seccion.slug"
        class="tarjeta"
        :class="s.estado"
      >
        <div class="titulo">
          <component
            :is="ICONOS[s.seccion.slug]"
            class="icono"
            aria-hidden="true"
          />
          <div>
            <h2>{{ s.seccion.nombre }}</h2>
            <p>{{ s.seccion.resumen }}</p>
          </div>
        </div>
        <ul
          v-if="s.estado === 'activa'"
          class="acciones"
        >
          <li
            v-for="a in s.acciones"
            :key="a.id"
          >
            <RouterLink :to="nav.rutaAccion(s.seccion.slug, a.id)">
              {{ a.etiqueta }}
            </RouterLink>
          </li>
        </ul>
        <p
          v-else
          class="bloqueo"
        >
          <ICandado aria-hidden="true" /> {{ TEXTO_ESTADO[s.estado] }}
        </p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.menu {
  max-width: 1200px;
  margin: 0 auto;
  padding: clamp(20px, 4vw, 40px) var(--gutter) 48px;
}

.aviso {
  margin: 0 0 20px;
  padding: 10px 14px;
  border-left: 3px solid var(--ambar);
  background: rgb(255 179 71 / 8%);
  color: var(--texto-2);
  font-size: 14px;
}

.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.acento {
  margin: 0 0 6px;
  color: var(--cian);
}

h1 {
  font-size: clamp(28px, 4vw, 40px);
}

.buscar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1 1 280px;
  max-width: 420px;
  height: 46px;
  padding: 0 14px;
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

.rejilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tarjeta {
  padding: 18px;
  border: 1px solid var(--linea);
  border-top: 2px solid var(--cian);
  background: var(--superficie);
}

.tarjeta:not(.activa) {
  border-top-color: var(--gris-apagado);
  opacity: 0.7;
}

.titulo {
  display: flex;
  gap: 12px;
}

.icono {
  flex: none;
  font-size: 26px;
  color: var(--cian);
}

.tarjeta:not(.activa) .icono {
  color: var(--gris-apagado);
}

h2 {
  font-size: 19px;
}

.titulo p {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--texto-2);
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.acciones a {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--linea);
  background: rgb(5 10 20 / 45%);
  color: var(--texto);
  font-size: 13.5px;
  text-decoration: none;
}

.acciones a:hover,
.acciones a:focus-visible {
  border-color: var(--cian);
  background: var(--cian-tenue);
}

.bloqueo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 0;
  font-size: 13px;
  color: var(--texto-3);
}
</style>
