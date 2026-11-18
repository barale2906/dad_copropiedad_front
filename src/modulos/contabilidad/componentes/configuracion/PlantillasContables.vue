<script setup lang="ts">
/**
 * Plantillas contables publicadas (de la plataforma o de la organización contable): ver qué haría
 * aplicarla (vista previa) y confirmarla; y guardar la configuración propia como plantilla.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { PlantillaContableResumen, ResumenAplicacionPlantilla } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaCalendario } from '@/formato/fechas'
import FlujoDosPasos, { type PasoFlujo } from '@/hud/componentes/FlujoDosPasos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import { aplicarPlantilla, guardarComoPlantilla, plantillas as pedirPlantillas } from '../../api'

const props = defineProps<{ entidadId: string; editable: boolean }>()

const entidad = useEntidad()
const plan = usePlanCuentas()
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<PlantillaContableResumen[]>([])
const elegida = ref('')
const paso = ref<PasoFlujo>('editar')
const resumen = ref<ResumenAplicacionPlantilla | null>(null)
const nombre = ref('')
const guardada = ref<string | null>(null)

const opciones = computed(() => lista.value.map((p) => ({ valor: p.id, etiqueta: `${p.nombre} v${p.version} · ${p.ambito === 'plataforma' ? 'DAD' : p.organizacion}` })))
const plantilla = computed(() => lista.value.find((p) => p.id === elegida.value) ?? null)

const vista = useAccion(() => aplicarPlantilla(props.entidadId, elegida.value, true))
const aplicar = useAccion(() => aplicarPlantilla(props.entidadId, elegida.value, false))
const guardar = useAccion(() => guardarComoPlantilla(props.entidadId, nombre.value, entidad.activa?.tipo ?? 'empresa'))

async function previsualizar() {
  const r = await vista.ejecutar()
  if (!r.ok) return
  resumen.value = r.valor
  paso.value = 'revisar'
}

async function confirmar() {
  const r = await aplicar.ejecutar()
  if (!r.ok) return
  resumen.value = r.valor
  paso.value = 'hecho'
  await plan.recargar()
}

async function alGuardar() {
  const r = await guardar.ejecutar()
  if (!r.ok) return
  guardada.value = `Plantilla «${r.valor.nombre}» guardada en borrador.`
  nombre.value = ''
}

async function cargar() {
  try {
    lista.value = await pedirPlantillas(props.entidadId)
    elegida.value = lista.value[0]?.id ?? ''
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
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
  <div
    v-else
    class="campos"
  >
    <HudEstado
      v-if="!lista.length"
      estado="vacio"
      mensaje="No hay plantillas publicadas para esta entidad."
    />
    <FlujoDosPasos
      v-else-if="editable"
      v-model:paso="paso"
      accion="Aplicar la plantilla"
      :cargando="vista.cargando.value || aplicar.cargando.value"
      :error="vista.error.value ?? aplicar.error.value"
      @previsualizar="previsualizar"
      @confirmar="confirmar"
      @reiniciar="paso = 'editar'"
    >
      <template #formulario>
        <HudSelector
          v-model="elegida"
          etiqueta="Plantilla"
          :opciones="opciones"
        />
        <p
          v-if="plantilla"
          class="texto-2"
        >
          {{ plantilla.tipo_empresa === 'propiedad_horizontal' ? 'Para propiedad horizontal' : `Para ${plantilla.tipo_empresa}` }}
          <template v-if="plantilla.publicada_en">
            · publicada el {{ fechaCalendario(plantilla.publicada_en.slice(0, 10)) }}
          </template>
        </p>
      </template>
      <template #vista-previa>
        <ul
          v-if="resumen"
          class="lista"
          aria-label="Lo que haría la plantilla"
        >
          <li>{{ resumen.cuentas_creadas }} cuentas nuevas ({{ resumen.cuentas_existentes }} ya existen y no se tocan)</li>
          <li>{{ resumen.tipos_creados }} tipos de comprobante nuevos</li>
          <li>{{ resumen.reglas_creadas }} reglas de contabilización y {{ resumen.rubros }} rubros</li>
          <li>{{ resumen.configuracion ? 'Crea la configuración general' : 'La configuración general se conserva' }}</li>
        </ul>
      </template>
      <template #hecho>
        <p
          class="ok"
        >
          Plantilla aplicada: {{ resumen?.cuentas_creadas }} cuentas y {{ resumen?.reglas_creadas }} reglas nuevas.
        </p>
      </template>
    </FlujoDosPasos>

    <form
      v-if="editable"
      class="filtros"
      @submit.prevent="alGuardar"
    >
      <HudCampo
        v-model="nombre"
        etiqueta="Guardar mi configuración como plantilla"
        ayuda="Queda en borrador para revisarla y publicarla."
      />
      <HudBoton
        tipo="submit"
        variante="secundario"
        :cargando="guardar.cargando.value"
        :deshabilitado="!nombre.trim()"
      >
        Guardar como plantilla
      </HudBoton>
    </form>
    <p
      v-if="guardada"
      class="ok"
      role="status"
    >
      {{ guardada }}
    </p>
    <p
      v-if="guardar.error.value"
      class="error"
      role="alert"
    >
      {{ guardar.error.value }}
    </p>
  </div>
</template>

<style scoped src="../../vistas/contabilidad.css"></style>
