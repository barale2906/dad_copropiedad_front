<script setup lang="ts">
/**
 * Busca una cuenta de DAD por usuario o correo **exactos** (`GET /plataforma/cuentas`) y emite
 * la encontrada con su estado. La consola la usa para el administrador de un alta, los usuarios
 * de la plataforma, las asignaciones y los miembros de una organización.
 */
import { ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CuentaPlataforma } from '@/api/tipos'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import IBuscar from '~icons/tabler/search'
import { buscarCuenta } from '../api-clientes'

withDefaults(defineProps<{ etiqueta?: string }>(), { etiqueta: 'Usuario o correo de la cuenta' })
const emit = defineEmits<{ encontrada: [cuenta: CuentaPlataforma] }>()

const identificador = ref('')
const buscando = ref(false)
const mensaje = ref<string | null>(null)

async function buscar() {
  if (!identificador.value.trim()) {
    mensaje.value = 'Escriba el usuario o el correo completos.'
    return
  }
  buscando.value = true
  mensaje.value = null
  try {
    const c = await buscarCuenta(identificador.value)
    if (c) emit('encontrada', c)
    else mensaje.value = 'No hay una cuenta con ese usuario o correo. Revise que esté escrito completo.'
  } catch (e) {
    mensaje.value = mensajeDeError(e)
  } finally {
    buscando.value = false
  }
}
</script>

<template>
  <form
    class="buscar-cuenta"
    novalidate
    @submit.prevent="buscar"
  >
    <HudCampo
      v-model="identificador"
      :etiqueta="etiqueta"
      autocompletar="off"
      ayuda="La búsqueda es exacta: no se listan cuentas."
    />
    <div>
      <HudBoton
        tipo="submit"
        variante="secundario"
        :cargando="buscando"
      >
        <IBuscar aria-hidden="true" /> Buscar cuenta
      </HudBoton>
    </div>
    <p
      v-if="mensaje"
      class="mensaje"
      role="status"
    >
      {{ mensaje }}
    </p>
  </form>
</template>

<style scoped>
.buscar-cuenta {
  display: grid;
  gap: 10px;
}

.mensaje {
  margin: 0;
  color: var(--texto-2);
}
</style>
