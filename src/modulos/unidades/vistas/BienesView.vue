<script setup lang="ts">
/**
 * Bienes privados: árbol agrupación → bienes con filtros (código, tipo, torre), crear agrupación
 * y bien, y con `:id` la ficha del bien.
 */
import { computed, onMounted, ref } from 'vue'
import { type RouteLocationRaw, useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { ArbolAgrupaciones, TipoAgrupacion, TipoBienPrivado } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { arbol, crearAgrupacion, crearBien } from '../api'
import { aplanarArbol, opcionesAgrupacion, TIPO_AGRUPACION, TIPO_BIEN } from '../bienes'
import FichaBien from '../componentes/FichaBien.vue'

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const puedeCrearBien = computed(() => entidad.tienePermiso('bienes_privados.editar'))
const puedeCrearAgrupacion = computed(() => entidad.tienePermiso('agrupaciones.editar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const datos = ref<ArbolAgrupaciones>({ agrupaciones: [], sin_agrupacion: [] })
const resultado = ref<string | null>(null)
const q = ref('')
const tipoFiltro = ref<TipoBienPrivado | ''>('')
const torre = ref('')

const bienId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (b = ''): RouteLocationRaw => ({ name: 'modulo', params: { ...route.params, id: b }, query: {} })
const opciones = <T extends string>(m: Record<T, string>) => (Object.keys(m) as T[]).map((valor) => ({ valor, etiqueta: m[valor] }))
const grupos = computed(() => {
  const texto = q.value.trim().toLowerCase()
  return aplanarArbol(datos.value)
    .filter((g) => !torre.value || g.id === torre.value)
    .map((g) => ({ ...g, bienes: g.bienes.filter((b) => (!texto || b.codigo.toLowerCase().includes(texto)) && (!tipoFiltro.value || b.tipo === tipoFiltro.value)) }))
    .filter((g) => g.bienes.length > 0)
})
const agrupaciones = computed(() => opcionesAgrupacion(datos.value))
const padres = computed(() => opcionesAgrupacion(datos.value, true))
const total = computed(() => grupos.value.reduce((n, g) => n + g.bienes.length, 0))

// Crear agrupación
const creandoAgrupacion = ref(false)
const tipoAgrupacion = ref<TipoAgrupacion>('edificio')
const nombreAgrupacion = ref('')
const codigoAgrupacion = ref('')
const padre = ref('')
const nuevaAgrupacion = useAccion((clave) =>
  crearAgrupacion(id.value, { tipo: tipoAgrupacion.value, nombre: nombreAgrupacion.value.trim(), codigo: codigoAgrupacion.value.trim(), padre_id: padre.value || null }, clave),
)

function abrirAgrupacion() {
  nombreAgrupacion.value = codigoAgrupacion.value = padre.value = ''
  nuevaAgrupacion.reiniciar()
  creandoAgrupacion.value = true
}

async function enviarAgrupacion() {
  if (!nombreAgrupacion.value.trim() || !codigoAgrupacion.value.trim()) return
  const r = await nuevaAgrupacion.ejecutar()
  if (!r.ok) return
  creandoAgrupacion.value = false
  resultado.value = `${r.valor.nombre} creada.`
  await cargar()
}

// Crear bien
const creandoBien = ref(false)
const tipoBien = ref<TipoBienPrivado>('apartamento')
const agrupacionBien = ref('')
const numero = ref('')
const nuevoBien = useAccion((clave) =>
  crearBien(id.value, { tipo: tipoBien.value, agrupacion_id: agrupacionBien.value || null, numero: numero.value.trim() || null }, clave),
)

function abrirBien() {
  numero.value = ''
  agrupacionBien.value = torre.value
  nuevoBien.reiniciar()
  creandoBien.value = true
}

async function enviarBien() {
  if (!numero.value.trim()) return
  const r = await nuevoBien.ejecutar()
  if (!r.ok) return
  creandoBien.value = false
  resultado.value = `Bien ${r.valor.codigo} creado: queda sin coeficiente hasta que se active un cuadro que lo incluya.`
  await cargar()
}

async function cargar() {
  estado.value = 'cargando'
  try {
    datos.value = await arbol(id.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section
    class="bienes"
    aria-labelledby="titulo-bienes"
  >
    <header class="encabezado">
      <div>
        <RouterLink
          v-if="bienId"
          :to="ruta()"
          class="volver"
        >
          <IVolver aria-hidden="true" /> Todos los bienes
        </RouterLink>
        <h1 id="titulo-bienes">
          Bienes privados
        </h1>
      </div>
      <div
        v-if="!bienId"
        class="botones"
      >
        <HudBoton
          v-if="puedeCrearAgrupacion"
          variante="secundario"
          @click="abrirAgrupacion"
        >
          <IMas aria-hidden="true" /> Nueva agrupación
        </HudBoton>
        <HudBoton
          v-if="puedeCrearBien"
          @click="abrirBien"
        >
          <IMas aria-hidden="true" /> Nuevo bien
        </HudBoton>
      </div>
    </header>

    <FichaBien
      v-if="bienId"
      :key="bienId"
      :bien-id="bienId"
    />
    <template v-else>
      <p
        v-if="resultado"
        class="ok"
        role="status"
      >
        {{ resultado }}
      </p>
      <div class="filtros">
        <HudCampo
          v-model="q"
          etiqueta="Buscar por código"
          tipo="search"
          autocompletar="off"
        />
        <HudSelector
          v-model="tipoFiltro"
          etiqueta="Tipo"
          vacio="Todos"
          :opciones="opciones(TIPO_BIEN)"
        />
        <HudSelector
          v-model="torre"
          etiqueta="Agrupación"
          vacio="Todas"
          :opciones="agrupaciones"
        />
      </div>
      <HudEstado
        v-if="estado === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="estado === 'error'"
        estado="error"
        :mensaje="error ?? undefined"
        @reintentar="cargar"
      />
      <HudEstado
        v-else-if="total === 0"
        estado="vacio"
        :mensaje="q || tipoFiltro || torre ? 'Ningún bien coincide con los filtros.' : 'Aún no hay bienes registrados. Puede importarlos desde una planilla.'"
      />
      <template v-else>
        <p
          class="texto-2"
          aria-live="polite"
        >
          {{ total }} bienes
        </p>
        <section
          v-for="g in grupos"
          :key="g.id ?? 'sin'"
          class="grupo"
          :aria-label="g.ruta"
        >
          <h2>{{ g.ruta }} <small>({{ g.bienes.length }})</small></h2>
          <ul class="chips">
            <li
              v-for="b in g.bienes"
              :key="b.id"
            >
              <RouterLink :to="ruta(b.id)">
                <strong>{{ b.codigo }}</strong>
                <small>{{ TIPO_BIEN[b.tipo] }}</small>
              </RouterLink>
            </li>
          </ul>
        </section>
      </template>
    </template>

    <HudDialogo
      v-model:abierto="creandoAgrupacion"
      titulo="Nueva agrupación"
    >
      <form
        id="formulario-agrupacion"
        class="campos"
        @submit.prevent="enviarAgrupacion"
      >
        <HudSelector
          v-model="tipoAgrupacion"
          etiqueta="Tipo"
          :opciones="opciones(TIPO_AGRUPACION)"
        />
        <HudCampo
          v-model="nombreAgrupacion"
          etiqueta="Nombre"
          requerido
        />
        <HudCampo
          v-model="codigoAgrupacion"
          etiqueta="Código"
          ayuda="Se usa en los códigos de los bienes (p. ej. T3)."
          requerido
        />
        <HudSelector
          v-model="padre"
          etiqueta="Dentro de (opcional)"
          vacio="Ninguna"
          :opciones="padres"
          ayuda="Hasta tres niveles."
        />
        <p
          v-if="nuevaAgrupacion.error.value"
          class="error"
          role="alert"
        >
          {{ nuevaAgrupacion.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="creandoAgrupacion = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-agrupacion"
          :cargando="nuevaAgrupacion.cargando.value"
        >
          Crear
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="creandoBien"
      titulo="Nuevo bien privado"
    >
      <form
        id="formulario-bien"
        class="campos"
        @submit.prevent="enviarBien"
      >
        <HudSelector
          v-model="tipoBien"
          etiqueta="Tipo"
          :opciones="opciones(TIPO_BIEN)"
        />
        <HudSelector
          v-model="agrupacionBien"
          etiqueta="Agrupación"
          vacio="Sin agrupación"
          :opciones="agrupaciones"
        />
        <HudCampo
          v-model="numero"
          etiqueta="Número"
          ayuda="El código se arma con la agrupación: T1 + 506 → T1-506."
          requerido
        />
        <p
          v-if="nuevoBien.error.value"
          class="error"
          role="alert"
        >
          {{ nuevoBien.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="creandoBien = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-bien"
          :cargando="nuevoBien.cargando.value"
        >
          Crear
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped>
.bienes,
.campos {
  display: grid;
  gap: 16px;
}

.encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

h1 {
  font-size: clamp(24px, 3.5vw, 34px);
}

h2 {
  margin: 0 0 8px;
  font-size: 18px;
}

.volver {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  color: var(--cian);
}

.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filtros {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 12px;
}

.texto-2 {
  margin: 0;
  color: var(--texto-2);
}

small {
  color: var(--texto-3);
  font-weight: 400;
}

.chips {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chips a {
  display: grid;
  gap: 2px;
  min-height: 52px;
  padding: 8px 10px;
  border: 1px solid var(--linea);
  background: var(--superficie);
  color: var(--texto);
  text-decoration: none;
}

.chips a:hover,
.chips a:focus-visible {
  border-color: var(--cian);
  background: var(--cian-tenue);
}

.ok,
.error {
  margin: 0;
}

.ok {
  padding: 10px 14px;
  border-left: 3px solid var(--verde);
  background: color-mix(in srgb, var(--verde) 10%, transparent);
}

.error {
  color: var(--magenta);
}
</style>
