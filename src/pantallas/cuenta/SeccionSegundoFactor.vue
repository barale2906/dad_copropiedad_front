<script setup lang="ts">
/**
 * Segundo factor (TOTP): inscribir (QR + secreto que se muestra una vez) y confirmar con el
 * primer código. La consola de la plataforma y algunas acciones lo exigen.
 */
import { ref } from 'vue'
import type { InscripcionSegundoFactor } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCodigoQr from '@/hud/componentes/HudCodigoQr.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import SecretoUnaVez from '@/hud/componentes/SecretoUnaVez.vue'
import { useCuenta } from '@/stores/cuenta'

defineProps<{ activo: boolean }>()

const cuenta = useCuenta()
const inscripcion = ref<InscripcionSegundoFactor | null>(null)
const codigo = ref('')

const inscribir = useAccion(() => cuenta.inscribirSegundoFactor(), {
  alExito: (r) => (inscripcion.value = r),
})
const confirmar = useAccion(() => cuenta.confirmarSegundoFactor(codigo.value.replace(/\s/g, '')), {
  alExito: () => {
    inscripcion.value = null
    codigo.value = ''
  },
})
</script>

<template>
  <HudPanel
    id="segundo-factor"
    etiqueta="Seguridad"
    as="section"
    aria-labelledby="titulo-2fa"
  >
    <h2 id="titulo-2fa">
      Segundo factor
      <HudInsignia :tono="activo ? 'exito' : 'aviso'">
        {{ activo ? 'Activo' : 'Inactivo' }}
      </HudInsignia>
    </h2>

    <p
      v-if="activo"
      class="ayuda"
    >
      Al iniciar sesión se le pedirá el código de su aplicación autenticadora.
    </p>

    <template v-else-if="!inscripcion">
      <p class="ayuda">
        Proteja su cuenta con una aplicación autenticadora (Google Authenticator, Microsoft
        Authenticator, Aegis…). La consola de la plataforma lo exige.
      </p>
      <p
        v-if="inscribir.error.value"
        class="error"
        role="alert"
      >
        {{ inscribir.error.value }}
      </p>
      <HudBoton
        :cargando="inscribir.cargando.value"
        @click="inscribir.ejecutar()"
      >
        Activar segundo factor
      </HudBoton>
    </template>

    <form
      v-else
      class="inscripcion"
      @submit.prevent="confirmar.ejecutar()"
    >
      <ol class="pasos">
        <li>Escanee el código con su aplicación autenticadora.</li>
        <li>Si no puede escanearlo, escriba el secreto a mano.</li>
        <li>Escriba el código de 6 dígitos que muestra la aplicación.</li>
      </ol>
      <HudCodigoQr
        :texto="inscripcion.uri"
        descripcion="Código QR para la aplicación autenticadora"
      />
      <SecretoUnaVez
        :valor="inscripcion.secreto"
        etiqueta="Secreto"
      />
      <HudCampo
        v-model="codigo"
        etiqueta="Código de la aplicación"
        modo-entrada="numeric"
        autocompletar="one-time-code"
        :maximo="7"
        requerido
        :error="confirmar.error.value"
      />
      <HudBoton
        tipo="submit"
        :cargando="confirmar.cargando.value"
      >
        Confirmar
      </HudBoton>
    </form>
  </HudPanel>
</template>

<style scoped>
h2 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 22px;
}

.ayuda {
  margin: 12px 0 16px;
  color: var(--texto-2);
}

.error {
  color: var(--magenta);
}

.inscripcion {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.pasos {
  margin: 0;
  padding-left: 20px;
  color: var(--texto-2);
}
</style>
