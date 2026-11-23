<script setup lang="ts">
/**
 * Ficha de un empleado: datos, certificado laboral (con o sin salario), sus contratos con la
 * línea de tiempo de versiones y las acciones de cada uno, otro contrato cuando ya no tiene uno
 * vigente y las deducciones de la retención. El estado (activo o retirado) se deriva de los
 * contratos: no hay botón para cambiarlo.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Administradora, FichaEmpleado, TipoContratoLaboral } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { opcionesDe } from '@/composables/textos-acceso'
import { TIPO_CONTRATO } from '@/formato/nomina'
import { documentoLegible } from '@/formato/tributario'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import IDescargar from '~icons/tabler/download'
import { agregarContrato, certificadoLaboral, empleado as pedirEmpleado } from '../api'
import { camposCondiciones, condicionesVacias, contratosOrdenados, contratoVigente, faltantesCondiciones, limpiarCondiciones, tipoSalarioDe } from '../reglas'
import ContratoEmpleado from './ContratoEmpleado.vue'
import DeduccionesEmpleado from './DeduccionesEmpleado.vue'
import FormCondiciones from './FormCondiciones.vue'

const props = withDefaults(
  defineProps<{
    entidadId: string
    empleadoId: string
    administradoras: Administradora[]
    centros?: { valor: string; etiqueta: string }[]
    hoy: string
    puedeGestionar: boolean
    verSalarios: boolean
    /** Mensaje de la acción anterior (p. ej. el alta). */
    aviso?: string | null
  }>(),
  { centros: () => [], aviso: null },
)
const emit = defineEmits<{ cambio: [ficha: FichaEmpleado] }>()

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const ficha = ref<FichaEmpleado | null>(null)
const resultado = ref<string | null>(props.aviso)
const errorCertificado = ref<string | null>(null)
const descargando = ref<'sin' | 'con' | null>(null)

const contratos = computed(() => (ficha.value ? contratosOrdenados(ficha.value) : []))
const retirado = computed(() => !!ficha.value && !contratoVigente(ficha.value))

// Contrato nuevo (cuando el anterior terminó)
const nuevo = ref(false)
const tipo = ref<TipoContratoLaboral>('termino_indefinido')
const inicio = ref('')
const fin = ref('')
const obra = ref('')
const condiciones = ref(condicionesVacias())
const avisoNuevo = ref<string | null>(null)
const campos = computed(() => camposCondiciones(tipo.value, condiciones.value.tipo_salario, condiciones.value.jornada, condiciones.value.medio_pago))
const crear = useAccion(() =>
  agregarContrato(props.entidadId, props.empleadoId, {
    tipo: tipo.value,
    fecha_inicio: inicio.value,
    fecha_fin: campos.value.fechaFin ? fin.value : null,
    descripcion_obra: campos.value.descripcionObra ? obra.value.trim() : null,
    condiciones: limpiarCondiciones({ ...condiciones.value, tipo_salario: tipoSalarioDe(tipo.value, condiciones.value.tipo_salario) }, props.centros.length > 0),
  }),
)

function abrirNuevo() {
  tipo.value = 'termino_indefinido'
  inicio.value = props.hoy
  fin.value = ''
  obra.value = ''
  condiciones.value = condicionesVacias()
  avisoNuevo.value = null
  crear.reiniciar()
  nuevo.value = true
}

async function guardarNuevo() {
  const f = faltantesCondiciones(condiciones.value)
  if (!inicio.value) f.unshift('la fecha de inicio')
  if (campos.value.fechaFin && !fin.value) f.push('la fecha de terminación')
  if (campos.value.descripcionObra && !obra.value.trim()) f.push('la descripción de la obra')
  if (f.length) {
    avisoNuevo.value = `Falta ${f.join(', ')}.`
    return
  }
  const r = await crear.ejecutar()
  if (!r.ok) return
  nuevo.value = false
  await cargar('Contrato nuevo registrado.')
}

