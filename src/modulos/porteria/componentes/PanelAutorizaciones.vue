<script setup lang="ts">
/**
 * Autorizaciones de acceso de una persona: las que nacen de la residencia, la propiedad, un
 * contrato, una reserva o una visita, y las manuales (que se crean y revocan aquí).
 */
import { ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { AutorizacionAcceso } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { aUtc, fecha, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { autorizacionesAcceso, crearAutorizacionAcceso, revocarAutorizacionAcceso } from '../api'
import { ORIGEN_AUTORIZACION } from '../reglas'

const props = defineProps<{ entidadId: string; personaId: string; zona: string }>()

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<AutorizacionAcceso[]>([])
const resultado = ref<string | null>(null)

const creando = ref(false)
const desde = ref('')
const hasta = ref('')
const motivo = ref('')
const errorForm = ref<string | null>(null)
const crear = useAccion((clave) =>
  crearAutorizacionAcceso(
    props.entidadId,
    {
      titular: { persona_id: props.personaId },
      vigente_desde: aUtc(`${desde.value}T00:00`, props.zona),
      vigente_hasta: hasta.value ? aUtc(`${hasta.value}T23:59`, props.zona) : null,
      motivo: motivo.value.trim() || null,
    },
    clave,
  ),
)
const revocar = useAccion((_c, a: AutorizacionAcceso) => revocarAutorizacionAcceso(props.entidadId, a.id))

function abrir() {
  desde.value = hoyEn(props.zona)
  hasta.value = motivo.value = ''
  errorForm.value = null
  crear.reiniciar()
  creando.value = true
}

async function guardar() {
  errorForm.value = !desde.value ? 'Elija desde cuándo.' : hasta.value && hasta.value < desde.value ? 'La fecha final es anterior a la inicial.' : null
  if (errorForm.value) return
  const r = await crear.ejecutar()
  if (!r.ok) return
  creando.value = false
  resultado.value = 'Autorización creada.'
  await cargar()
}

async function quitar(a: AutorizacionAcceso) {
  const r = await revocar.ejecutar(a)
  if (!r.ok) return
  resultado.value = 'Autorización revocada.'
  await cargar()
}

async function cargar() {
  try {
    lista.value = await autorizacionesAcceso(props.entidadId, props.personaId)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(
  () => props.personaId,
  () => {
    estado.value = 'cargando'
    resultado.value = null
    void cargar()
  },
  { immediate: true },
)
</script>

<template>
  <HudPanel etiqueta="Autorizaciones de acceso">
    <div class="campos">
      <p
        v-if="resultado"
        class="ok"
        role="status"
      >
        {{ resultado }}
      </p>
      <p
        v-if="revocar.error.value"
        class="error"
        role="alert"
      >
        {{ revocar.error.value }}
      </p>
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
      <p
        v-else-if="lista.length === 0"
        class="texto-2"
      >
        No tiene autorizaciones de acceso.
      </p>
      <ul
        v-else
        class="lista"
        aria-label="Autorizaciones de acceso"
      >
        <li
          v-for="a in lista"
          :key="a.id"
        >
          <HudInsignia :tono="a.revocada_en ? 'neutro' : 'exito'">
            {{ a.revocada_en ? 'Revocada' : 'Vigente' }}
          </HudInsignia>
          <span class="crece">
            <strong>{{ ORIGEN_AUTORIZACION[a.origen] }}</strong>
            <small>
              Desde {{ fecha(a.vigente_desde, zona) }}{{ a.vigente_hasta ? ` hasta ${fecha(a.vigente_hasta, zona)}` : '' }}{{ a.motivo ? ` · ${a.motivo}` : '' }}
            </small>
          </span>
          <HudBoton
            v-if="a.origen === 'manual' && !a.revocada_en"
            variante="fantasma"
            :cargando="revocar.cargando.value"
            @click="quitar(a)"
          >
            Revocar<span class="solo-lector"> autorización {{ a.motivo ?? '' }}</span>
          </HudBoton>
        </li>
      </ul>
      <div class="botones">
        <HudBoton
          variante="secundario"
          @click="abrir"
        >
          Autorizar a mano
        </HudBoton>
      </div>
    </div>

    <HudDialogo
      v-model:abierto="creando"
      titulo="Autorizar acceso"
    >
      <form
        id="formulario-autorizacion"
        class="campos"
        novalidate
        @submit.prevent="guardar"
      >
        <HudFecha
          v-model="desde"
          etiqueta="Desde"
        />
        <HudFecha
          v-model="hasta"
          etiqueta="Hasta (opcional)"
          :minimo="desde"
        />
        <HudCampo
          v-model="motivo"
          etiqueta="Motivo"
          autocompletar="off"
        />
        <p
          v-if="errorForm || crear.error.value"
          class="error"
          role="alert"
        >
          {{ errorForm ?? crear.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="creando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-autorizacion"
          :cargando="crear.cargando.value"
        >
          Autorizar
        </HudBoton>
      </template>
    </HudDialogo>
  </HudPanel>
</template>

<style scoped src="../vistas/porteria.css"></style>
