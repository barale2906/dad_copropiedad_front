<script setup lang="ts">
/**
 * Asistente de alta de un cliente: datos (PH o empresa, nombre, NIT) → administrador (nuevo, con
 * su correo, o una cuenta existente; **nunca los dos**) → confirmar. Llama a la API del alta.
 */
import { computed, ref, watch } from 'vue'
import type { CuentaPlataforma } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudPasos from '@/hud/componentes/HudPasos.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { altaCopropiedad, altaEmpresa } from '../api-clientes'
import { cuerpoAlta, erroresAlta, type FormularioAlta } from '../reglas'
import BuscarCuentaPlataforma from './BuscarCuentaPlataforma.vue'

const props = defineProps<{ puedePH: boolean; puedeEmpresa: boolean }>()
const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ creada: [id: string, nombre: string] }>()

const PASOS = [
  { id: 'datos', texto: 'Datos' },
  { id: 'administrador', texto: 'Administrador' },
  { id: 'confirmar', texto: 'Confirmar' },
]
const vacio = (): FormularioAlta => ({
  tipo: props.puedePH ? 'propiedad_horizontal' : 'empresa',
  nombre: '',
  nit: '',
  administrador: 'nuevo',
  nuevo: { nombre: '', correo: '', usuario: '' },
  cuentaId: '',
})
const f = ref<FormularioAlta>(vacio())
const paso = ref('datos')
const intentado = ref(false)
const cuenta = ref<CuentaPlataforma | null>(null)

const tipos = computed(() => [
  ...(props.puedePH ? [{ valor: 'propiedad_horizontal', etiqueta: 'Propiedad horizontal' }] : []),
  ...(props.puedeEmpresa ? [{ valor: 'empresa', etiqueta: 'Empresa' }] : []),
])
const errores = computed(() => (intentado.value ? erroresAlta(f.value) : {}))
const errorDatos = computed(() => !!(erroresAlta(f.value).nombre || erroresAlta(f.value).nit))

const alta = useAccion((clave) => {
  const cuerpo = cuerpoAlta(f.value)
  return f.value.tipo === 'propiedad_horizontal' ? altaCopropiedad(cuerpo, clave) : altaEmpresa(cuerpo, clave)
})

watch(abierto, (si) => {
  if (!si) return
  f.value = vacio()
  paso.value = 'datos'
  intentado.value = false
  cuenta.value = null
  alta.reiniciar()
})

function siguiente() {
  intentado.value = true
  if (paso.value === 'datos') {
    if (errorDatos.value) return
    intentado.value = false
    paso.value = 'administrador'
  } else if (paso.value === 'administrador') {
    if (Object.keys(erroresAlta(f.value)).length) return
    paso.value = 'confirmar'
  }
}

function elegirCuenta(c: CuentaPlataforma) {
  cuenta.value = c
  f.value.cuentaId = c.id
}

async function crear() {
  const r = await alta.ejecutar()
  if (!r.ok) return
  abierto.value = false
  emit('creada', r.valor.id, r.valor.nombre)
}
</script>

<template>
  <HudDialogo
    v-model:abierto="abierto"
    titulo="Dar de alta un cliente"
  >
    <HudPasos
      :pasos="PASOS"
      :actual="paso"
      etiqueta="Pasos del alta"
      @ir="paso = $event"
    />
    <form
      id="formulario-alta"
      class="campos"
      novalidate
      @submit.prevent="paso === 'confirmar' ? crear() : siguiente()"
    >
      <template v-if="paso === 'datos'">
        <HudSelector
          v-model="f.tipo"
          etiqueta="Tipo de cliente"
          :opciones="tipos"
        />
        <HudCampo
          v-model="f.nombre"
          etiqueta="Nombre"
          :error="errores.nombre"
        />
        <HudCampo
          v-model="f.nit"
          etiqueta="NIT (opcional)"
          modo-entrada="numeric"
          :error="errores.nit"
          ayuda="Se valida con el dígito de verificación de la DIAN."
        />
      </template>

      <template v-else-if="paso === 'administrador'">
        <fieldset class="opciones">
          <legend>Primer administrador</legend>
          <label class="casilla">
            <input
              v-model="f.administrador"
              type="radio"
              value="nuevo"
            >
            Crear su cuenta (le llega un código para definir la contraseña)
          </label>
          <label class="casilla">
            <input
              v-model="f.administrador"
              type="radio"
              value="existente"
            >
            Ya tiene cuenta en DAD
          </label>
        </fieldset>
        <template v-if="f.administrador === 'nuevo'">
          <HudCampo
            v-model="f.nuevo.nombre"
            etiqueta="Nombre del administrador"
            :error="errores.adminNombre"
          />
          <HudCampo
            v-model="f.nuevo.correo"
            etiqueta="Correo del administrador"
            tipo="email"
            modo-entrada="email"
            :error="errores.adminCorreo"
          />
          <HudCampo
            v-model="f.nuevo.usuario"
            etiqueta="Usuario (opcional)"
            autocompletar="off"
            :error="errores.adminUsuario"
          />
        </template>
        <template v-else>
          <BuscarCuentaPlataforma @encontrada="elegirCuenta" />
          <p
            v-if="cuenta"
            class="ok"
            role="status"
          >
            Administrador: <strong>{{ cuenta.nombre }}</strong> ({{ cuenta.correo ?? cuenta.usuario }})
          </p>
          <p
            v-else-if="errores.cuenta"
            class="error"
          >
            {{ errores.cuenta }}
          </p>
        </template>
      </template>

      <dl
        v-else
        class="datos"
      >
        <div>
          <dt>Cliente</dt>
          <dd>{{ f.nombre }} · {{ f.tipo === 'propiedad_horizontal' ? 'Propiedad horizontal' : 'Empresa' }}</dd>
        </div>
        <div>
          <dt>NIT</dt>
          <dd>{{ f.nit || 'Sin NIT' }}</dd>
        </div>
        <div>
          <dt>Administrador</dt>
          <dd v-if="f.administrador === 'nuevo'">
            {{ f.nuevo.nombre }} ({{ f.nuevo.correo }}) · cuenta nueva
          </dd>
          <dd v-else>
            {{ cuenta?.nombre }} · cuenta existente
          </dd>
        </div>
      </dl>
      <p
        v-if="alta.error.value"
        class="error"
        role="alert"
      >
        {{ alta.error.value }}
      </p>
    </form>
    <template #acciones>
      <HudBoton
        variante="fantasma"
        @click="abierto = false"
      >
        Cancelar
      </HudBoton>
      <HudBoton
        tipo="submit"
        form="formulario-alta"
        :cargando="alta.cargando.value"
      >
        {{ paso === 'confirmar' ? 'Dar de alta' : 'Siguiente' }}
      </HudBoton>
    </template>
  </HudDialogo>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>

<style scoped>
form {
  margin-top: 14px;
}

.opciones {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 4px;
  font-weight: 600;
}
</style>
