<script setup lang="ts">
/**
 * Asistente de alta de un empleado con su primer contrato: persona (ya registrada en la PH o
 * nueva; si el documento ya existe, el backend usa esa persona) → contrato (tipo y fechas) →
 * condiciones → revisar y crear. Emite la petición lista; el padre llama a la API.
 */
import { computed, ref } from 'vue'
import type { Administradora, NuevoEmpleado, TipoContratoLaboral, TipoDocumento } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { moneda } from '@/formato/decimales'
import { fechaCalendario } from '@/formato/fechas'
import { TIPO_CONTRATO } from '@/formato/nomina'
import { TIPO_DOCUMENTO } from '@/formato/tributario'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudPasos from '@/hud/componentes/HudPasos.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SelectorPersona, { type OpcionPersona } from '@/hud/componentes/SelectorPersona.vue'
import { camposCondiciones, condicionesVacias, faltantesCondiciones, limpiarCondiciones, tipoSalarioDe } from '../reglas'
import FormCondiciones from './FormCondiciones.vue'

const props = withDefaults(
  defineProps<{
    administradoras: Administradora[]
    centros?: { valor: string; etiqueta: string }[]
    /** Búsqueda de personas ya registradas (solo en la PH y con `personas.ver`). */
    buscarPersona?: ((q: string) => Promise<OpcionPersona[]>) | null
    cargando?: boolean
    error?: string | null
  }>(),
  { centros: () => [], buscarPersona: null, cargando: false, error: null },
)
const emit = defineEmits<{ crear: [datos: NuevoEmpleado] }>()

const PASOS = [
  { id: 'persona', texto: 'Persona' },
  { id: 'contrato', texto: 'Contrato' },
  { id: 'condiciones', texto: 'Condiciones' },
  { id: 'revisar', texto: 'Revisar' },
]
const paso = ref('persona')
const aviso = ref<string | null>(null)

const codigo = ref('')
const origen = ref<'nueva' | 'existente'>(props.buscarPersona ? 'existente' : 'nueva')
const elegida = ref<OpcionPersona | null>(null)
const nombre = ref('')
const tipoDocumento = ref<TipoDocumento | ''>('CC')
const documento = ref('')
const correo = ref('')
const telefono = ref('')

const tipo = ref<TipoContratoLaboral>('termino_indefinido')
const inicio = ref('')
const fin = ref('')
const obra = ref('')
const condiciones = ref(condicionesVacias())

const campos = computed(() => camposCondiciones(tipo.value, condiciones.value.tipo_salario, condiciones.value.jornada, condiciones.value.medio_pago))
const nombrePersona = computed(() => (origen.value === 'existente' ? (elegida.value?.nombre ?? '') : nombre.value.trim()))

function faltantes(id: string): string[] {
  const f: string[] = []
  if (id === 'persona') {
    if (!codigo.value.trim()) f.push('el código del empleado')
    if (origen.value === 'existente' && !elegida.value) f.push('la persona')
    if (origen.value === 'nueva' && (!nombre.value.trim() || !documento.value.trim() || !tipoDocumento.value)) f.push('el nombre y el documento')
  }
  if (id === 'contrato') {
    if (!inicio.value) f.push('la fecha de inicio')
    if (campos.value.fechaFin && !fin.value) f.push('la fecha de terminación')
    if (campos.value.fechaFin && fin.value && fin.value <= inicio.value) f.push('una fecha de terminación posterior al inicio')
    if (campos.value.descripcionObra && !obra.value.trim()) f.push('la descripción de la obra')
  }
  if (id === 'condiciones') f.push(...faltantesCondiciones(condiciones.value))
  return f
}

function siguiente() {
  const f = faltantes(paso.value)
  if (f.length) {
    aviso.value = `Falta ${f.join(', ')}.`
    return
  }
  aviso.value = null
  if (paso.value === 'contrato') condiciones.value = { ...condiciones.value, tipo_salario: tipoSalarioDe(tipo.value, condiciones.value.tipo_salario) }
  paso.value = PASOS[PASOS.findIndex((p) => p.id === paso.value) + 1]?.id ?? paso.value
}

function ir(id: string) {
  aviso.value = null
  paso.value = id
}

