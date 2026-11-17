<script setup lang="ts">
/**
 * Consentimiento biométrico por persona. Es **facultativo**: sin él la persona entra con otro
 * método (tarjeta, PIN, QR). Revocarlo revoca sus credenciales biométricas.
 */
import { computed, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { ConsentimientoBiometrico } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaHora } from '@/formato/fechas'
import CapturaFoto from '@/hud/componentes/CapturaFoto.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import type { OpcionPersona } from '@/hud/componentes/SelectorPersona.vue'
import { useEntidad } from '@/stores/entidad'
import { consentimiento, registrarConsentimiento, revocarConsentimiento } from '../api'
import PersonaElegida from '../componentes/PersonaElegida.vue'

const VERSION_TEXTO = 'Autorización de tratamiento de datos biométricos v1'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const persona = ref<OpcionPersona | null>(null)

const estado = ref<'inicio' | 'cargando' | 'listo' | 'error'>('inicio')
const error = ref<string | null>(null)
const vigente = ref<ConsentimientoBiometrico | null>(null)
const resultado = ref<string | null>(null)
const version = ref(VERSION_TEXTO)
const soporte = ref('')
const revocando = ref(false)

const registrar = useAccion(() => registrarConsentimiento(id.value, persona.value?.id ?? '', version.value.trim(), soporte.value || null))
const revocar = useAccion(() => revocarConsentimiento(id.value, persona.value?.id ?? ''))

async function guardar() {
  if (!version.value.trim()) return
  const r = await registrar.ejecutar()
  if (!r.ok) return
  vigente.value = r.valor
  soporte.value = ''
  resultado.value = 'Consentimiento registrado: ya se puede enrolar la biometría.'
}

async function confirmarRevocacion() {
  const r = await revocar.ejecutar()
  if (!r.ok) return
  revocando.value = false
  vigente.value = null
  resultado.value = r.valor
    ? `Consentimiento revocado: ${r.valor === 1 ? 'se revocó 1 credencial biométrica' : `se revocaron ${r.valor} credenciales biométricas`}.`
    : 'Consentimiento revocado.'
}

async function cargar() {
  if (!persona.value) return
  estado.value = 'cargando'
  try {
    vigente.value = await consentimiento(id.value, persona.value.id)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(persona, () => {
  resultado.value = null
  registrar.reiniciar()
  version.value = VERSION_TEXTO
  soporte.value = ''
  void cargar()
})
</script>

<template>
  <section aria-labelledby="titulo-biometria">
    <h1 id="titulo-biometria">
      Biometría
    </h1>
    <p class="aviso">
      La biometría es voluntaria. Sin consentimiento, la persona entra con tarjeta, PIN o QR: nunca se le niega el acceso por no darlo.
    </p>
    <PersonaElegida
      v-model="persona"
      :entidad-id="id"
    />
    <HudEstado
      v-if="estado === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="estado === 'error'"
      estado="error"
      :mensaje="error ?? undefined"
      @reintentar="cargar"
    />
    <HudPanel
      v-else-if="estado === 'listo' && persona"
      etiqueta="Consentimiento biométrico"
    >
      <div class="campos">
        <p
          v-if="resultado"
          class="ok"
          role="status"
        >
          {{ resultado }}
        </p>
        <template v-if="vigente">
          <dl class="datos">
            <div><dt>Otorgado</dt><dd>{{ fechaHora(vigente.otorgado_en, zona) }}</dd></div>
            <div><dt>Texto aceptado</dt><dd>{{ vigente.version_texto }}</dd></div>
          </dl>
          <div class="botones">
            <HudBoton
              variante="fantasma"
              @click="revocando = true"
            >
              Revocar consentimiento
            </HudBoton>
          </div>
        </template>
        <form
          v-else
          class="campos"
          @submit.prevent="guardar"
        >
          <p class="texto-2">
            {{ persona.nombre }} no ha dado su consentimiento. Regístrelo solo si la persona lo firmó.
          </p>
          <HudCampo
            v-model="version"
            etiqueta="Texto o versión aceptada"
            autocompletar="off"
          />
          <CapturaFoto
            v-model="soporte"
            etiqueta="Foto del documento firmado (opcional)"
          />
          <p
            v-if="registrar.error.value"
            class="error"
            role="alert"
          >
            {{ registrar.error.value }}
          </p>
          <div class="botones">
            <HudBoton
              tipo="submit"
              :cargando="registrar.cargando.value"
              :deshabilitado="!version.trim()"
            >
              Registrar consentimiento
            </HudBoton>
          </div>
        </form>
      </div>
    </HudPanel>

    <HudDialogo
      v-model:abierto="revocando"
      titulo="Revocar el consentimiento"
    >
      <p>Se revocan también sus credenciales biométricas. La persona seguirá entrando con otro método.</p>
      <p
        v-if="revocar.error.value"
        class="error"
        role="alert"
      >
        {{ revocar.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="revocando = false"
        >
          Volver
        </HudBoton>
        <HudBoton
          :cargando="revocar.cargando.value"
          @click="confirmarRevocacion"
        >
          Revocar
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="./porteria.css"></style>
