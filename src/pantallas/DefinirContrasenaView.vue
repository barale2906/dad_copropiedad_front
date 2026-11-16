<script setup lang="ts">
/**
 * «Definir contraseña» (pública): correo + código que llegó al correo + contraseña nueva. La
 * usan quien olvidó su contraseña y los usuarios nuevos creados por un administrador. No hay
 * registro abierto ni contraseñas temporales.
 */
import { computed, ref } from 'vue'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useSesion } from '@/stores/sesion'
import ICandado from '~icons/tabler/lock'
import MarcaDad from './componentes/MarcaDad.vue'

const sesion = useSesion()

/** El correo llega en el estado del historial (no en la URL) desde «olvidé mi contraseña». */
const inicial = typeof history.state?.correo === 'string' ? (history.state.correo as string) : ''

const correo = ref(inicial)
const codigo = ref('')
const nueva = ref('')
const confirmacion = ref('')
const intentado = ref(false)
const lista = ref(false)
const reenviado = ref(false)

const noCoinciden = computed(() => intentado.value && nueva.value !== confirmacion.value)

const definir = useAccion(() =>
  sesion.definirContrasena(correo.value.trim(), codigo.value.replace(/\s/g, ''), nueva.value),
)
const reenviar = useAccion(() => sesion.recuperarContrasena(correo.value.trim()))

async function enviar() {
  intentado.value = true
  if (nueva.value !== confirmacion.value) return
  if ((await definir.ejecutar()).ok) {
    nueva.value = ''
    confirmacion.value = ''
    lista.value = true
  }
}

async function pedirOtro() {
  reenviado.value = false
  if ((await reenviar.ejecutar()).ok) reenviado.value = true
}
</script>

<template>
  <main class="definir">
    <div
      class="fondo-hud"
      aria-hidden="true"
    />
    <MarcaDad class="marca" />
    <HudPanel
      etiqueta="Terminal de acceso"
      class="panel"
    >
      <template v-if="!lista">
        <h1>Definir contraseña</h1>
        <p class="ayuda">
          Escriba el código de 6 dígitos que le llegó al correo y elija su contraseña.
        </p>
        <form
          class="campos"
          @submit.prevent="enviar"
        >
          <HudCampo
            v-model="correo"
            etiqueta="Correo"
            tipo="email"
            autocompletar="email"
            modo-entrada="email"
            requerido
          />
          <HudCampo
            v-model="codigo"
            etiqueta="Código"
            autocompletar="one-time-code"
            modo-entrada="numeric"
            :maximo="7"
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
            etiqueta="Repita la contraseña"
            tipo="password"
            autocompletar="new-password"
            requerido
            :error="noCoinciden ? 'Las contraseñas no coinciden.' : null"
          />
          <p
            v-if="definir.error.value"
            class="error"
            role="alert"
          >
            {{ definir.error.value }}
          </p>
          <HudBoton
            tipo="submit"
            bloque
            :cargando="definir.cargando.value"
          >
            <ICandado aria-hidden="true" /> Definir contraseña
          </HudBoton>
        </form>
        <div class="otro">
          <button
            type="button"
            class="enlace"
            :disabled="!correo.trim() || reenviar.cargando.value"
            @click="pedirOtro"
          >
            ¿No le llegó o ya venció? Pedir otro código
          </button>
          <p
            v-if="reenviado"
            role="status"
          >
            Si la cuenta existe, le llegará un código nuevo en unos minutos.
          </p>
          <p
            v-if="reenviar.error.value"
            class="error"
            role="alert"
          >
            {{ reenviar.error.value }}
          </p>
        </div>
      </template>
      <template v-else>
        <h1>Contraseña definida</h1>
        <p
          class="ayuda"
          role="status"
        >
          Ya puede iniciar sesión con su nueva contraseña.
        </p>
        <HudBoton
          :a="{ name: 'ingresar' }"
          bloque
        >
          Iniciar sesión
        </HudBoton>
      </template>
      <RouterLink
        v-if="!lista"
        :to="{ name: 'ingresar' }"
        class="volver"
      >
        Volver al acceso
      </RouterLink>
    </HudPanel>
  </main>
</template>

<style scoped>
.definir {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 24px;
  min-height: 100dvh;
  padding: 32px var(--gutter);
}

.panel {
  width: min(100%, 440px);
}

h1 {
  font-size: clamp(26px, 4vw, 34px);
}

.ayuda {
  margin: 8px 0 20px;
  color: var(--texto-2);
}

.campos {
  display: grid;
  gap: 16px;
}

.error {
  margin: 0;
  color: var(--magenta);
}

.otro {
  display: grid;
  gap: 6px;
  margin-top: 16px;
  font-size: 14px;
  color: var(--texto-2);
}

.otro p {
  margin: 0;
}

.enlace {
  justify-self: start;
  min-height: 40px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--cian);
  text-decoration: underline;
  cursor: pointer;
}

.enlace:disabled {
  color: var(--texto-3);
  cursor: not-allowed;
}

.volver {
  display: inline-block;
  margin-top: 16px;
  font-size: 14px;
}
</style>