function crear() {
  const persona =
    origen.value === 'nueva' && tipoDocumento.value
      ? { nombre: nombre.value.trim(), tipo_documento: tipoDocumento.value, documento: documento.value.trim(), correo: correo.value.trim() || null, telefono: telefono.value.trim() || null }
      : null
  emit('crear', {
    codigo: codigo.value.trim(),
    persona_id: origen.value === 'existente' ? (elegida.value?.id ?? null) : null,
    persona,
    contrato: {
      tipo: tipo.value,
      fecha_inicio: inicio.value,
      fecha_fin: campos.value.fechaFin ? fin.value : null,
      descripcion_obra: campos.value.descripcionObra ? obra.value.trim() : null,
      condiciones: limpiarCondiciones(condiciones.value, props.centros.length > 0),
    },
  })
}
</script>

<template>
  <div class="campos">
    <HudPasos
      :pasos="PASOS"
      :actual="paso"
      etiqueta="Pasos del alta"
      @ir="ir"
    />

    <form
      class="campos"
      @submit.prevent="paso === 'revisar' ? crear() : siguiente()"
    >
      <template v-if="paso === 'persona'">
        <HudCampo
          v-model="codigo"
          etiqueta="Código del empleado"
          ayuda="Lo usan las planillas de novedades (p. ej. E-010)."
          requerido
        />
        <div
          v-if="buscarPersona"
          class="botones"
          role="radiogroup"
          aria-label="¿Quién es el empleado?"
        >
          <label class="casilla">
            <input
              v-model="origen"
              type="radio"
              value="existente"
            >
            Ya está registrada en la entidad
          </label>
          <label class="casilla">
            <input
              v-model="origen"
              type="radio"
              value="nueva"
            >
            Es una persona nueva
          </label>
        </div>
        <template v-if="origen === 'existente' && buscarPersona">
          <SelectorPersona
            :buscar="buscarPersona"
            etiqueta="Buscar la persona"
            @elegir="elegida = $event"
          />
          <p
            v-if="elegida"
            class="ok"
            role="status"
          >
            Persona elegida: {{ elegida.nombre }}
          </p>
        </template>
        <div
          v-else
          class="filtros"
        >
          <HudCampo
            v-model="nombre"
            etiqueta="Nombre completo"
            autocompletar="off"
            requerido
          />
          <HudSelector
            v-model="tipoDocumento"
            etiqueta="Tipo de documento"
            :opciones="opcionesDe(TIPO_DOCUMENTO)"
          />
          <HudCampo
            v-model="documento"
            etiqueta="Número de documento"
            modo-entrada="numeric"
            requerido
          />
          <HudCampo
            v-model="correo"
            etiqueta="Correo (para el desprendible)"
            tipo="email"
            modo-entrada="email"
          />
          <HudCampo
            v-model="telefono"
            etiqueta="Teléfono"
            tipo="tel"
          />
        </div>
      </template>

      <div
        v-else-if="paso === 'contrato'"
        class="filtros"
      >
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
          multilinea
          requerido
        />
      </div>

      <FormCondiciones
        v-else-if="paso === 'condiciones'"
        v-model="condiciones"
        :tipo-contrato="tipo"
        :administradoras="administradoras"
        :centros="centros"
      />

      <dl
        v-else
        class="datos"
      >
        <div>
          <dt>Empleado</dt>
          <dd>{{ codigo }} · {{ nombrePersona }}</dd>
        </div>
        <div>
          <dt>Contrato</dt>
          <dd>{{ TIPO_CONTRATO[tipo] }}</dd>
        </div>
        <div>
          <dt>Desde</dt>
          <dd>{{ inicio ? fechaCalendario(inicio) : '—' }}{{ campos.fechaFin && fin ? ` hasta el ${fechaCalendario(fin)}` : '' }}</dd>
        </div>
        <div>
          <dt>Cargo</dt>
          <dd>{{ condiciones.cargo }}</dd>
        </div>
        <div>
          <dt>Salario</dt>
          <dd>{{ condiciones.salario ? moneda(condiciones.salario) : '—' }}</dd>
        </div>
      </dl>

      <p
        v-if="aviso"
        class="aviso"
        role="alert"
      >
        {{ aviso }}
      </p>
      <p
        v-if="error"
        class="error"
        role="alert"
      >
        {{ error }}
      </p>
      <div class="botones">
        <HudBoton
          v-if="paso === 'revisar'"
          tipo="submit"
          :cargando="cargando"
        >
          Crear el empleado
        </HudBoton>
        <HudBoton
          v-else
          tipo="submit"
        >
          Siguiente
        </HudBoton>
      </div>
    </form>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
