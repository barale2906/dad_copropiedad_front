<script setup lang="ts">
/**
 * Clientes de la plataforma: PH, empresas y la plataforma en una tabla (búsqueda por nombre o
 * NIT en el backend; tipo y estado filtran lo cargado), el alta con su administrador y la ficha
 * de cada cliente (`:id`).
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { EntidadPlataforma, EstadoEntidad, TipoEntidad } from '@/api/tipos'
import { useListado } from '@/composables/useListado'
import { ESTADO_ENTIDAD, TIPO_ENTIDAD } from '@/formato/textos-entidad'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { listarEntidades } from '../api-clientes'
import AltaCliente from '../componentes/AltaCliente.vue'
import FichaCliente from '../componentes/FichaCliente.vue'
import { NOMBRE_MODULO, TONO_ESTADO_ENTIDAD } from '../reglas'
import { useClientes, usePermisosPlataforma } from '../store'

const route = useRoute()
const router = useRouter()
const clientes = useClientes()
const { puede } = usePermisosPlataforma()

const clienteId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const filtros = ref({ q: '' })
const tipo = ref<TipoEntidad | ''>('')
const estado = ref<EstadoEntidad | ''>('')
const creando = ref(false)
const resultado = ref<string | null>(null)

const listado = useListado((despues, f: { q: string }) => listarEntidades(despues, f.q), { filtros })
const puedeAlta = computed(() => puede('plataforma.copropiedades.crear') || puede('plataforma.entidades.crear'))
const filas = computed(() =>
  listado.filas.value.filter((e) => (!tipo.value || e.tipo === tipo.value) && (!estado.value || e.estado === estado.value)),
)
const opcionesTipo = [{ valor: '', etiqueta: 'Todos' }, ...(Object.keys(TIPO_ENTIDAD) as TipoEntidad[]).map((t) => ({ valor: t, etiqueta: TIPO_ENTIDAD[t] }))]
const opcionesEstado = [
  { valor: '', etiqueta: 'Todos' },
  ...(Object.keys(ESTADO_ENTIDAD) as EstadoEntidad[]).map((e) => ({ valor: e, etiqueta: ESTADO_ENTIDAD[e] })),
]
const COLUMNAS = [
  { clave: 'nombre', titulo: 'Cliente' },
  { clave: 'tipo', titulo: 'Tipo' },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'modulos', titulo: 'Módulos' },
]
const ruta = (id = '') => ({ name: 'modulo', params: { ...route.params, id }, query: {} })
const modulos = (e: EntidadPlataforma) => e.modulos.map((m) => NOMBRE_MODULO[m]).join(', ') || 'Ninguno'

function abrirAlta() {
  resultado.value = null
  creando.value = true
}

async function creada(id: string, nombre: string) {
  resultado.value = `${nombre} quedó dada de alta en configuración. Al administrador le llega el código para entrar.`
  await Promise.all([listado.recargar(), clientes.recargar().catch(() => undefined)])
  await router.push(ruta(id))
}
</script>

<template>
  <section aria-labelledby="titulo-clientes">
    <template v-if="clienteId">
      <RouterLink
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Clientes
      </RouterLink>
      <p
        v-if="resultado"
        class="ok"
        role="status"
      >
        {{ resultado }}
      </p>
      <FichaCliente :entidad-id="clienteId" />
    </template>
    <template v-else>
      <header class="encabezado">
        <div>
          <h1 id="titulo-clientes">
            Clientes
          </h1>
          <p class="texto-2">
            Propiedades horizontales y empresas que usan DAD, con su estado y sus módulos.
          </p>
        </div>
        <HudBoton
          v-if="puedeAlta"
          @click="abrirAlta"
        >
          <IMas aria-hidden="true" /> Dar de alta
        </HudBoton>
      </header>

      <div class="filtros">
        <HudCampo
          v-model="filtros.q"
          etiqueta="Buscar por nombre o NIT"
          tipo="search"
          autocompletar="off"
        />
        <HudSelector
          v-model="tipo"
          etiqueta="Tipo"
          :opciones="opcionesTipo"
        />
        <HudSelector
          v-model="estado"
          etiqueta="Estado"
          :opciones="opcionesEstado"
        />
      </div>

      <HudEstado
        v-if="listado.estado.value === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="listado.estado.value === 'error'"
        estado="error"
        :mensaje="listado.error.value ?? undefined"
        :referencia="listado.referencia.value"
        @reintentar="listado.recargar()"
      />
      <HudEstado
        v-else-if="filas.length === 0 && !listado.hayMas.value"
        estado="vacio"
        :mensaje="filtros.q || tipo || estado ? 'Ningún cliente coincide con la búsqueda.' : 'Aún no hay clientes.'"
      />
      <template v-else>
        <HudTabla
          :filas="filas"
          :columnas="COLUMNAS"
          clave="id"
          titulo="Clientes de la plataforma"
        >
          <template #celda-nombre="{ fila }">
            <span class="crece">
              <RouterLink :to="ruta(fila.id)"><strong>{{ fila.nombre }}</strong></RouterLink>
              <small v-if="fila.nit">NIT {{ fila.nit }}</small>
            </span>
          </template>
          <template #celda-tipo="{ fila }">
            {{ TIPO_ENTIDAD[fila.tipo] }}
          </template>
          <template #celda-estado="{ fila }">
            <HudInsignia :tono="TONO_ESTADO_ENTIDAD[fila.estado]">
              {{ ESTADO_ENTIDAD[fila.estado] }}
            </HudInsignia>
          </template>
          <template #celda-modulos="{ fila }">
            <small>{{ modulos(fila) }}</small>
          </template>
        </HudTabla>
        <HudCargarMas
          :hay-mas="listado.hayMas.value"
          :cargando="listado.cargando.value"
          @cargar="listado.cargarMas()"
        />
      </template>

      <AltaCliente
        v-if="puedeAlta"
        v-model:abierto="creando"
        :puede-p-h="puede('plataforma.copropiedades.crear')"
        :puede-empresa="puede('plataforma.entidades.crear')"
        @creada="creada"
      />
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
.crece a {
  color: var(--texto);
}
</style>
