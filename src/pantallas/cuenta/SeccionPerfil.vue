<script setup lang="ts">
/** Perfil y verificación del correo. */
import { ref } from 'vue'
import type { Perfil } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useCuenta } from '@/stores/cuenta'

defineProps<{ perfil: Perfil }>()

const cuenta = useCuenta()
const codigo = ref('')
const enviado = ref(false)

const reenviar = useAccion(() => cuenta.reenviarVerificacion())
const verificar = useAccion(() => cuenta.verificarCorreo(codigo.value.replace(/\s/g, '')))

async function pedirCodigo() {
  if ((await reenviar.ejecutar()).ok) enviado.value = true
}
</script>

<template>
  <HudPanel
    etiqueta="Perfil"
    as="section"
    aria-labelledby="titulo-perfil"
  >
    <h2 id="titulo-perfil">
      {{ perfil.nombre }}
    </h2>
    <dl class="datos">
      <div>
        <dt>Usuario</dt>
        <dd>{{ perfil.usuario ?? '—' }}</dd>
      </div>
      <div>
        <dt>Correo</dt>
        <dd>
          {{ perfil.correo ?? '—' }}
          <HudInsignia :tono="perfil.correo_verificado ? 'exito' : 'aviso'">
            {{ perfil.correo_verificado ? 'Verificado' : 'Sin verificar' }}
          </HudInsignia>
        </dd>
      </div>
    </dl>

    <form
      v-if="perfil.correo && !perfil.correo_verificado"
      class="verificar"
      @submit.prevent="verificar.ejecutar()"
    >
      <p class="ayuda">
        Verifique su correo para recibir avisos y poder recuperar el acceso.
      </p>
      <HudBoton
        variante="secundario"
        :cargando="reenviar.cargando.value"
        @click="pedirCodigo"
      >
        Enviarme el código
      </HudBoton>
      <p
        v-if="enviado"
        role="status"
      >
        Le enviamos un código a {{ perfil.correo }}.
      </p>
      <HudCampo
        v-model="codigo"
        etiqueta="Código de verificación"
        modo-entrada="numeric"
        autocompletar="one-time-code"
        :error="verificar.error.value ?? reenviar.error.value"
      />
      <HudBoton
        tipo="submit"
        :cargando="verificar.cargando.value"
        :deshabilitado="!codigo.trim()"
      >
        Verificar
      </HudBoton>
    </form>
  </HudPanel>
</template>

<style scoped>
h2 {
  font-size: 24px;
}

.datos {
  display: grid;
  gap: 10px;
  margin: 16px 0 0;
}

.datos div {
  display: grid;
  gap: 2px;
}

dt {
  font-family: var(--fuente-display);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--texto-3);
}

dd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  overflow-wrap: anywhere;
}

.verificar {
  display: grid;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--linea);
}

.verificar p {
  margin: 0;
}

.ayuda {
  color: var(--texto-2);
}
</style>
