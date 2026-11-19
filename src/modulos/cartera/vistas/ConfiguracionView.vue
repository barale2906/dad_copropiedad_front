<script setup lang="ts">
/**
 * Puesta en marcha de la cartera como asistente, en el orden de la guía: conceptos → política →
 * módulos de contribución → presupuesto (aprobado) → referencia de pago de cada unidad →
 * cartera inicial. Cada paso dice si ya está listo; se puede ir a cualquiera.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { ModuloContribucion, PoliticaCartera, Presupuesto } from '@/api/tipos'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPasos from '@/hud/componentes/HudPasos.vue'
import { useEntidad } from '@/stores/entidad'
import { modulosContribucion, politicas as pedirPoliticas, presupuestos as pedirPresupuestos } from '../api'
import ConfigConceptos from '../componentes/ConfigConceptos.vue'
import ConfigModulos from '../componentes/ConfigModulos.vue'
import ConfigPolitica from '../componentes/ConfigPolitica.vue'
import ConfigReferencias from '../componentes/ConfigReferencias.vue'
import { useCartera } from '../store'

type Paso = 'conceptos' | 'politica' | 'modulos' | 'presupuesto' | 'referencias' | 'inicial'

const PASOS: { id: Paso; texto: string }[] = [
  { id: 'conceptos', texto: 'Conceptos' },
  { id: 'politica', texto: 'Política' },
  { id: 'modulos', texto: 'Módulos' },
  { id: 'presupuesto', texto: 'Presupuesto' },
  { id: 'referencias', texto: 'Referencias' },
  { id: 'inicial', texto: 'Cartera inicial' },
]

const route = useRoute()
const entidad = useEntidad()
const cartera = useCartera()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const ruta = (accion: string, query: Record<string, string> = {}) => ({ name: 'modulo', params: { ...route.params, accion, id: '' }, query })

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const paso = ref<Paso>('conceptos')
const politicas = ref<PoliticaCartera[]>([])
const modulos = ref<ModuloContribucion[]>([])
const presupuestos = ref<Presupuesto[]>([])

/** Qué pasos ya están listos (los módulos son opcionales). */
const listo = computed<Record<Paso, boolean>>(() => ({
  conceptos: cartera.conceptos.some((c) => c.tipo === 'ordinaria' && c.activo),
  politica: politicas.value.length > 0,
  modulos: true,
  presupuesto: presupuestos.value.some((p) => p.estado === 'vigente'),
  referencias: cartera.bienes.length > 0 && cartera.bienes.every((b) => b.referencia_pago),
  inicial: false,
}))

async function cargar() {
  try {
    await cartera.recargar(id.value)
    ;[politicas.value, modulos.value, presupuestos.value] = await Promise.all([pedirPoliticas(id.value), modulosContribucion(id.value), pedirPresupuestos(id.value)])
    paso.value = PASOS.find((p) => !listo.value[p.id])?.id ?? 'conceptos'
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-configuracion">
    <header>
      <h1 id="titulo-configuracion">
        Configuración de la cartera
      </h1>
      <p class="texto-2">
        Siga los pasos en orden para poner en marcha la cartera; puede volver a cualquiera.
      </p>
    </header>
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
      <HudPasos
        :pasos="PASOS"
        :actual="paso"
        etiqueta="Pasos de la puesta en marcha"
        libre
        @ir="paso = $event as Paso"
      />
      <HudPanel :etiqueta="PASOS.find((p) => p.id === paso)?.texto ?? ''">
        <div class="campos">
          <HudInsignia
            v-if="paso !== 'modulos' && paso !== 'inicial'"
            :tono="listo[paso] ? 'exito' : 'aviso'"
          >
            {{ listo[paso] ? 'Listo' : 'Pendiente' }}
          </HudInsignia>
          <ConfigConceptos
            v-if="paso === 'conceptos'"
            :modulos="modulos"
          />
          <ConfigPolitica
            v-else-if="paso === 'politica'"
            :politicas="politicas"
            @creada="cargar"
          />
          <ConfigModulos
            v-else-if="paso === 'modulos'"
            :modulos="modulos"
            @cambio="cargar"
          />
          <template v-else-if="paso === 'presupuesto'">
            <p class="texto-2">
              {{ listo.presupuesto ? 'Hay un presupuesto vigente: la cuota ordinaria se calcula con él.' : 'Cree el presupuesto del año y registre su aprobación por la asamblea.' }}
            </p>
            <RouterLink :to="ruta('presupuesto')">
              Ir al presupuesto
            </RouterLink>
          </template>
          <ConfigReferencias v-else-if="paso === 'referencias'" />
          <template v-else>
            <p class="texto-2">
              Si la copropiedad ya tenía deudas antes de usar el sistema, cárguelas por unidad, concepto y antigüedad.
            </p>
            <RouterLink :to="ruta('ajustes', { vista: 'inicial' })">
              Cargar la cartera inicial
            </RouterLink>
          </template>
        </div>
      </HudPanel>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
