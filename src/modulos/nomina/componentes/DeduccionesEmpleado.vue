<script setup lang="ts">
/**
 * Deducciones de la retención en la fuente que declaró el empleado (dependientes, intereses de
 * vivienda, medicina prepagada, aportes voluntarios) con su soporte. Se aplican desde la
 * liquidación siguiente; terminar una la deja de aplicar desde el día siguiente.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { DeduccionRetencion, TipoDeduccion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useAdjuntos } from '@/composables/useAdjuntos'
import { opcionesDe } from '@/composables/textos-acceso'
import { moneda } from '@/formato/decimales'
import { fechaCalendario } from '@/formato/fechas'
import { TIPO_DEDUCCION } from '@/formato/nomina'
import HudAdjuntos from '@/hud/componentes/HudAdjuntos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { crearDeduccion, deducciones as pedirDeducciones, terminarDeduccion } from '../api'

const props = defineProps<{ entidadId: string; empleadoId: string; hoy: string; puedeGestionar: boolean }>()

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<DeduccionRetencion[]>([])
const resultado = ref<string | null>(null)

const agregando = ref(false)
const tipo = ref<TipoDeduccion | ''>('')
const valor = ref('')
const desde = ref('')
const soporte = useAdjuntos(() => props.entidadId, 'personal')
const crear = useAccion(() => {
  if (!tipo.value) throw new Error('Sin tipo')
  return crearDeduccion(props.entidadId, props.empleadoId, {
    tipo: tipo.value,
    valor_mensual: tipo.value === 'dependientes' ? null : valor.value,
    vigente_desde: desde.value,
    soporte_archivo_id: soporte.ids()[0] ?? null,
  })
})

const errores = computed(() => [soporte.error.value, crear.error.value].filter(Boolean))
const completa = computed(() => !!tipo.value && !!desde.value && (tipo.value === 'dependientes' || !!valor.value))

const terminando = ref<DeduccionRetencion | null>(null)
const abiertoTerminar = computed({ get: () => !!terminando.value, set: (v: boolean) => !v && (terminando.value = null) })
const hasta = ref('')
const terminar = useAccion((_c, d: DeduccionRetencion) => terminarDeduccion(props.entidadId, d.id, hasta.value))

function abrir() {
  tipo.value = ''
  valor.value = ''
  desde.value = props.hoy
  soporte.limpiar()
  crear.reiniciar()
  agregando.value = true
}

async function guardar() {
  const r = await crear.ejecutar()
  if (!r.ok) return
  agregando.value = false
  lista.value = [...lista.value, r.valor]
  resultado.value = 'Deducción registrada: se aplica desde la liquidación siguiente.'
}

function pedirTerminar(d: DeduccionRetencion) {
  hasta.value = props.hoy
  terminar.reiniciar()
  terminando.value = d
}

async function confirmarTerminar() {
  if (!terminando.value) return
  const r = await terminar.ejecutar(terminando.value)
  if (!r.ok) return
  lista.value = lista.value.map((x) => (x.id === r.valor.id ? r.valor : x))
  terminando.value = null
  resultado.value = 'Deducción terminada: deja de aplicarse desde el día siguiente.'
}

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = await pedirDeducciones(props.entidadId, props.empleadoId)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <HudPanel etiqueta="Deducciones de la retención">
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <HudEstado
      v-if="estado === 'cargando'"
      estado="cargando"
      :filas="1"
    />
    <HudEstado
      v-else-if="estado === 'error'"
      estado="error"
      :mensaje="error ?? undefined"
      @reintentar="cargar"
    />
    <p
      v-else-if="!lista.length"
      class="texto-2"
    >
      El empleado no ha declarado deducciones.
    </p>
    <ul
      v-else
      class="lista"
      aria-label="Deducciones de la retención"
    >
      <li
        v-for="d in lista"
        :key="d.id"
      >
        <span class="crece">
          <strong>{{ TIPO_DEDUCCION[d.tipo] }}</strong>
          <small>
            Desde el {{ fechaCalendario(d.vigente_desde) }}{{ d.vigente_hasta ? ` hasta el ${fechaCalendario(d.vigente_hasta)}` : '' }}
          </small>
        </span>
        <span
          v-if="d.tipo !== 'dependientes'"
          class="cifra"
        >{{ moneda(d.valor_mensual) }} al mes</span>
        <HudBoton
          v-if="puedeGestionar && !d.vigente_hasta"
          variante="fantasma"
          @click="pedirTerminar(d)"
        >
          Terminar<span class="solo-lector"> la deducción {{ TIPO_DEDUCCION[d.tipo] }}</span>
        </HudBoton>
      </li>
    </ul>
    <div
      v-if="puedeGestionar"
      class="botones"
    >
      <HudBoton
        variante="secundario"
        @click="abrir"
      >
        Agregar deducción
      </HudBoton>
    </div>

    <HudDialogo
      v-model:abierto="agregando"
      titulo="Agregar deducción de la retención"
    >
      <div class="campos">
        <HudSelector
          v-model="tipo"
          etiqueta="Tipo"
          vacio="Elija el tipo"
          :opciones="opcionesDe(TIPO_DEDUCCION)"
        />
        <HudCampoMonto
          v-if="tipo && tipo !== 'dependientes'"
          v-model="valor"
          etiqueta="Valor mensual"
          requerido
        />
        <HudFecha
          v-model="desde"
          etiqueta="Rige desde"
          requerido
        />
        <div>
          <p class="rotulo">
            Soporte
          </p>
          <HudAdjuntos
            :adjuntos="soporte.adjuntos.value"
            :subiendo="soporte.subiendo.value"
            acepta="application/pdf,image/*"
            @subir="soporte.subir"
            @abrir="soporte.abrir"
            @quitar="soporte.quitar"
          />
        </div>
        <p
          v-for="e in errores"
          :key="e ?? ''"
          class="error"
          role="alert"
        >
          {{ e }}
        </p>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="agregando = false"
        >
          Volver
        </HudBoton>
        <HudBoton
          :cargando="crear.cargando.value"
          :deshabilitado="!completa"
          @click="guardar"
        >
          Registrar
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="abiertoTerminar"
      titulo="Terminar la deducción"
    >
      <HudFecha
        v-model="hasta"
        etiqueta="Se aplica hasta"
        :minimo="terminando?.vigente_desde"
        requerido
      />
      <p
        v-if="terminar.error.value"
        class="error"
        role="alert"
      >
        {{ terminar.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="terminando = null"
        >
          Volver
        </HudBoton>
        <HudBoton
          :cargando="terminar.cargando.value"
          @click="confirmarTerminar"
        >
          Terminar
        </HudBoton>
      </template>
    </HudDialogo>
  </HudPanel>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
