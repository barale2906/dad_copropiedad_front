<script setup lang="ts">
/**
 * Plan de cuentas (PUC con las cuentas propias, sangrado por nivel, con búsqueda) y centros de
 * costo. Con `contabilidad.configurar` se crean y editan.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CambioCuentaContable, CentroCosto, CuentaContable, NivelCuenta, NuevaCuentaContable } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { usePestana } from '@/composables/usePestana'
import { opcionesDe } from '@/composables/textos-acceso'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import IMas from '~icons/tabler/plus'
import { crearCentro, crearCuenta, editarCentro, editarCuenta } from '../api'
import FormularioCuenta from '../componentes/FormularioCuenta.vue'
import { NIVEL_CUENTA } from '../reglas'

const PESTANAS = [
  { id: 'cuentas', texto: 'Cuentas' },
  { id: 'centros', texto: 'Centros de costo' },
] as const
const MAXIMO = 300

const entidad = useEntidad()
const plan = usePlanCuentas()
const pestana = usePestana(PESTANAS)
const id = computed(() => entidad.activa?.entidad_id ?? '')
const configura = computed(() => entidad.tienePermiso('contabilidad.configurar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const resultado = ref<string | null>(null)

// Cuentas
const buscar = ref('')
const nivel = ref<NivelCuenta | ''>('')
const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const filtradas = computed(() => {
  const t = sinTildes(buscar.value.trim())
  return plan.cuentas.filter((c) => (!nivel.value || c.nivel === nivel.value) && (!t || c.codigo.startsWith(t) || sinTildes(c.nombre).includes(t)))
})
const filas = computed(() => filtradas.value.slice(0, MAXIMO).map((c) => ({ ...c, sangria: `${(['clase', 'grupo', 'cuenta', 'subcuenta', 'auxiliar'].indexOf(c.nivel)) * 14}px` })))
const COLUMNAS = [
  { clave: 'codigo', titulo: 'Código' },
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'nivel', titulo: 'Nivel' },
  { clave: 'reglas', titulo: 'Imputación' },
  { clave: 'acciones', titulo: 'Acciones' },
]
const editandoCuenta = ref<CuentaContable | null>(null)
const nuevaCuenta = ref(false)
const abiertoCuenta = computed({
  get: () => nuevaCuenta.value || !!editandoCuenta.value,
  set: (v) => {
    if (!v) {
      nuevaCuenta.value = false
      editandoCuenta.value = null
    }
  },
})
const crear = useAccion((clave, datos: NuevaCuentaContable) => crearCuenta(id.value, datos, clave))
const editar = useAccion((_c, cuenta: string, datos: CambioCuentaContable) => editarCuenta(id.value, cuenta, datos))

const reglas = (c: CuentaContable) =>
  [c.acepta_movimiento ? 'Movimiento' : 'Solo agrupa', c.exige_tercero ? 'tercero' : '', c.exige_centro_costo ? 'centro' : ''].filter(Boolean).join(' · ')

async function alCrear(datos: NuevaCuentaContable) {
  const r = await crear.ejecutar(datos)
  if (!r.ok) return
  abiertoCuenta.value = false
  resultado.value = `Cuenta ${r.valor.codigo} creada.`
  await plan.recargar()
}

async function alEditar(datos: CambioCuentaContable) {
  if (!editandoCuenta.value) return
  const r = await editar.ejecutar(editandoCuenta.value.id, datos)
  if (!r.ok) return
  abiertoCuenta.value = false
  resultado.value = `Cuenta ${r.valor.codigo} guardada.`
  await plan.recargar()
}

// Centros de costo
const codigoCentro = ref('')
const nombreCentro = ref('')
const editandoCentro = ref<CentroCosto | null>(null)
const nombreEdicion = ref('')
const activoEdicion = ref(true)
const abiertoCentro = computed({ get: () => !!editandoCentro.value, set: (v) => !v && (editandoCentro.value = null) })
const crearC = useAccion((clave) => crearCentro(id.value, { codigo: codigoCentro.value.trim(), nombre: nombreCentro.value.trim() }, clave))
const editarC = useAccion((_c, centro: CentroCosto) =>
  editarCentro(id.value, centro.id, { codigo: centro.codigo, nombre: nombreEdicion.value.trim(), activo: activoEdicion.value }),
)

async function alCrearCentro() {
  const r = await crearC.ejecutar()
  if (!r.ok) return
  codigoCentro.value = nombreCentro.value = ''
  resultado.value = `Centro ${r.valor.codigo} creado.`
  await plan.recargar()
}

function abrirCentro(c: CentroCosto) {
  editandoCentro.value = c
  nombreEdicion.value = c.nombre
  activoEdicion.value = c.activo
}

async function alGuardarCentro() {
  if (!editandoCentro.value) return
  const r = await editarC.ejecutar(editandoCentro.value)
  if (!r.ok) return
  editandoCentro.value = null
  resultado.value = `Centro ${r.valor.codigo} guardado.`
  await plan.recargar()
}

async function cargar() {
  estado.value = 'cargando'
  try {
    await plan.asegurar()
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-puc">
    <header class="encabezado">
      <h1 id="titulo-puc">
        Plan de cuentas
      </h1>
      <HudBoton
        v-if="configura && pestana === 'cuentas'"
        @click="nuevaCuenta = true"
      >
        <IMas aria-hidden="true" /> Nueva cuenta
      </HudBoton>
    </header>
    <HudPestanas
      :pestanas="PESTANAS"
      etiqueta="Plan de cuentas"
    />
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

    <template v-else-if="pestana === 'cuentas'">
      <div class="filtros">
        <HudCampo
          v-model="buscar"
          etiqueta="Buscar cuenta"
          ayuda="Código (inicio) o parte del nombre."
        />
        <HudSelector
          v-model="nivel"
          etiqueta="Nivel"
          vacio="Todos"
          :opciones="opcionesDe(NIVEL_CUENTA)"
        />
      </div>
      <HudEstado
        v-if="!filas.length"
        estado="vacio"
        mensaje="Ninguna cuenta coincide con la búsqueda."
      />
      <template v-else>
        <HudTabla
          :filas="filas"
          :columnas="COLUMNAS"
          clave="id"
          titulo="Cuentas del plan"
        >
          <template #celda-codigo="{ fila }">
            <span
              class="codigo"
              :style="{ paddingLeft: fila.sangria }"
            >{{ fila.codigo }}</span>
          </template>
          <template #celda-nombre="{ fila }">
            <span :class="{ agrupa: !fila.acepta_movimiento }">{{ fila.nombre }}</span>
            <HudInsignia
              v-if="!fila.activa"
              tono="neutro"
            >
              Inactiva
            </HudInsignia>
          </template>
          <template #celda-nivel="{ fila }">
            {{ NIVEL_CUENTA[fila.nivel] }}
          </template>
          <template #celda-reglas="{ fila }">
            {{ reglas(fila) }}
          </template>
          <template #celda-acciones="{ fila }">
            <HudBoton
              v-if="configura"
              variante="fantasma"
              @click="editandoCuenta = fila"
            >
              Editar<span class="solo-lector"> la cuenta {{ fila.codigo }}</span>
            </HudBoton>
          </template>
        </HudTabla>
        <p
          v-if="filtradas.length > MAXIMO"
          class="texto-2"
        >
          Se muestran {{ MAXIMO }} de {{ filtradas.length }} cuentas: afine la búsqueda.
        </p>
      </template>
    </template>

    <template v-else>
      <form
        v-if="configura"
        class="filtros"
        @submit.prevent="alCrearCentro"
      >
        <HudCampo
          v-model="codigoCentro"
          etiqueta="Código del centro"
        />
        <HudCampo
          v-model="nombreCentro"
          etiqueta="Nombre del centro"
        />
        <HudBoton
          tipo="submit"
          :cargando="crearC.cargando.value"
          :deshabilitado="!codigoCentro.trim() || !nombreCentro.trim()"
        >
          Agregar centro
        </HudBoton>
      </form>
      <p
        v-if="crearC.error.value"
        class="error"
        role="alert"
      >
        {{ crearC.error.value }}
      </p>
      <HudEstado
        v-if="!plan.centros.length"
        estado="vacio"
        mensaje="Todavía no hay centros de costo."
      />
      <ul
        v-else
        class="lista"
        aria-label="Centros de costo"
      >
        <li
          v-for="c in plan.centros"
          :key="c.id"
        >
          <span class="crece">
            <strong>{{ c.codigo }} · {{ c.nombre }}</strong>
          </span>
          <HudInsignia :tono="c.activo ? 'exito' : 'neutro'">
            {{ c.activo ? 'Activo' : 'Inactivo' }}
          </HudInsignia>
          <HudBoton
            v-if="configura"
            variante="fantasma"
            @click="abrirCentro(c)"
          >
            Editar<span class="solo-lector"> el centro {{ c.codigo }}</span>
          </HudBoton>
        </li>
      </ul>
    </template>

    <HudDialogo
      v-model:abierto="abiertoCuenta"
      :titulo="editandoCuenta ? `Cuenta ${editandoCuenta.codigo}` : 'Nueva cuenta'"
    >
      <FormularioCuenta
        v-if="abiertoCuenta"
        :entidad-id="id"
        :cuenta="editandoCuenta"
        :por-codigo="plan.porCodigo"
        :cargando="crear.cargando.value || editar.cargando.value"
        :error="crear.error.value ?? editar.error.value"
        @crear="alCrear"
        @editar="alEditar"
        @cancelar="abiertoCuenta = false"
      />
    </HudDialogo>
    <HudDialogo
      v-model:abierto="abiertoCentro"
      :titulo="`Centro ${editandoCentro?.codigo ?? ''}`"
    >
      <div class="campos">
        <HudCampo
          v-model="nombreEdicion"
          etiqueta="Nombre"
        />
        <label class="casilla">
          <input
            v-model="activoEdicion"
            type="checkbox"
          > Activo
        </label>
        <p
          v-if="editarC.error.value"
          class="error"
          role="alert"
        >
          {{ editarC.error.value }}
        </p>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="editandoCentro = null"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="editarC.cargando.value"
          @click="alGuardarCentro"
        >
          Guardar el centro
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="./contabilidad.css"></style>
<style scoped>
.codigo {
  font-family: var(--fuente-mono);
}

.agrupa {
  font-weight: 600;
}
</style>
