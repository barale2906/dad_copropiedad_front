<script setup lang="ts">
/**
 * Organizaciones desde soporte: las reclamaciones de fichas pendientes (aprobar deja a la cuenta
 * como dueña; rechazar exige motivo), corregir la ficha global y agregar miembros.
 */
import { computed, onMounted, ref } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { CuentaPlataforma, Reclamacion, RolOrganizacion, TipoOrganizacion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaHora } from '@/formato/fechas'
import { TIPO_ORGANIZACION } from '@/formato/organizaciones'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { agregarMiembro, editarOrganizacion, reclamaciones, resolverReclamacion } from '../api-normativa'
import BuscarCuentaPlataforma from '../componentes/BuscarCuentaPlataforma.vue'

const entidad = useEntidad()
const lista = ref<Reclamacion[]>([])
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)
const rechazando = ref<Reclamacion | null>(null)
const dialogoRechazo = ref(false)
const editando = ref<Reclamacion | null>(null)
const ficha = ref({ razon_social: '', correo: '', telefono: '', tipos: [] as TipoOrganizacion[] })
const miembro = ref<{ organizacion: string; cuenta: CuentaPlataforma | null; rol: RolOrganizacion }>({ organizacion: '', cuenta: null, rol: 'gestor' })
const resultado = ref<string | null>(null)

const pendientes = computed(() => lista.value.filter((r) => r.estado === 'pendiente'))
const tipos = Object.keys(TIPO_ORGANIZACION) as TipoOrganizacion[]
const ROLES = [
  { valor: 'dueno', etiqueta: 'Dueño' },
  { valor: 'gestor', etiqueta: 'Gestor' },
  { valor: 'operario', etiqueta: 'Operario' },
]
const dialogoFicha = computed({ get: () => editando.value !== null, set: (v) => (v ? undefined : (editando.value = null)) })
const dialogoMiembro = computed({ get: () => miembro.value.organizacion !== '', set: (v) => (v ? undefined : (miembro.value.organizacion = '')) })

const resolver = useAccion((_clave, id: string, aprobar: boolean, motivo: string | null) => resolverReclamacion(id, aprobar, motivo), {
  alExito: () => {
    dialogoRechazo.value = false
    void cargar()
  },
})
const guardarFicha = useAccion((_clave, id: string) =>
  editarOrganizacion(id, {
    razon_social: ficha.value.razon_social.trim() || null,
    correo_contacto: ficha.value.correo.trim() || null,
    telefono_contacto: ficha.value.telefono.trim() || null,
    tipos: ficha.value.tipos.length ? ficha.value.tipos : null,
  }),
)
const guardarMiembro = useAccion(() => agregarMiembro(miembro.value.organizacion, miembro.value.cuenta?.id ?? '', miembro.value.rol))

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = await reclamaciones()
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
    estado.value = 'error'
  }
}

async function aprobar(r: Reclamacion) {
  resultado.value = null
  if ((await resolver.ejecutar(r.id, true, null)).ok) resultado.value = 'Reclamación aprobada: la cuenta maneja la ficha.'
}

function pedirRechazo(r: Reclamacion) {
  resolver.reiniciar()
  rechazando.value = r
  dialogoRechazo.value = true
}

async function rechazar(motivo: string) {
  if (!rechazando.value) return
  if ((await resolver.ejecutar(rechazando.value.id, false, motivo)).ok) resultado.value = 'Reclamación rechazada.'
}

function abrirFicha(r: Reclamacion) {
  guardarFicha.reiniciar()
  ficha.value = { razon_social: '', correo: '', telefono: '', tipos: [] }
  editando.value = r
}

async function enviarFicha() {
  if (!editando.value) return
  if ((await guardarFicha.ejecutar(editando.value.organizacion_id)).ok) {
    editando.value = null
    resultado.value = 'Ficha de la organización corregida.'
  }
}

function abrirMiembro(r: Reclamacion) {
  guardarMiembro.reiniciar()
  miembro.value = { organizacion: r.organizacion_id, cuenta: null, rol: 'gestor' }
}

