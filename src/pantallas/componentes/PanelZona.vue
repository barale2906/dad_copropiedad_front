<script setup lang="ts">
/**
 * Menú de la zona elegida en la maqueta: lo que puede hacer cada módulo de la zona, filtrado
 * por módulos contratados y permisos. Panel lateral en escritorio, hoja inferior en móvil.
 */
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import { TEXTO_ESTADO } from '@/escena/mapa-modulos'
import type { ZonaInfo } from '@/escena/plantillas/zonas'
import ICandado from '~icons/tabler/lock'
import IFlecha from '~icons/tabler/chevron-right'
import ICerrar from '~icons/tabler/x'
import { ICONOS } from '../iconos'
import { useNavegacion } from '../navegacion'

const props = defineProps<{ zona: ZonaInfo }>()
const emit = defineEmits<{ cerrar: []; medida: [ancho: number, alto: number] }>()

const nav = useNavegacion()
const raiz = useTemplateRef<HTMLElement>('raiz')

const secciones = computed(() =>
  props.zona.secciones.map((s) => nav.vistaSeccion(s)!).filter(Boolean),
)
const estado = computed(() => nav.estadosZonas.value[props.zona.id] ?? 'activa')

let observador: ResizeObserver | null = null
onMounted(() => {
  observador = new ResizeObserver(([e]) => {
    if (e) emit('medida', e.contentRect.width, e.target.getBoundingClientRect().height)
  })
  if (raiz.value) observador.observe(raiz.value)
  raiz.value?.focus({ preventScroll: true })
  window.addEventListener('keydown', alTecla)
})
onBeforeUnmount(() => {
  observador?.disconnect()
  window.removeEventListener('keydown', alTecla)
})

function alTecla(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('cerrar')
}
</script>

<template>
  <aside
    ref="raiz"
    class="panel"
    :class="estado"
    tabindex="-1"
    :aria-label="`Zona ${zona.nombre}`"
  >
    <span
      class="agarre"
      aria-hidden="true"
    />
    <header>
      <div>
        <p class="rotulo">
          Zona · {{ TEXTO_ESTADO[estado] }}
        </p>
        <h2>{{ zona.nombre }}</h2>
      </div>
      <button
        class="cerrar"
        aria-label="Cerrar"
        @click="emit('cerrar')"
      >
        <ICerrar />
      </button>
    </header>

    <div class="cuerpo">
      <section
        v-for="s in secciones"
        :key="s.seccion.slug"
        class="seccion"
        :class="s.estado"
      >
        <div class="titulo">
          <component
            :is="ICONOS[s.seccion.slug]"
            class="icono"
            aria-hidden="true"
          />
          <div>
            <h3>{{ s.seccion.nombre }}</h3>
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
            <RouterLink :to="nav.rutaAccion(s.seccion.slug, a.id, zona)">
              <span>
                <strong>{{ a.etiqueta }}</strong>
                <small>{{ a.descripcion }}</small>
              </span>
              <IFlecha aria-hidden="true" />
            </RouterLink>
          </li>
        </ul>
        <p
          v-else
          class="bloqueo"
        >
          <ICandado aria-hidden="true" />
          <span v-if="s.estado === 'no_contratada'">
            Módulo no contratado. Escríbanos para activarlo en esta entidad.
          </span>
          <span v-else-if="s.estado === 'proximamente'">Disponible próximamente.</span>
          <span v-else-if="nav.sinSegundoFactor(s.seccion.slug)">
            La consola exige el segundo factor.
            <RouterLink :to="{ name: 'cuenta', hash: '#segundo-factor' }">Actívelo en Mi cuenta</RouterLink>.
          </span>
          <span v-else>Su rol no tiene permisos en este módulo.</span>
        </p>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.panel {
  position: absolute;
  z-index: 15;
  top: 16px;
  right: 16px;
  bottom: 16px;
  width: min(400px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  background: var(--superficie);
  backdrop-filter: blur(16px) saturate(1.2);
  border: 1px solid var(--linea-fuerte);
  box-shadow: var(--sombra);
  clip-path: polygon(16px 0, 100% 0, 100% 100%, 0 100%, 0 16px);
  outline: none;
  animation: deslizar var(--medio) var(--curva);
}

@keyframes deslizar {
  from {
    opacity: 0;
    transform: translateX(24px);
  }
}

.agarre {
  display: none;
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 20px 14px;
  border-bottom: 1px solid var(--linea);
}

header .rotulo {
  margin: 0 0 4px;
  color: var(--cian);
}

.no_contratada header .rotulo,
.sin_acceso header .rotulo,
.proximamente header .rotulo {
  color: var(--gris-apagado);
}

h2 {
  font-size: 26px;
}

.cerrar {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: none;
  border: 1px solid var(--linea);
  background: none;
  color: var(--texto-2);
  font-size: 20px;
  cursor: pointer;
}

.cerrar:hover {
  color: var(--cian);
  border-color: var(--cian);
}

.cuerpo {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px 20px 20px;
}

.seccion {
  padding: 14px 0;
  border-bottom: 1px dashed var(--linea);
}

.seccion:last-child {
  border-bottom: 0;
}

.titulo {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.icono {
  flex: none;
  font-size: 24px;
  color: var(--cian);
  margin-top: 2px;
}

.seccion:not(.activa) .icono {
  color: var(--gris-apagado);
}

h3 {
  font-size: 18px;
}

.titulo p {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--texto-2);
}

.acciones {
  display: grid;
  gap: 6px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.acciones a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 48px;
  padding: 8px 12px;
  border: 1px solid var(--linea);
  border-left: 2px solid var(--cian);
  background: rgb(5 10 20 / 45%);
  color: var(--texto);
  text-decoration: none;
  transition:
    background var(--rapido),
    transform var(--rapido) var(--curva);
}

.acciones a:hover,
.acciones a:focus-visible {
  background: var(--cian-tenue);
  transform: translateX(3px);
}

.acciones span {
  display: grid;
}

.acciones strong {
  font-size: 14.5px;
}

.acciones small {
  font-size: 12.5px;
  color: var(--texto-3);
}

.acciones svg {
  flex: none;
  color: var(--cian);
}

.bloqueo {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 10px 0 0;
  padding: 10px 12px;
  border: 1px dashed var(--linea);
  font-size: 13px;
  color: var(--texto-3);
}

.bloqueo svg {
  flex: none;
  margin-top: 2px;
}

/* Móvil: hoja inferior. */
@media (max-width: 760px) {
  .panel {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-height: 58%;
    clip-path: polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%, 0 16px);
    animation-name: subir;
  }

  @keyframes subir {
    from {
      opacity: 0;
      transform: translateY(40px);
    }
  }

  .agarre {
    display: block;
    width: 44px;
    height: 4px;
    margin: 8px auto 0;
    background: var(--linea-fuerte);
    border-radius: 2px;
  }

  header {
    padding-top: 10px;
  }
}
</style>
