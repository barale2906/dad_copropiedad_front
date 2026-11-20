<script setup lang="ts">
/**
 * Formulario para crear un usuario con su rol (solo presenta y emite; el padre llama a la API).
 * El correo es obligatorio: ahí le llega el código para definir su contraseña.
 */
import { computed, ref, watch } from 'vue'
import type { NuevoUsuario, Rol } from '@/api/tipos'
import HudBoton from './HudBoton.vue'
import HudCampo from './HudCampo.vue'
import HudDialogo from './HudDialogo.vue'
import HudSelector from './HudSelector.vue'

const props = withDefaults(defineProps<{ roles: Rol[]; cargando?: boolean; error?: string | null }>(), {
  cargando: false,
  error: null,
})
const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ enviar: [datos: NuevoUsuario] }>()

const nombre = ref('')
const correo = ref('')
const rolId = ref('')
const usuario = ref('')
const telefono = ref('')
const documento = ref('')
const intentado = ref(false)

const opciones = computed(() => props.roles.map((r) => ({ valor: r.id, etiqueta: r.nombre })))
const errorRol = computed(() => (intentado.value && !rolId.value ? 'Elija el rol del usuario.' : null))
const opcional = (v: string) => v.trim() || null

watch(abierto, (si) => {
  if (!si) return
  nombre.value = correo.value = rolId.value = usuario.value = telefono.value = documento.value = ''
  intentado.value = false
})

function enviar() {
  intentado.value = true
  if (!rolId.value) return
  emit('enviar', {
    nombre: nombre.value.trim(),
    correo: correo.value.trim(),
    rol_id: rolId.value,
    usuario: opcional(usuario.value),
    telefono: opcional(telefono.value),
    documento: opcional(documento.value),
  })
}
</script>

<template>
  <HudDialogo
    v-model:abierto="abierto"
    titulo="Crear usuario"
  >
    <p class="ayuda">
      Le llegará un código al correo para definir su contraseña. Si ya trabaja en otra
      copropiedad o empresa con ese correo, se le asigna el rol a su cuenta.
    </p>
    <form
      id="formulario-usuario"
      class="campos"
      @submit.prevent="enviar"
    >
      <HudCampo
        v-model="nombre"
        etiqueta="Nombre completo"
        autocompletar="off"
        requerido
      />
      <HudCampo
        v-model="correo"
        etiqueta="Correo"
        tipo="email"
        modo-entrada="email"
        autocompletar="off"
        requerido
      />
      <HudSelector
        v-model="rolId"
        etiqueta="Rol"
        vacio="Elija un rol"
        :opciones="opciones"
        :error="errorRol"
        requerido
      />
      <details class="opcionales">
        <summary>Más datos (opcional)</summary>
        <div class="campos">
          <HudCampo
            v-model="usuario"
            etiqueta="Usuario para iniciar sesión"
            autocompletar="off"
            ayuda="Si lo deja vacío, entrará con su correo."
          />
          <HudCampo
            v-model="telefono"
            etiqueta="Teléfono"
            tipo="tel"
            autocompletar="off"
          />
          <HudCampo
            v-model="documento"
            etiqueta="Documento"
            autocompletar="off"
            ayuda="Si coincide con una persona del censo, queda vinculada."
          />
        </div>
      </details>
      <p
        v-if="error"
        class="error"
        role="alert"
      >
        {{ error }}
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
        form="formulario-usuario"
        :cargando="cargando"
      >
        Crear usuario
      </HudBoton>
    </template>
  </HudDialogo>
</template>

<style scoped>
.ayuda {
  margin: 0;
  color: var(--texto-2);
}

.campos {
  display: grid;
  gap: 14px;
}

.opcionales summary {
  min-height: 40px;
  padding: 8px 0;
  color: var(--cian);
  cursor: pointer;
}

.opcionales .campos {
  margin-top: 8px;
}

.error {
  margin: 0;
  color: var(--magenta);
}
</style>