async function enviarMiembro() {
  if ((await guardarMiembro.ejecutar()).ok) {
    miembro.value.organizacion = ''
    resultado.value = 'Miembro agregado a la organización.'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-organizaciones">
    <header>
      <h1 id="titulo-organizaciones">
        Organizaciones
      </h1>
      <p class="texto-2">
        Reclamaciones de fichas de administradoras, firmas contables, vigilancia y comercios.
      </p>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-if="resolver.error.value && !dialogoRechazo"
      class="error"
      role="alert"
    >
      {{ resolver.error.value }}
    </p>

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
    <HudEstado
      v-else-if="pendientes.length === 0"
      estado="vacio"
      mensaje="No hay reclamaciones pendientes."
    />
    <ul
      v-else
      class="lista"
    >
      <li
        v-for="r in pendientes"
        :key="r.id"
      >
        <span class="crece">
          <strong>Reclamación del {{ fechaHora(r.creada_en, entidad.zonaHoraria) }}</strong>
          <span>{{ r.mensaje }}</span>
          <small>Organización {{ r.organizacion_id.slice(-6) }} · cuenta {{ r.cuenta_id.slice(-6) }}</small>
        </span>
        <div class="botones">
          <HudBoton
            :cargando="resolver.cargando.value && !dialogoRechazo"
            @click="aprobar(r)"
          >
            Aprobar
          </HudBoton>
          <HudBoton
            variante="secundario"
            @click="pedirRechazo(r)"
          >
            Rechazar
          </HudBoton>
          <HudBoton
            variante="fantasma"
            @click="abrirFicha(r)"
          >
            Corregir ficha
          </HudBoton>
          <HudBoton
            variante="fantasma"
            @click="abrirMiembro(r)"
          >
            Agregar miembro
          </HudBoton>
        </div>
      </li>
    </ul>

    <ConfirmarConMotivo
      v-model:abierto="dialogoRechazo"
      titulo="Rechazar la reclamación"
      accion="Rechazar"
      descripcion="La cuenta verá el motivo. Diga qué falta para aprobarla."
      :cargando="resolver.cargando.value"
      :error="resolver.error.value"
      @confirmar="rechazar"
    />
    <HudDialogo
      v-model:abierto="dialogoFicha"
      titulo="Corregir la ficha de la organización"
    >
      <form
        id="formulario-ficha-organizacion"
        class="campos"
        @submit.prevent="enviarFicha"
      >
        <p class="texto-2">
          Escriba solo lo que cambia; lo vacío se deja como está.
        </p>
        <HudCampo
          v-model="ficha.razon_social"
          etiqueta="Razón social"
        />
        <HudCampo
          v-model="ficha.correo"
          etiqueta="Correo de contacto"
          tipo="email"
        />
        <HudCampo
          v-model="ficha.telefono"
          etiqueta="Teléfono de contacto"
          tipo="tel"
        />
        <fieldset class="tipos">
          <legend>Tipos (vacío: no cambian)</legend>
          <label
            v-for="t in tipos"
            :key="t"
            class="casilla"
          >
            <input
              v-model="ficha.tipos"
              type="checkbox"
              :value="t"
            >
            {{ TIPO_ORGANIZACION[t] }}
          </label>
        </fieldset>
        <p
          v-if="guardarFicha.error.value"
          class="error"
          role="alert"
        >
          {{ guardarFicha.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="editando = null"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-ficha-organizacion"
          :cargando="guardarFicha.cargando.value"
        >
          Guardar ficha
        </HudBoton>
      </template>
    </HudDialogo>
    <HudDialogo
      v-model:abierto="dialogoMiembro"
      titulo="Agregar miembro"
    >
      <div class="campos">
        <BuscarCuentaPlataforma @encontrada="miembro.cuenta = $event" />
        <p
          v-if="miembro.cuenta"
          class="ok"
          role="status"
        >
          Cuenta: <strong>{{ miembro.cuenta.nombre }}</strong>
        </p>
        <HudSelector
          v-model="miembro.rol"
          etiqueta="Papel en la organización"
          :opciones="ROLES"
        />
        <p
          v-if="guardarMiembro.error.value"
          class="error"
          role="alert"
        >
          {{ guardarMiembro.error.value }}
        </p>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="miembro.organizacion = ''"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :deshabilitado="!miembro.cuenta"
          :cargando="guardarMiembro.cargando.value"
          @click="enviarMiembro"
        >
          Agregar
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
.tipos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 0 12px;
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 4px;
  color: var(--texto-2);
}
</style>
