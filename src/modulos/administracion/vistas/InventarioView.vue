<script setup lang="ts">
/** Inventario: activos con búsqueda y filtros, crear uno y su hoja de vida (`:id`). */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ClaseActivo, EstadoActivo } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import IVolver from '~icons/tabler/arrow-left'
import IMas from '~icons/tabler/plus'
import { crearActivo, listarActivos } from '../api'
import HojaDeVida from '../componentes/HojaDeVida.vue'
import { CLASE_ACTIVO, ESTADO_ACTIVO } from '../reglas'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const activoId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (a = '') => ({ name: 'modulo', params: { ...route.params, id: a } })
const rutaOrden = (o: string) => ({ name: 'modulo', params: { ...route.params, accion: 'mantenimiento', id: o } })

const q = ref('')
const clase = ref<ClaseActivo | ''>('')
const estadoFiltro = ref<EstadoActivo | ''>('')
const filtros = computed(() => ({ q: q.value, clase: clase.value || undefined, estado: estadoFiltro.value || undefined }))
const opcionesEstado = (Object.keys(ESTADO_ACTIVO) as EstadoActivo[]).map((valor) => ({ valor, etiqueta: ESTADO_ACTIVO[valor].texto }))
const listado = useListado((despues, f: { q: string; clase?: ClaseActivo; estado?: EstadoActivo }) => listarActivos(id.value, despues, f), { filtros })

// Crear
const creando = ref(false)
const codigo = ref('')
const nombre = ref('')
const claseNueva = ref<ClaseActivo>('equipo')
const marca = ref('')
const ubicacion = ref('')
const valor = ref('')
const garantia = ref('')
const errorForm = ref<string | null>(null)
const crear = useAccion((clave) =>
  crearActivo(
    id.value,
    {
      codigo: codigo.value.trim().toUpperCase(),
      nombre: nombre.value.trim(),
      clase: claseNueva.value,
      marca: marca.value.trim() || null,
      ubicacion: ubicacion.value.trim() || null,
      valor: valor.value || null,
      garantia_vence: garantia.value || null,
    },
    clave,
  ),
)

function abrir() {
  codigo.value = nombre.value = marca.value = ubicacion.value = valor.value = garantia.value = ''
  claseNueva.value = 'equipo'
  errorForm.value = null
  crear.reiniciar()
  creando.value = true
}

async function guardar() {
  errorForm.value = !codigo.value.trim() || !nombre.value.trim() ? 'Escriba el código y el nombre.' : null
  if (errorForm.value) return
  const r = await crear.ejecutar()
  if (!r.ok) return
  creando.value = false
  await router.push(ruta(r.valor.id))
  await listado.recargar()
}
</script>

<template>
  <section aria-labelledby="titulo-inventario">
    <template v-if="activoId">
      <RouterLink
        :to="ruta()"
        class="volver"
      >
        <IVolver aria-hidden="true" /> Inventario
      </RouterLink>
      <HojaDeVida
        :key="activoId"
        :entidad-id="id"
        :activo-id="activoId"
        :orden="rutaOrden"
      />
    </template>
    <template v-else>
      <header class="encabezado">
        <h1 id="titulo-inventario">
          Inventario
        </h1>
        <HudBoton
          v-if="entidad.tienePermiso('inventario.editar')"
          @click="abrir"
        >
          <IMas aria-hidden="true" /> Nuevo activo
        </HudBoton>
      </header>
      <div class="filtros">
        <HudCampo
          v-model="q"
          etiqueta="Buscar por código o nombre"
          tipo="search"
          autocompletar="off"
        />
        <HudSelector
          v-model="clase"
          etiqueta="Clase"
          vacio="Todas"
          :opciones="opcionesDe(CLASE_ACTIVO)"
        />
        <HudSelector
          v-model="estadoFiltro"
          etiqueta="Estado"
          vacio="Todos"
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
        @reintentar="listado.recargar()"
      />
      <HudEstado
        v-else-if="listado.estado.value === 'vacio'"
        estado="vacio"
        mensaje="No hay activos con esos filtros."
      />
      <template v-else>
        <ul
          class="lista"
          aria-label="Activos"
        >
          <li
            v-for="a in listado.filas.value"
            :key="a.id"
          >
            <HudInsignia :tono="ESTADO_ACTIVO[a.estado].tono">
              {{ ESTADO_ACTIVO[a.estado].texto }}
            </HudInsignia>
            <span class="crece">
              <RouterLink
                :to="ruta(a.id)"
                class="fila"
              ><strong>{{ a.nombre }}</strong></RouterLink>
              <small>{{ a.codigo }} · {{ CLASE_ACTIVO[a.clase] }}{{ a.ubicacion ? ` · ${a.ubicacion}` : '' }}</small>
            </span>
          </li>
        </ul>
        <HudCargarMas
          :hay-mas="listado.hayMas.value"
          :cargando="listado.cargando.value"
          @cargar="listado.cargarMas()"
        />
      </template>
    </template>

    <HudDialogo
      v-model:abierto="creando"
      titulo="Nuevo activo"
    >
      <form
        id="formulario-activo"
        class="campos"
        novalidate
        @submit.prevent="guardar"
      >
        <HudCampo
          v-model="codigo"
          etiqueta="Código"
          autocompletar="off"
        />
        <HudCampo
          v-model="nombre"
          etiqueta="Nombre"
          autocompletar="off"
        />
        <HudSelector
          v-model="claseNueva"
          etiqueta="Clase"
          :opciones="opcionesDe(CLASE_ACTIVO)"
        />
        <HudCampo
          v-model="marca"
          etiqueta="Marca (opcional)"
          autocompletar="off"
        />
        <HudCampo
          v-model="ubicacion"
          etiqueta="Ubicación (opcional)"
          autocompletar="off"
        />
        <HudCampoMonto
          v-model="valor"
          etiqueta="Valor (opcional)"
        />
        <HudFecha
          v-model="garantia"
          etiqueta="Garantía hasta (opcional)"
        />
        <p
          v-if="errorForm || crear.error.value"
          class="error"
          role="alert"
        >
          {{ errorForm ?? crear.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="creando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-activo"
          :cargando="crear.cargando.value"
        >
          Crear activo
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="./administracion.css"></style>
