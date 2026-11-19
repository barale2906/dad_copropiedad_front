<script setup lang="ts">
/**
 * Datos de un tercero: identidad (tipo de persona, documento con su dígito de verificación) y
 * datos fiscales (régimen, responsabilidades del RUT, CIIU, dirección, municipio y correo de
 * facturación). Con `tercero` solo se editan los datos fiscales. Genérico: no llama a la API, el
 * padre guarda (`crear` o `fiscal`).
 */
import { computed, ref } from 'vue'
import type { DatosFiscales, NuevoTercero, RegimenIva, ResponsabilidadFiscal, Tercero, TipoDocumento, TipoPersona } from '@/api/tipos'
import { digitoVerificacion, REGIMEN_IVA, RESPONSABILIDAD, TIPO_DOCUMENTO, TIPO_PERSONA } from '@/formato/tributario'
import HudBoton from './HudBoton.vue'
import HudCampo from './HudCampo.vue'
import HudSelector from './HudSelector.vue'

const props = withDefaults(defineProps<{ tercero?: Tercero | null; nombreInicial?: string; cargando?: boolean; error?: string | null }>(), {
  tercero: null,
  nombreInicial: '',
  cargando: false,
  error: null,
})
const emit = defineEmits<{ crear: [datos: NuevoTercero]; fiscal: [datos: DatosFiscales]; cancelar: [] }>()

const opciones = <K extends string>(t: Record<K, string>) => (Object.keys(t) as K[]).map((valor) => ({ valor, etiqueta: t[valor] }))
const f = props.tercero?.fiscal
const tipo = ref<TipoPersona | ''>(props.tercero?.tipo ?? 'juridica')
const nombre = ref(props.tercero?.nombre ?? props.nombreInicial)
const tipoDocumento = ref<TipoDocumento | ''>(props.tercero?.tipo_documento ?? 'NIT')
const documento = ref(props.tercero?.documento ?? '')
const regimen = ref<RegimenIva | ''>(f?.regimen_iva ?? '')
const responsabilidades = ref<ResponsabilidadFiscal[]>([...(f?.responsabilidades ?? [])])
const ciiu = ref(f?.actividad_ciiu ?? '')
const direccion = ref(f?.direccion_fiscal ?? '')
const municipio = ref(f?.municipio_fiscal_dane ?? '')
const correo = ref(f?.correo_facturacion ?? '')
const problema = ref<string | null>(null)

const dv = computed(() => (tipoDocumento.value === 'NIT' ? digitoVerificacion(documento.value) : null))
const ayudaDocumento = computed(() => (dv.value === null ? 'Sin puntos ni dígito de verificación.' : `Dígito de verificación: ${dv.value}.`))

function cambiarTipo(t: TipoPersona | '') {
  tipo.value = t
  tipoDocumento.value = t === 'juridica' ? 'NIT' : 'CC'
}

function fiscales(): DatosFiscales {
  return {
    regimen_iva: regimen.value || null, responsabilidades: responsabilidades.value, actividad_ciiu: ciiu.value.trim() || null,
    direccion_fiscal: direccion.value.trim() || null, municipio_fiscal_dane: municipio.value.trim() || null, correo_facturacion: correo.value.trim() || null,
  }
}

function guardar() {
  if (ciiu.value.trim() && !/^\d{4}$/.test(ciiu.value.trim())) return (problema.value = 'La actividad CIIU lleva cuatro dígitos.')
  if (municipio.value.trim() && !/^\d{5}$/.test(municipio.value.trim())) return (problema.value = 'El municipio va con su código DANE de cinco dígitos.')
  if (correo.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.value.trim())) return (problema.value = 'Revise el correo de facturación.')
  if (props.tercero) {
    problema.value = null
    emit('fiscal', fiscales())
    return
  }
  if (!nombre.value.trim() || !documento.value.trim()) return (problema.value = 'Escriba el nombre y el documento.')
  if (!/^[\dA-Za-z]{3,20}$/.test(documento.value.replace(/[\s.-]/g, ''))) return (problema.value = 'Revise el documento: sin puntos ni guiones.')
  problema.value = null
  emit('crear', {
    tipo: tipo.value || 'juridica', nombre: nombre.value.trim(), tipo_documento: tipoDocumento.value || null, documento: documento.value.replace(/[\s.-]/g, ''), fiscal: fiscales(),
  })
}
</script>

<template>
  <form
    class="formulario-tercero"
    novalidate
    @submit.prevent="guardar"
  >
    <template v-if="!tercero">
      <div class="grilla">
        <HudSelector
          :model-value="tipo"
          etiqueta="Tipo de persona"
          :opciones="opciones(TIPO_PERSONA)"
          @update:model-value="cambiarTipo"
        />
        <HudSelector
          v-model="tipoDocumento"
          etiqueta="Tipo de documento"
          :opciones="opciones(TIPO_DOCUMENTO)"
        />
        <HudCampo
          v-model="documento"
          etiqueta="Documento"
          :ayuda="ayudaDocumento"
        />
      </div>
      <HudCampo
        v-model="nombre"
        :etiqueta="tipo === 'juridica' ? 'Razón social' : 'Nombre completo'"
      />
    </template>
    <fieldset class="grupo">
      <legend>Datos fiscales</legend>
      <div class="grilla">
        <HudSelector
          v-model="regimen"
          etiqueta="Régimen de IVA"
          vacio="Sin definir"
          :opciones="opciones(REGIMEN_IVA)"
        />
        <HudCampo
          v-model="ciiu"
          etiqueta="Actividad CIIU (opcional)"
          modo-entrada="numeric"
        />
        <HudCampo
          v-model="municipio"
          etiqueta="Municipio (código DANE)"
          modo-entrada="numeric"
          ayuda="Ej.: 11001 para Bogotá."
        />
      </div>
      <HudCampo
        v-model="direccion"
        etiqueta="Dirección fiscal"
      />
      <HudCampo
        v-model="correo"
        etiqueta="Correo de facturación"
        tipo="email"
        modo-entrada="email"
      />
      <fieldset class="grupo">
        <legend>Responsabilidades del RUT</legend>
        <label
          v-for="(texto, codigo) in RESPONSABILIDAD"
          :key="codigo"
          class="casilla"
        >
          <input
            v-model="responsabilidades"
            type="checkbox"
            :value="codigo"
          > {{ texto }}
        </label>
      </fieldset>
    </fieldset>
    <p
      v-if="problema ?? error"
      class="error"
      role="alert"
    >
      {{ problema ?? error }}
    </p>
    <div class="botones">
      <HudBoton
        tipo="submit"
        :cargando="cargando"
      >
        {{ tercero ? 'Guardar los datos fiscales' : 'Crear el tercero' }}
      </HudBoton>
      <HudBoton
        variante="fantasma"
        @click="emit('cancelar')"
      >
        Cancelar
      </HudBoton>
    </div>
  </form>
</template>

<style scoped>
.formulario-tercero,
.grupo {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.grupo {
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 6px;
  color: var(--texto-2);
}

.grilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 12px;
}

.casilla {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  cursor: pointer;
}

.casilla input {
  width: 20px;
  height: 20px;
  accent-color: var(--cian);
}

.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.error {
  margin: 0;
  color: var(--magenta);
}
</style>