async function certificado(conSalario: boolean) {
  errorCertificado.value = null
  descargando.value = conSalario ? 'con' : 'sin'
  try {
    await certificadoLaboral(props.entidadId, props.empleadoId, conSalario)
  } catch (e) {
    errorCertificado.value = mensajeDeError(e)
  } finally {
    descargando.value = null
  }
}

async function cargar(mensaje?: string) {
  if (!ficha.value) estado.value = 'cargando'
  try {
    ficha.value = await pedirEmpleado(props.entidadId, props.empleadoId)
    emit('cambio', ficha.value)
    if (mensaje) resultado.value = mensaje
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(() => cargar())
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
    @reintentar="cargar()"
  />
  <template v-else-if="ficha">
    <header class="encabezado">
      <div>
        <h1 id="titulo-empleados">
          {{ ficha.nombre }}
        </h1>
        <p class="texto-2">
          {{ ficha.codigo }}{{ ficha.documento ? ` · ${documentoLegible(ficha.documento, ficha.tipo_documento ?? 'CC')}` : '' }}
        </p>
      </div>
      <HudInsignia :tono="retirado ? 'neutro' : 'exito'">
        {{ retirado ? 'Retirado' : 'Activo' }}
      </HudInsignia>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

    <div class="botones">
      <HudBoton
        variante="secundario"
        :cargando="descargando === 'sin'"
        @click="certificado(false)"
      >
        <IDescargar aria-hidden="true" /> Certificado laboral
      </HudBoton>
      <HudBoton
        v-if="verSalarios"
        variante="secundario"
        :cargando="descargando === 'con'"
        @click="certificado(true)"
      >
        <IDescargar aria-hidden="true" /> Certificado con salario
      </HudBoton>
      <HudBoton
        v-if="puedeGestionar && retirado"
        @click="abrirNuevo"
      >
        Nuevo contrato
      </HudBoton>
    </div>
    <p
      v-if="errorCertificado"
      class="error"
      role="alert"
    >
      {{ errorCertificado }}
    </p>

    <ContratoEmpleado
      v-for="c in contratos"
      :key="c.contrato.id"
      :entidad-id="entidadId"
      :contrato="c"
      :administradoras="administradoras"
      :centros="centros"
      :hoy="hoy"
      :puede-gestionar="puedeGestionar"
      :ver-salarios="verSalarios"
      @cambio="cargar"
    />

    <DeduccionesEmpleado
      v-if="verSalarios"
      :entidad-id="entidadId"
      :empleado-id="empleadoId"
      :hoy="hoy"
      :puede-gestionar="puedeGestionar"
    />

    <HudDialogo
      v-model:abierto="nuevo"
      titulo="Nuevo contrato"
    >
      <div class="campos">
        <div class="filtros">
          <HudSelector
            v-model="tipo"
            etiqueta="Tipo de contrato"
            :opciones="opcionesDe(TIPO_CONTRATO)"
          />
          <HudFecha
            v-model="inicio"
            etiqueta="Fecha de inicio"
            requerido
          />
          <HudFecha
            v-if="campos.fechaFin"
            v-model="fin"
            etiqueta="Fecha de terminación"
            :minimo="inicio || undefined"
            requerido
          />
          <HudCampo
            v-if="campos.descripcionObra"
            v-model="obra"
            etiqueta="Descripción de la obra o labor"
            requerido
          />
        </div>
        <FormCondiciones
          v-model="condiciones"
          :tipo-contrato="tipo"
          :administradoras="administradoras"
          :centros="centros"
        />
        <p
          v-if="avisoNuevo"
          class="aviso"
          role="alert"
        >
          {{ avisoNuevo }}
        </p>
        <p
          v-if="crear.error.value"
          class="error"
          role="alert"
        >
          {{ crear.error.value }}
        </p>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="nuevo = false"
        >
          Volver
        </HudBoton>
        <HudBoton
          :cargando="crear.cargando.value"
          @click="guardarNuevo"
        >
          Registrar el contrato
        </HudBoton>
      </template>
    </HudDialogo>
  </template>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
