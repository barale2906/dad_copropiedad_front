<script setup lang="ts">
/**
 * Organizaciones y contratos de servicio de la PH (administradora, contable, vigilancia…):
 * vincular una organización, asignar roles derivados a su personal (vencen con el contrato) y
 * terminar el contrato.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { ContratoServicio, CuentaEncontrada, Rol } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda } from '@/formato/decimales'
import { fecha } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import { listarRoles } from '../api'
import { asignarPorContrato, contratos, terminarContrato } from '../api-organizaciones'
import BuscarCuenta from '../componentes/BuscarCuenta.vue'
import VincularOrganizacion from '../componentes/VincularOrganizacion.vue'
import { TIPO_ORGANIZACION } from '../organizaciones'
import { useOrganizacionesConocidas } from '../store'

const entidad = useEntidad()
const conocidas = useOrganizacionesConocidas()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const puedeVincular = computed(() => entidad.tienePermiso('organizaciones.vincular'))
const puedeTerminar = computed(() => entidad.tienePermiso('contratos.gestionar'))
const puedeAsignar = computed(() => entidad.tienePermiso('roles.asignar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<ContratoServicio[]>([])
const roles = ref<Rol[]>([])
const resultado = ref<string | null>(null)
const vinculando = ref(false)

const ordenados = computed(() =>
  [...lista.value].sort((a, b) => Number(a.estado !== 'vigente') - Number(b.estado !== 'vigente') || b.vigente_desde.localeCompare(a.vigente_desde)),
)
const organizacion = (c: ContratoServicio) => conocidas.nombre(c.organizacion_id) ?? 'Organización vinculada'

const COLUMNAS = [
  { clave: 'organizacion', titulo: 'Organización' },
  { clave: 'vigencia', titulo: 'Vigencia' },
  { clave: 'valor', titulo: 'Valor', alinear: 'fin' as const },
  { clave: 'estado', titulo: 'Estado' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
]

function vinculado(c: ContratoServicio) {
  vinculando.value = false
  lista.value = [c, ...lista.value]
  resultado.value = `Se vinculó ${organizacion(c)} como ${TIPO_ORGANIZACION[c.tipo_servicio].toLowerCase()}.`
}

// Asignar personal
const elegido = ref<ContratoServicio | null>(null)
const asignando = ref(false)
const cuenta = ref<CuentaEncontrada | null>(null)
const rolId = ref('')
const opcionesRol = computed(() => roles.value.map((r) => ({ valor: r.id, etiqueta: r.nombre })))
const asignar = useAccion((clave) =>
  asignarPorContrato(id.value, elegido.value?.id ?? '', { cuenta_id: cuenta.value?.id ?? '', rol_id: rolId.value }, clave),
)

function abrirAsignar(c: ContratoServicio) {
  elegido.value = c
  cuenta.value = null
  rolId.value = ''
  asignar.reiniciar()
  asignando.value = true
}

async function enviarAsignar() {
  if (!cuenta.value || !rolId.value) return
  if (!(await asignar.ejecutar()).ok) return
  asignando.value = false
  resultado.value = `${cuenta.value.nombre} recibió el rol; vence con el contrato.`
}

// Terminar
const terminando = ref(false)
const terminar = useAccion(() => terminarContrato(id.value, elegido.value?.id ?? ''))

function abrirTerminar(c: ContratoServicio) {
  elegido.value = c
  terminar.reiniciar()
  terminando.value = true
}

async function confirmarTerminar() {
  const r = await terminar.ejecutar()
  if (!r.ok) return
  terminando.value = false
  resultado.value = `Contrato terminado. ${r.valor === 1 ? 'Venció 1 rol' : `Vencieron ${r.valor} roles`} del personal.`
  await cargar()
}

async function cargar() {
  estado.value = 'cargando'
  try {
    const [c, r] = await Promise.all([contratos(id.value), puedeAsignar.value ? listarRoles(id.value) : Promise.resolve([])])
    lista.value = c
    roles.value = r
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
    class="organizaciones"
    aria-labelledby="titulo-organizaciones"
  >
    <header class="encabezado">
      <div>
        <h1 id="titulo-organizaciones">
          Organizaciones y contratos
        </h1>
        <p class="texto-2">
          Administradora, firma contable, vigilancia… Su personal recibe roles que vencen con el contrato.
        </p>
      </div>
      <HudBoton
        v-if="puedeVincular"
        @click="vinculando = true"
      >
        <IMas aria-hidden="true" /> Vincular organización
      </HudBoton>
    </header>

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
      v-else-if="lista.length === 0"
      estado="vacio"
      mensaje="Aún no hay organizaciones vinculadas."
    />
    <HudTabla
      v-else
      :filas="ordenados"
      :columnas="COLUMNAS"
      clave="id"
      titulo="Contratos de servicio"
    >
      <template #celda-organizacion="{ fila }">
        <span class="celda">
          <strong>{{ organizacion(fila) }}</strong>
          <small>{{ TIPO_ORGANIZACION[fila.tipo_servicio] }}</small>
        </span>
      </template>
      <template #celda-vigencia="{ fila }">
        {{ fecha(fila.vigente_desde, entidad.zonaHoraria) }}{{ fila.vigente_hasta ? ` – ${fecha(fila.vigente_hasta, entidad.zonaHoraria)}` : ' en adelante' }}
      </template>
      <template #celda-valor="{ fila }">
        {{ fila.valor ? moneda(fila.valor) : '—' }}
      </template>
      <template #celda-estado="{ fila }">
        <HudInsignia :tono="fila.estado === 'vigente' ? 'exito' : 'neutro'">
          {{ fila.estado === 'vigente' ? 'Vigente' : 'Terminado' }}
        </HudInsignia>
      </template>
      <template #celda-acciones="{ fila }">
        <span
          v-if="fila.estado === 'vigente'"
          class="acciones"
        >
          <HudBoton
            v-if="puedeAsignar"
            variante="fantasma"
            @click="abrirAsignar(fila)"
          >
            Asignar personal<span class="solo-lector"> de {{ organizacion(fila) }}</span>
          </HudBoton>
          <HudBoton
            v-if="puedeTerminar"
            variante="fantasma"
            @click="abrirTerminar(fila)"
          >
            Terminar<span class="solo-lector"> el contrato con {{ organizacion(fila) }}</span>
          </HudBoton>
        </span>
      </template>
    </HudTabla>

    <HudDialogo
      v-model:abierto="vinculando"
      titulo="Vincular organización"
    >
      <VincularOrganizacion
        v-if="vinculando"
        :copropiedad-id="id"
        @vinculado="vinculado"
        @cancelar="vinculando = false"
      />
    </HudDialogo>

    <HudDialogo
      v-model:abierto="asignando"
      titulo="Asignar rol al personal"
    >
      <div class="campos">
        <p class="texto-2">
          El rol queda ligado al contrato con {{ elegido ? organizacion(elegido) : '' }} y vence con él.
        </p>
        <BuscarCuenta
          :entidad-id="id"
          @encontrada="cuenta = $event"
        />
        <form
          id="formulario-asignar"
          class="campos"
          @submit.prevent="enviarAsignar"
        >
          <HudSelector
            v-model="rolId"
            etiqueta="Rol"
            vacio="Elija un rol"
            :opciones="opcionesRol"
            requerido
          />
          <p
            v-if="asignar.error.value"
            class="error"
            role="alert"
          >
            {{ asignar.error.value }}
          </p>
        </form>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="asignando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-asignar"
          :deshabilitado="!cuenta || !rolId"
          :cargando="asignar.cargando.value"
        >
          Asignar
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="terminando"
      titulo="Terminar el contrato"
    >
      <p>
        Al terminar el contrato con <strong>{{ elegido ? organizacion(elegido) : '' }}</strong> vencen
        todos los roles que su personal recibió por él. Esta acción no se puede deshacer.
      </p>
      <p
        v-if="terminar.error.value"
        class="error"
        role="alert"
      >
        {{ terminar.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="terminando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="terminar.cargando.value"
          @click="confirmarTerminar"
        >
          Terminar contrato
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped>
.organizaciones {
  display: grid;
  gap: 16px;
}

.encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

h1 {
  font-size: clamp(26px, 3.5vw, 34px);
}

.texto-2 {
  margin: 4px 0 0;
  color: var(--texto-2);
}

.celda {
  display: grid;
  text-align: left;
}

small {
  color: var(--texto-3);
}

.acciones {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}

.campos {
  display: grid;
  gap: 14px;
}

.ok {
  margin: 0;
  padding: 10px 14px;
  border-left: 3px solid var(--verde);
  background: color-mix(in srgb, var(--verde) 10%, transparent);
}

.error {
  margin: 0;
  color: var(--magenta);
}
</style>
