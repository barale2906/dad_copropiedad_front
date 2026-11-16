<script setup lang="ts">
/** Cambiar la contraseña (exige la actual). */
import { computed, ref } from 'vue'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useCuenta } from '@/stores/cuenta'

const cuenta = useCuenta()
const actual = ref('')
const nueva = ref('')
const confirmacion = ref('')
const intentado = ref(false)
const cambiada = ref(false)

const noCoinciden = computed(() => intentado.value && nueva.value !== confirmacion.value)
const cambiar = useAccion(() => cuenta.cambiarContrasena(actual.value, nueva.value))

async function enviar() {
  intentado.value = true
  cambiada.value = false
  if (nueva.value !== confirmacion.value) return
  if ((await cambiar.ejecutar()).ok) {
    actual.value = ''
    nueva.value = ''
    confirmacion.value = ''
    intentado.value = false
    cambiada.value = true
  }
}
</script>

<template>
  <HudPanel
    etiqueta="Seguridad"
    as="section"
    aria-labelledby="titulo-contrasena"
  >
    <h2 id="titulo-contrasena">
      Contraseña
    </h2>
    <form
      class="campos"
      @submit.prevent="enviar"
    >
      <HudCampo
        v-model="actual"
        etiqueta="Contraseña actual"
        tipo="password"
        autocompletar="current-password"
        requerido
      />
      <HudCampo
        v-model="nueva"
        etiqueta="Contraseña nueva"
        tipo="password"
        autocompletar="new-password"
        requerido
      />
      <HudCampo
        v-model="confirmacion"
        etiqueta="Repita la contraseña nueva"
        tipo="password"
        autocompletar="new-password"
        requerido
        :error="noCoinciden ? 'Las contraseñas no coinciden.' : null"
      />
      <p
        v-if="cambiar.error.value"
        class="error"
        role="alert"
      >
        {{ cambiar.error.value }}
      </p>
      <p
        v-if="cambiada"
        class="exito"
        role="status"
      >
        Su contraseña quedó cambiada.
      </p>
      <HudBoton
        tipo="submit"
        :cargando="cambiar.cargando.value"
      >
        Cambiar contraseña
      </HudBoton>
    </form>
  </HudPanel>
</template>

<style scoped>
h2 {
  font-size: 22px;
}

.campos {
  display: grid;
  gap: 14px;
  margin-top: 16px;
}

.error,
.exito {
  margin: 0;
}

.error {
  color: var(--magenta);
}

.exito {
  color: var(--verde);
}
</style>
