<script setup lang="ts">
/** Vehículos (de un bien o de toda la PH): buscar por placa, registrar y retirar (`censo.editar`). */
import { computed, onMounted, ref, watch } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { TipoVehiculo, Vehiculo } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import SelectorBien from '@/hud/componentes/SelectorBien.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import { registrarVehiculo, retirarVehiculo, vehiculos } from '../api'
import { normalizarPlaca, TIPO_VEHICULO } from '../censo'

const props = defineProps<{ bienId?: string }>()

const entidad = useEntidad()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const editable = computed(() => entidad.tienePermiso('censo.editar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<Vehiculo[]>([])
const placaBuscada = ref('')
const resultado = ref<string | null>(null)

const visibles = computed(() => {
  const p = normalizarPlaca(placaBuscada.value)
  return p ? lista.value.filter((v) => (v.placa ?? '').includes(p)) : lista.value
})
const columnas = computed(() => [
  { clave: 'placa', titulo: 'Vehículo' },
  ...(props.bienId ? [] : [{ clave: 'bien', titulo: 'Bien' }]),
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
])
const opcionesTipo = (Object.keys(TIPO_VEHICULO) as TipoVehiculo[]).map((valor) => ({ valor, etiqueta: TIPO_VEHICULO[valor] }))
const buscarBien = async (q: string) => (await bienes.buscar(q)).datos

// Registrar
const registrando = ref(false)
const bienElegido = ref('')
const tipo = ref<TipoVehiculo>('carro')
const placa = ref('')
const marca = ref('')
const color = ref('')
const intentado = ref(false)
const errorPlaca = ref<string | null>(null)
const errorForm = computed(() => (intentado.value && !props.bienId && !bienElegido.value ? 'Elija el bien.' : null))
const registrar = useAccion((clave) =>
  registrarVehiculo(
    id.value,
    {
      bien_privado_id: props.bienId ?? bienElegido.value,
      tipo: tipo.value,
      placa: placa.value ? normalizarPlaca(placa.value) : null,
      marca: marca.value.trim() || null,
      color: color.value.trim() || null,
    },
    clave,
  ),
)

function abrirRegistro() {
  bienElegido.value = placa.value = marca.value = color.value = ''
  tipo.value = 'carro'
  intentado.value = false
  errorPlaca.value = null
  registrar.reiniciar()
  registrando.value = true
}

async function enviar() {
  intentado.value = true
  errorPlaca.value = tipo.value !== 'bicicleta' && !placa.value.trim() ? 'Escriba la placa.' : null
  if (errorForm.value || errorPlaca.value) return
  const r = await registrar.ejecutar()
  if (!r.ok) {
    // Placa repetida: el mensaje va en el campo.
    if (registrar.codigo.value === 'conflicto') errorPlaca.value = registrar.error.value
    return
  }
  registrando.value = false
  lista.value = [...lista.value, r.valor]
  resultado.value = `Vehículo ${r.valor.placa ?? ''} registrado.`
}

// Retirar
const elegido = ref<Vehiculo | null>(null)
const retirando = ref(false)
const retirar = useAccion(() => retirarVehiculo(id.value, elegido.value?.id ?? ''))

function abrirRetirar(v: Vehiculo) {
  elegido.value = v
  retirar.reiniciar()
  retirando.value = true
}

async function confirmarRetiro() {
  const v = elegido.value
  if (!v || !(await retirar.ejecutar()).ok) return
  retirando.value = false
  lista.value = lista.value.filter((x) => x.id !== v.id)
  resultado.value = `Vehículo ${v.placa ?? ''} retirado: su placa queda libre.`
}

watch(lista, (l) => {
  if (!props.bienId) bienes.resolver(l.map((v) => v.bien_privado_id))
})

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = await vehiculos(id.value, { bienId: props.bienId })
    estado.value = 'listo'
  } catch (e) {
    error.value = e instanceof ErrorApi ? mensajeDeError(e) : 'No se pudieron cargar los vehículos.'
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <div class="panel-censo">
    <div class="barra">
      <HudCampo
        v-if="!bienId"
        v-model="placaBuscada"
        etiqueta="Buscar placa"
        tipo="search"
        autocompletar="off"
      />
      <HudBoton
        v-if="editable"
        variante="secundario"
        @click="abrirRegistro"
      >
        <IMas aria-hidden="true" /> Registrar vehículo
      </HudBoton>
    </div>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
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
      v-else-if="visibles.length === 0"
      estado="vacio"
      :mensaje="placaBuscada ? 'Ningún vehículo con esa placa.' : 'No hay vehículos registrados.'"
    />
    <HudTabla
      v-else
      :filas="visibles"
      :columnas="columnas"
      clave="id"
      titulo="Vehículos"
    >
      <template #celda-placa="{ fila }">
        <span class="celda">
          <strong>{{ fila.placa ?? 'Sin placa' }}</strong>
          <small>{{ TIPO_VEHICULO[fila.tipo] }}{{ fila.marca ? ` · ${fila.marca}` : '' }}{{ fila.color ? ` · ${fila.color}` : '' }}</small>
        </span>
      </template>
      <template #celda-bien="{ fila }">
        {{ bienes.codigo(fila.bien_privado_id) }}
      </template>
      <template #celda-acciones="{ fila }">
        <HudBoton
          v-if="editable"
          variante="fantasma"
          @click="abrirRetirar(fila)"
        >
          Retirar<span class="solo-lector"> el vehículo {{ fila.placa }}</span>
        </HudBoton>
      </template>
    </HudTabla>

    <HudDialogo
      v-model:abierto="registrando"
      titulo="Registrar vehículo"
    >
      <div class="campos">
        <SelectorBien
          v-if="!bienId"
          v-model="bienElegido"
          :buscar="buscarBien"
          :codigo-elegido="bienElegido ? bienes.codigo(bienElegido) : null"
          :error="errorForm"
        />
        <form
          id="formulario-vehiculo"
          class="campos"
          novalidate
          @submit.prevent="enviar"
        >
          <HudSelector
            v-model="tipo"
            etiqueta="Tipo"
            :opciones="opcionesTipo"
          />
          <HudCampo
            v-model="placa"
            etiqueta="Placa"
            autocompletar="off"
            :error="errorPlaca"
            :requerido="tipo !== 'bicicleta'"
          />
          <HudCampo
            v-model="marca"
            etiqueta="Marca (opcional)"
          />
          <HudCampo
            v-model="color"
            etiqueta="Color (opcional)"
          />
          <p
            v-if="registrar.error.value && !errorPlaca"
            class="error"
            role="alert"
          >
            {{ registrar.error.value }}
          </p>
        </form>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="registrando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-vehiculo"
          :cargando="registrar.cargando.value"
        >
          Registrar
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="retirando"
      titulo="Retirar el vehículo"
    >
      <p>El vehículo {{ elegido?.placa }} dejará de figurar en el censo y su placa quedará libre.</p>
      <p
        v-if="retirar.error.value"
        class="error"
        role="alert"
      >
        {{ retirar.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="retirando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="retirar.cargando.value"
          @click="confirmarRetiro"
        >
          Retirar
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped src="./panel-censo.css"></style>
