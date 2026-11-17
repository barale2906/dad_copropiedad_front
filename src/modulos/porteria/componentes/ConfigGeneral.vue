<script setup lang="ts">
/** Plazos de retención, avisos de correspondencia, silencio nocturno y costo de los avisos. */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { ConfiguracionAcceso, CostoAvisos } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda } from '@/formato/decimales'
import { hoyEn, sumarDias } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { configuracion, costoAvisos, guardarConfiguracion } from '../api'

const props = defineProps<{ entidadId: string; zona: string }>()

const CAMPOS = [
  { clave: 'dias_avisos_correspondencia', etiqueta: 'Días avisando un paquete sin recoger' },
  { clave: 'retencion_soportes_dias', etiqueta: 'Días que se guardan firmas y fotos de entrega' },
  { clave: 'retencion_eventos_dias', etiqueta: 'Días que se guarda la bitácora' },
  { clave: 'retencion_fotos_placas_dias', etiqueta: 'Días que se guardan las fotos de placas' },
] as const

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const numeros = ref<Record<(typeof CAMPOS)[number]['clave'], string>>({
  dias_avisos_correspondencia: '', retencion_soportes_dias: '', retencion_eventos_dias: '', retencion_fotos_placas_dias: '',
})
const silencioInicio = ref('')
const silencioFin = ref('')
const guardado = ref(false)
const errorForm = ref<string | null>(null)

const desde = ref(sumarDias(hoyEn(props.zona), -30))
const hasta = ref(hoyEn(props.zona))
const costo = ref<CostoAvisos | null>(null)
const errorCosto = ref<string | null>(null)

const datos = computed<ConfiguracionAcceso>(() => ({
  dias_avisos_correspondencia: parseInt(numeros.value.dias_avisos_correspondencia, 10),
  retencion_soportes_dias: parseInt(numeros.value.retencion_soportes_dias, 10),
  retencion_eventos_dias: parseInt(numeros.value.retencion_eventos_dias, 10),
  retencion_fotos_placas_dias: parseInt(numeros.value.retencion_fotos_placas_dias, 10),
  silencio_inicio: silencioInicio.value ? `${silencioInicio.value.slice(0, 5)}:00` : null,
  silencio_fin: silencioFin.value ? `${silencioFin.value.slice(0, 5)}:00` : null,
}))

const guardar = useAccion(() => guardarConfiguracion(props.entidadId, datos.value))

async function enviar() {
  guardado.value = false
  const malo = CAMPOS.find((c) => !/^\d+$/.test(numeros.value[c.clave].trim()))
  errorForm.value = malo ? `«${malo.etiqueta}» debe ser un número entero.` : !!silencioInicio.value !== !!silencioFin.value ? 'El silencio nocturno necesita inicio y fin.' : null
  if (errorForm.value) return
  const r = await guardar.ejecutar()
  if (r.ok) {
    llenar(r.valor)
    guardado.value = true
  }
}

function llenar(c: ConfiguracionAcceso) {
  for (const { clave } of CAMPOS) numeros.value[clave] = String(c[clave])
  silencioInicio.value = c.silencio_inicio?.slice(0, 5) ?? ''
  silencioFin.value = c.silencio_fin?.slice(0, 5) ?? ''
}

async function consultarCosto() {
  errorCosto.value = null
  try {
    costo.value = await costoAvisos(props.entidadId, desde.value, hasta.value)
  } catch (e) {
    costo.value = null
    errorCosto.value = mensajeDeError(e)
  }
}

async function cargar() {
  try {
    llenar(await configuracion(props.entidadId))
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(() => {
  void cargar()
  void consultarCosto()
})
</script>

<template>
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
  <template v-else>
    <HudPanel etiqueta="Plazos y avisos">
      <form
        class="campos"
        novalidate
        @submit.prevent="enviar"
      >
        <HudCampo
          v-for="c in CAMPOS"
          :key="c.clave"
          v-model="numeros[c.clave]"
          :etiqueta="c.etiqueta"
          modo-entrada="numeric"
        />
        <div class="dos">
          <HudCampo
            v-model="silencioInicio"
            etiqueta="Silencio nocturno desde"
            tipo="time"
          />
          <HudCampo
            v-model="silencioFin"
            etiqueta="Silencio nocturno hasta"
            tipo="time"
          />
        </div>
        <p class="texto-2">
          En el silencio nocturno no se envían avisos de paquetes; las visitas sí se avisan.
        </p>
        <p
          v-if="errorForm || guardar.error.value"
          class="error"
          role="alert"
        >
          {{ errorForm ?? guardar.error.value }}
        </p>
        <p
          v-if="guardado"
          class="ok"
          role="status"
        >
          Configuración guardada.
        </p>
        <div class="botones">
          <HudBoton
            tipo="submit"
            :cargando="guardar.cargando.value"
          >
            Guardar
          </HudBoton>
        </div>
      </form>
    </HudPanel>

    <HudPanel etiqueta="Costo de los avisos">
      <form
        class="campos"
        @submit.prevent="consultarCosto"
      >
        <div class="dos">
          <HudFecha
            v-model="desde"
            etiqueta="Desde"
          />
          <HudFecha
            v-model="hasta"
            etiqueta="Hasta"
          />
        </div>
        <div class="botones">
          <HudBoton
            tipo="submit"
            variante="secundario"
          >
            Consultar
          </HudBoton>
        </div>
        <p
          v-if="errorCosto"
          class="error"
          role="alert"
        >
          {{ errorCosto }}
        </p>
        <dl
          v-else-if="costo"
          class="datos"
        >
          <div><dt>Avisos en la app</dt><dd>{{ costo.push_enviados }}</dd></div>
          <div><dt>Avisos por WhatsApp</dt><dd>{{ costo.whatsapp_enviados }}</dd></div>
          <div><dt>Fallidos</dt><dd>{{ costo.fallidos }}</dd></div>
          <div><dt>Tarifa por aviso</dt><dd>{{ moneda(costo.tarifa_utilidad) }}</dd></div>
          <div><dt>Valor estimado</dt><dd><strong>{{ moneda(costo.valor_estimado) }}</strong></dd></div>
        </dl>
      </form>
    </HudPanel>
  </template>
</template>

<style scoped src="../vistas/porteria.css"></style>
<style scoped>
.dos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 12px;
}
</style>
