<script setup lang="ts">
/**
 * Formulario para crear un rol propio (solo presenta y emite; el padre llama a la API). Puede
 * partir de los permisos de otro rol; se omiten los que la cuenta no puede otorgar.
 */
import { computed, ref, watch } from 'vue'
import type { NuevoRol, Permiso, Rol } from '@/api/tipos'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { CODIGO_ROL, noOtorgables, sugerirCodigo } from '../permisos'

const props = withDefaults(
  defineProps<{
    roles: Rol[]
    puedeOtorgar: (p: Permiso) => boolean
    /** Rol del que se parte al abrir (p. ej. «Crear a partir de este»). */
    base?: string
    cargando?: boolean
    error?: string | null
  }>(),
  { base: '', cargando: false, error: null },
)
const abierto = defineModel<boolean>('abierto', { required: true })
const emit = defineEmits<{ enviar: [datos: NuevoRol] }>()

const nombre = ref('')
const codigo = ref('')
const descripcion = ref('')
const baseId = ref('')
const codigoEditado = ref(false)
const intentado = ref(false)

const opciones = computed(() => props.roles.map((r) => ({ valor: r.id, etiqueta: r.nombre })))
const permisosBase = computed(() => props.roles.find((r) => r.id === baseId.value)?.permisos ?? [])
const omitidos = computed(() => noOtorgables(permisosBase.value, props.puedeOtorgar).length)
const errorCodigo = computed(() =>
  intentado.value && !CODIGO_ROL.test(codigo.value)
    ? 'Use de 2 a 60 letras minúsculas sin tilde, números o guion bajo (_).'
    : null,
)

watch(abierto, (si) => {
  if (!si) return
  nombre.value = codigo.value = descripcion.value = ''
  baseId.value = props.base
  codigoEditado.value = intentado.value = false
})

watch(nombre, (n) => {
  if (!codigoEditado.value) codigo.value = sugerirCodigo(n)
})

// El código sigue al nombre hasta que la persona lo cambia a mano.
watch(codigo, (c) => {
  codigoEditado.value = c !== sugerirCodigo(nombre.value)
})

function enviar() {
  intentado.value = true
  if (!CODIGO_ROL.test(codigo.value)) return
  emit('enviar', {
    nombre: nombre.value.trim(),
    codigo: codigo.value,
    descripcion: descripcion.value.trim() || null,
    permisos: permisosBase.value.filter((p) => props.puedeOtorgar(p)),
  })
}
</script>

<template>
  <HudDialogo
    v-model:abierto="abierto"
    titulo="Crear rol"
  >
    <p class="ayuda">
      Después de crearlo podrá ajustar sus permisos uno a uno.
    </p>
    <form
      id="formulario-rol"
      class="campos"
      @submit.prevent="enviar"
    >
      <HudCampo
        v-model="nombre"
        etiqueta="Nombre del rol"
        autocompletar="off"
        :maximo="120"
        requerido
      />
      <HudCampo
        v-model="codigo"
        etiqueta="Código"
        autocompletar="off"
        :maximo="60"
        :error="errorCodigo"
        ayuda="Identificador interno; no se puede cambiar después."
        requerido
      />
      <HudCampo
        v-model="descripcion"
        etiqueta="Descripción (opcional)"
        multilinea
      />
      <HudSelector
        v-model="baseId"
        etiqueta="Partir de los permisos de"
        vacio="Ninguno (sin permisos)"
        :opciones="opciones"
      />
      <p
        v-if="omitidos > 0"
        class="aviso"
      >
        Se omitirán {{ omitidos }} permisos de ese rol que usted no tiene.
      </p>
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
        form="formulario-rol"
        :cargando="cargando"
      >
        Crear rol
      </HudBoton>
    </template>
  </HudDialogo>
</template>

<style scoped>
.ayuda,
.aviso,
.error {
  margin: 0;
}

.ayuda {
  color: var(--texto-2);
}

.aviso {
  color: var(--ambar);
}

.error {
  color: var(--magenta);
}

.campos {
  display: grid;
  gap: 14px;
}
</style>
