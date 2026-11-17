<script setup lang="ts">
/**
 * Busca una cuenta de DAD por usuario o correo **exactos** (el backend nunca lista cuentas) y
 * emite la encontrada. Reutilizable en asignaciones de la plataforma y contratos.
 */
import { ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CuentaEncontrada } from '@/api/tipos'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import { buscarCuenta } from '../api-organizaciones'

const props = defineProps<{ entidadId: string }>()
const emit = defineEmits<{ encontrada: [cuenta: CuentaEncontrada] }>()

const identificador = ref('')
const buscando = ref(false)
const mensaje = ref<string | null>(null)
const encontrada = ref<CuentaEncontrada | null>(null)

async function buscar() {
  if (!identificador.value.trim()) return
  buscando.value = true
  mensaje.value = null
  encontrada.value = null
  try {
    encontrada.value = await buscarCuenta(props.entidadId, identificador.value)
    if (encontrada.value) emit('encontrada', encontrada.value)
    else mensaje.value = 'No hay una cuenta activa con ese usuario o correo. Revise que esté escrito completo.'
  } catch (e) {
    mensaje.value = mensajeDeError(e)
  } finally {
    buscando.value = false
  }
}
</script>

<template>
  <div class="buscar-cuenta">
    <form
      class="fila"
      @submit.prevent="buscar"
    >
      <HudCampo
        v-model="identificador"
        etiqueta="Usuario o correo de la cuenta"
        autocompletar="off"
        ayuda="Escríbalo completo: no se muestran sugerencias."
      />
      <HudBoton
        tipo="submit"
        variante="secundario"
        :cargando="buscando"
      >
        Buscar
      </HudBoton>
    </form>
    <p
      v-if="encontrada"
      class="ok"
      role="status"
    >
      Cuenta encontrada: <strong>{{ encontrada.nombre }}</strong>
    </p>
    <p
      v-else-if="mensaje"
      class="aviso"
      role="alert"
    >
      {{ mensaje }}
    </p>
  </div>
</template>

<style scoped>
.buscar-cuenta {
  display: grid;
  gap: 8px;
}

.fila {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
}

.fila > :first-child {
  flex: 1 1 240px;
}

.fila :deep(.hud-boton) {
  margin-top: 26px;
}

.ok,
.aviso {
  margin: 0;
}

.ok {
  color: var(--verde);
}

.aviso {
  color: var(--ambar);
}
</style>
