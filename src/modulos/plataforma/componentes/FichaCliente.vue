<script setup lang="ts">
/**
 * Ficha de un cliente en la consola: estado (con su ciclo), módulos, usuarios y roles, acceso de
 * soporte, publicidad y pantalla del lobby y, en una empresa, designarla como la de la
 * plataforma. Cada parte aparece solo con su permiso de plataforma.
 */
import { computed, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { EstadoEntidad, Modulo } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { ESTADO_ENTIDAD, TIPO_ENTIDAD } from '@/formato/textos-entidad'
import { cambiarEstado, designarPropia, entidadPlataforma } from '../api-clientes'
import { ACCION_ESTADO, estadosSiguientes, TONO_ESTADO_ENTIDAD } from '../reglas'
import { useClientes, usePermisosPlataforma } from '../store'
import AccesoSoporte from './AccesoSoporte.vue'
import ModulosCliente from './ModulosCliente.vue'
import PublicidadCliente from './PublicidadCliente.vue'
import UsuariosCliente from './UsuariosCliente.vue'

const props = defineProps<{ entidadId: string }>()

const clientes = useClientes()
const { puede } = usePermisosPlataforma()

const estado = ref<'cargando' | 'listo' | 'vacio' | 'error'>('cargando')
const error = ref<string | null>(null)
const nuevoEstado = ref<EstadoEntidad | null>(null)
const confirmandoPropia = ref(false)
const resultado = ref<string | null>(null)

const cliente = computed(() => clientes.porId(props.entidadId))
/** El estado lo cambia quien puede dar de alta ese tipo de cliente. */
const puedeEstado = computed(() =>
  cliente.value?.tipo === 'propiedad_horizontal' ? puede('plataforma.copropiedades.crear') : puede('plataforma.entidades.crear'),
)
const siguientes = computed(() => (cliente.value && puedeEstado.value ? estadosSiguientes(cliente.value.estado) : []))
const dialogoEstado = computed({
  get: () => nuevoEstado.value !== null,
  set: (v) => {
    if (!v) nuevoEstado.value = null
  },
})

const cambio = useAccion((_clave, e: EstadoEntidad) => cambiarEstado(props.entidadId, e), {
  alExito: (e) => {
    if (cliente.value) clientes.actualizar({ ...cliente.value, estado: e })
    nuevoEstado.value = null
    resultado.value = `La entidad quedó ${ESTADO_ENTIDAD[e].toLowerCase()}.`
  },
})
const propia = useAccion(() => designarPropia(props.entidadId), {
  alExito: () => {
    confirmandoPropia.value = false
    resultado.value = 'Quedó designada como la entidad que opera la plataforma.'
  },
})

async function cargar() {
  estado.value = 'cargando'
  try {
    const e = await entidadPlataforma(props.entidadId)
    if (e) clientes.actualizar(e)
    estado.value = e ? 'listo' : 'vacio'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

function pedirEstado(e: EstadoEntidad) {
  cambio.reiniciar()
  resultado.value = null
  nuevoEstado.value = e
}

function pedirPropia() {
  propia.reiniciar()
  confirmandoPropia.value = true
}

function modulos(m: Modulo[]) {
  if (cliente.value) clientes.actualizar({ ...cliente.value, modulos: m })
}

watch(() => props.entidadId, cargar, { immediate: true })
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
    @reintentar="cargar()"
  />
  <HudEstado
    v-else-if="estado === 'vacio'"
    estado="vacio"
    mensaje="Ese cliente no existe. Vuelva a la lista y elíjalo de nuevo."
  />
  <template v-else-if="cliente">
    <header class="encabezado">
      <div>
        <h1 id="titulo-clientes">
          {{ cliente.nombre }}
        </h1>
        <p class="texto-2">
          {{ TIPO_ENTIDAD[cliente.tipo] }}<template v-if="cliente.nit">
            · NIT {{ cliente.nit }}
          </template>
        </p>
      </div>
      <HudInsignia :tono="TONO_ESTADO_ENTIDAD[cliente.estado]">
        {{ ESTADO_ENTIDAD[cliente.estado] }}
      </HudInsignia>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

    <HudPanel
      v-if="siguientes.length"
      etiqueta="Estado"
    >
      <div class="botones">
        <HudBoton
          v-for="e in siguientes"
          :key="e"
          :variante="e === 'activa' ? 'primario' : 'secundario'"
          @click="pedirEstado(e)"
        >
          {{ ACCION_ESTADO[e] }}
        </HudBoton>
      </div>
    </HudPanel>

    <HudPanel
      v-if="cliente.tipo !== 'plataforma'"
      etiqueta="Módulos contratados"
    >
      <ModulosCliente
        :cliente="cliente"
        :puede-gestionar="puede('plataforma.modulos.gestionar')"
        @cambio="modulos"
      />
    </HudPanel>

    <HudPanel
      v-if="puede('plataforma.entidades.usuarios')"
      etiqueta="Usuarios y roles"
    >
      <UsuariosCliente :entidad-id="cliente.id" />
    </HudPanel>

    <HudPanel
      v-if="puede('plataforma.soporte.ver') && cliente.tipo !== 'plataforma'"
      etiqueta="Soporte"
    >
      <AccesoSoporte :cliente="cliente" />
    </HudPanel>

    <HudPanel
      v-if="cliente.tipo !== 'plataforma' && (puede('plataforma.publicidad.gestionar') || puede('plataforma.modulos.gestionar'))"
      etiqueta="Publicidad"
    >
      <PublicidadCliente
        :cliente="cliente"
        :puede-excluir="puede('plataforma.publicidad.gestionar')"
        :puede-pantalla="puede('plataforma.modulos.gestionar')"
      />
    </HudPanel>

    <HudPanel
      v-if="cliente.tipo === 'empresa' && puede('plataforma.entidad_propia.designar')"
      etiqueta="Entidad de la plataforma"
    >
      <p class="texto-2">
        La empresa que opera la plataforma factura los cobros y recibe a quien tiene roles de plataforma.
      </p>
      <div>
        <HudBoton
          variante="secundario"
          @click="pedirPropia"
        >
          Designar como entidad de la plataforma
        </HudBoton>
      </div>
    </HudPanel>

    <HudDialogo
      v-model:abierto="dialogoEstado"
      :titulo="nuevoEstado ? `${ACCION_ESTADO[nuevoEstado]} ${cliente.nombre}` : 'Cambiar estado'"
    >
      <p
        v-if="nuevoEstado === 'suspendida'"
        class="aviso"
      >
        Sus usuarios solo podrán consultar; la portería y la atención a titulares siguen funcionando.
      </p>
      <p
        v-else-if="nuevoEstado === 'retirada'"
        class="aviso"
      >
        Retirar es definitivo: la entidad deja de operar en DAD.
      </p>
      <p v-else>
        La entidad podrá operar con sus módulos contratados.
      </p>
      <p
        v-if="cambio.error.value"
        class="error"
        role="alert"
      >
        {{ cambio.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="nuevoEstado = null"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="cambio.cargando.value"
          @click="nuevoEstado && cambio.ejecutar(nuevoEstado)"
        >
          {{ nuevoEstado ? ACCION_ESTADO[nuevoEstado] : 'Confirmar' }}
        </HudBoton>
      </template>
    </HudDialogo>
    <HudDialogo
      v-model:abierto="confirmandoPropia"
      titulo="Designar la entidad de la plataforma"
    >
      <p>{{ cliente.nombre }} pasará a ser la empresa que opera la plataforma.</p>
      <p
        v-if="propia.error.value"
        class="error"
        role="alert"
      >
        {{ propia.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="confirmandoPropia = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="propia.cargando.value"
          @click="propia.ejecutar()"
        >
          Designar
        </HudBoton>
      </template>
    </HudDialogo>
  </template>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
