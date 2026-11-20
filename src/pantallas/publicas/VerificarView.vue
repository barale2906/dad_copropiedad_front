<script setup lang="ts">
/**
 * Verificación pública de un paz y salvo o certificado de deuda: quien lo recibe escribe el código
 * impreso y ve si corresponde a un certificado emitido por la copropiedad (con su fecha de corte).
 */
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { verificarCertificado } from '@/api/publico'
import type { VerificacionCertificado } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaCalendario } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import MarcoPublico from './MarcoPublico.vue'

const route = useRoute()
const id = String(route.params.copropiedadId ?? '')
const codigo = ref('')
const resultado = ref<VerificacionCertificado | null>(null)
const TIPO = { paz_y_salvo: 'Paz y salvo', deuda: 'Certificado de deuda' } as const

const verificar = useAccion((_clave, c: string) => verificarCertificado(id, c))

async function enviar() {
  if (!codigo.value.trim()) return
  resultado.value = null
  const r = await verificar.ejecutar(codigo.value)
  if (r.ok) resultado.value = r.valor
}
</script>

<template>
  <MarcoPublico
    titulo="Verificar un certificado"
    subtitulo="Escriba el código impreso en el paz y salvo o en el certificado de deuda."
  >
    <form
      class="formulario"
      novalidate
      @submit.prevent="enviar"
    >
      <HudCampo
        v-model="codigo"
        etiqueta="Código de verificación"
        autocompletar="off"
      />
      <HudBoton
        tipo="submit"
        bloque
        :deshabilitado="!codigo.trim() || verificar.segundosEspera.value > 0"
        :cargando="verificar.cargando.value"
      >
        {{ verificar.segundosEspera.value > 0 ? `Espere ${verificar.segundosEspera.value} s` : 'Verificar' }}
      </HudBoton>
    </form>
    <HudPanel
      v-if="resultado?.valido"
      etiqueta="Certificado válido"
      resaltado
    >
      <p
        class="ok"
        role="status"
      >
        {{ resultado.tipo ? TIPO[resultado.tipo] : 'Certificado' }} válido<template v-if="resultado.corte">
          , con corte al {{ fechaCalendario(resultado.corte.slice(0, 10)) }}
        </template>.
      </p>
    </HudPanel>
    <HudPanel
      v-else-if="resultado"
      etiqueta="Sin coincidencia"
    >
      <p
        class="no"
        role="status"
      >
        El código no corresponde a ningún certificado de esta copropiedad. Revíselo o pida el certificado de nuevo.
      </p>
    </HudPanel>
    <p
      v-if="verificar.error.value"
      class="error"
      role="alert"
    >
      {{ verificar.error.value }}
    </p>
  </MarcoPublico>
</template>

<style scoped>
.formulario {
  display: grid;
  gap: 12px;
}

.ok,
.no {
  margin: 0;
  font-size: 19px;
}

.ok {
  font-weight: 600;
}

.error {
  margin: 0;
  color: var(--magenta);
}
</style>
