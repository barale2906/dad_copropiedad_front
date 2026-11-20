<script setup lang="ts">
/**
 * Plantillas contables estándar (PUC, comprobantes, reglas, rubros…): crearlas en borrador,
 * editar su contenido JSON mientras son borrador y publicarlas o retirarlas.
 */
import { computed, onMounted, ref } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { EstadoPlantillaContable, PlantillaContable, PlantillaContableResumen } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { cambiarEstadoPlantilla, crearPlantillaContable, guardarContenidoPlantilla, plantillaContable, plantillasContables } from '../api-normativa'
import { ESTADO_PLANTILLA, leerContenido } from '../reglas'
import EditorTablaNormativa from './EditorTablaNormativa.vue'

const lista = ref<PlantillaContableResumen[]>([])
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)
const resultado = ref<string | null>(null)
const nueva = ref({ nombre: '', tipo: 'propiedad_horizontal', contenido: '{}' })
const abierta = ref<PlantillaContable | null>(null)
const contenido = ref('')

const propias = computed(() => lista.value.filter((p) => p.ambito === 'plataforma'))
const errorNueva = computed(() => (leerContenido(nueva.value.contenido) ? null : 'El contenido debe ser un objeto JSON válido.'))
const errorContenido = computed(() => (leerContenido(contenido.value) ? null : 'El contenido debe ser un objeto JSON válido.'))

const crear = useAccion((clave) =>
  crearPlantillaContable({ nombre: nueva.value.nombre.trim(), tipo_empresa: nueva.value.tipo.trim(), contenido: leerContenido(nueva.value.contenido) ?? {} }, clave),
)
const abrir = useAccion((_clave, id: string) => plantillaContable(id), {
  alExito: (p) => {
    abierta.value = p
    contenido.value = JSON.stringify(p.contenido, null, 2)
  },
})
const guardar = useAccion(() => guardarContenidoPlantilla(abierta.value?.id ?? '', leerContenido(contenido.value) ?? {}), {
  alExito: () => (resultado.value = 'Contenido guardado.'),
})
const cambiar = useAccion((_clave, e: EstadoPlantillaContable) => cambiarEstadoPlantilla(abierta.value?.id ?? '', e))

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = await plantillasContables()
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
    estado.value = 'error'
  }
}

async function enviar(cerrar: () => void) {
  if (!nueva.value.nombre.trim() || errorNueva.value) return
  const r = await crear.ejecutar()
  if (!r.ok) return
  resultado.value = `Plantilla «${r.valor.nombre}» creada en borrador.`
  nueva.value = { nombre: '', tipo: 'propiedad_horizontal', contenido: '{}' }
  cerrar()
  await cargar()
}

async function cambiarEstado(e: EstadoPlantillaContable) {
  if (!abierta.value || !(await cambiar.ejecutar(e)).ok) return
  abierta.value = { ...abierta.value, estado: e }
  resultado.value = e === 'publicada' ? 'Plantilla publicada: las entidades nuevas pueden usarla.' : 'Plantilla retirada.'
  await cargar()
}

onMounted(cargar)
</script>

<template>
  <HudEstado
    v-if="estado === 'cargando'"
    estado="cargando"
  />
  <HudEstado
    v-else-if="estado === 'error'"
    estado="error"
    :mensaje="error ?? undefined"
    :referencia="referencia"
    @reintentar="cargar()"
  />
  <EditorTablaNormativa
    v-else
    titulo="Plantillas contables"
    descripcion="Plantillas estándar con las que arranca la contabilidad de una entidad."
    accion="Nueva plantilla"
  >
    <template #formulario="{ cerrar }">
      <form
        class="campos"
        novalidate
        @submit.prevent="enviar(cerrar)"
      >
        <div class="filtros">
          <HudCampo
            v-model="nueva.nombre"
            etiqueta="Nombre"
          />
          <HudCampo
            v-model="nueva.tipo"
            etiqueta="Tipo de empresa"
            ayuda="Por ejemplo: propiedad_horizontal."
          />
        </div>
        <HudCampo
          v-model="nueva.contenido"
          etiqueta="Contenido (JSON)"
          multilinea
          :error="errorNueva"
        />
        <div>
          <HudBoton
            tipo="submit"
            :deshabilitado="!nueva.nombre.trim() || !!errorNueva"
            :cargando="crear.cargando.value"
          >
            Crear en borrador
          </HudBoton>
        </div>
        <p
          v-if="crear.error.value"
          class="error"
          role="alert"
        >
          {{ crear.error.value }}
        </p>
      </form>
    </template>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <HudEstado
      v-if="propias.length === 0"
      estado="vacio"
      mensaje="Aún no hay plantillas estándar."
    />
    <ul
      v-else
      class="lista"
    >
      <li
        v-for="p in propias"
        :key="p.id"
      >
        <span class="crece">
          <strong>{{ p.nombre }} · versión {{ p.version }}</strong>
          <small>{{ p.tipo_empresa }}</small>
        </span>
        <HudInsignia :tono="ESTADO_PLANTILLA[p.estado].tono">
          {{ ESTADO_PLANTILLA[p.estado].texto }}
        </HudInsignia>
        <HudBoton
          variante="fantasma"
          :cargando="abrir.cargando.value && abierta?.id !== p.id"
          @click="abrir.ejecutar(p.id)"
        >
          Abrir<span class="solo-lector"> {{ p.nombre }}</span>
        </HudBoton>
      </li>
    </ul>
    <p
      v-if="abrir.error.value"
      class="error"
      role="alert"
    >
      {{ abrir.error.value }}
    </p>

    <HudPanel
      v-if="abierta"
      :etiqueta="`${abierta.nombre} · versión ${abierta.version}`"
    >
      <div class="campos">
        <HudCampo
          v-model="contenido"
          etiqueta="Contenido (JSON)"
          multilinea
          :error="abierta.estado === 'borrador' ? errorContenido : null"
          :ayuda="abierta.estado === 'borrador' ? undefined : 'Solo una plantilla en borrador cambia su contenido.'"
        />
        <div class="botones">
          <HudBoton
            v-if="abierta.estado === 'borrador'"
            variante="secundario"
            :deshabilitado="!!errorContenido"
            :cargando="guardar.cargando.value"
            @click="guardar.ejecutar()"
          >
            Guardar contenido
          </HudBoton>
          <HudBoton
            v-if="abierta.estado !== 'publicada'"
            :cargando="cambiar.cargando.value"
            @click="cambiarEstado('publicada')"
          >
            Publicar
          </HudBoton>
          <HudBoton
            v-if="abierta.estado === 'publicada'"
            variante="fantasma"
            :cargando="cambiar.cargando.value"
            @click="cambiarEstado('retirada')"
          >
            Retirar
          </HudBoton>
        </div>
        <p
          v-for="e in [guardar.error.value, cambiar.error.value].filter((x): x is string => !!x)"
          :key="e"
          class="error"
          role="alert"
        >
          {{ e }}
        </p>
      </div>
    </HudPanel>
  </EditorTablaNormativa>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
