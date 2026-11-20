<script setup lang="ts">
/**
 * Vincular una organización con la PH: buscar por NIT exacto (para no duplicarla), crearla si no
 * existe (con `organizaciones.crear`) y registrar el contrato de servicio. Emite el contrato.
 */
import { computed, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { ContratoServicio, NaturalezaOrganizacion, TipoOrganizacion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { aUtc } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { buscarOrganizacion, crearContrato, crearOrganizacion } from '../api-organizaciones'
import { NATURALEZA, normalizarNit, TIPO_ORGANIZACION, tiposConocidos } from '@/formato/organizaciones'

const props = defineProps<{ copropiedadId: string }>()
const emit = defineEmits<{ vinculado: [contrato: ContratoServicio]; cancelar: [] }>()

const entidad = useEntidad()
const puedeCrear = computed(() => entidad.tienePermiso('organizaciones.crear'))

const paso = ref<'nit' | 'crear' | 'contrato'>('nit')
const nit = ref('')
const errorNit = ref<string | null>(null)
const buscando = ref(false)
const noExiste = ref(false)
const organizacion = ref<{ id: string; razon_social: string; tipos: TipoOrganizacion[] } | null>(null)

const razonSocial = ref('')
const naturaleza = ref<NaturalezaOrganizacion>('juridica')
const tipos = ref<TipoOrganizacion[]>([])
const correo = ref('')
const telefono = ref('')
const intentadoCrear = ref(false)

const tipoServicio = ref<TipoOrganizacion | ''>('')
const desde = ref('')
const hasta = ref('')
const valor = ref('')
const intentadoContrato = ref(false)

const todosLosTipos = Object.keys(TIPO_ORGANIZACION) as TipoOrganizacion[]
const opcionesNaturaleza = (Object.keys(NATURALEZA) as NaturalezaOrganizacion[]).map((v) => ({ valor: v, etiqueta: NATURALEZA[v] }))
const opcionesServicio = computed(() =>
  (organizacion.value?.tipos.length ? organizacion.value.tipos : todosLosTipos).map((v) => ({ valor: v, etiqueta: TIPO_ORGANIZACION[v] })),
)
const errorCrear = computed(() => {
  if (!intentadoCrear.value) return null
  if (!razonSocial.value.trim()) return 'Escriba la razón social.'
  if (tipos.value.length === 0) return 'Elija al menos un tipo de servicio.'
  return null
})
const errorHasta = computed(() =>
  intentadoContrato.value && hasta.value && desde.value && hasta.value <= desde.value ? 'Debe ser posterior al inicio.' : null,
)

async function buscar() {
  const n = normalizarNit(nit.value)
  errorNit.value = n ? null : 'Escriba un NIT válido, por ejemplo 900.123.456-8.'
  noExiste.value = false
  if (!n) return
  buscando.value = true
  try {
    const o = await buscarOrganizacion(props.copropiedadId, n)
    if (o) elegir({ id: o.id, razon_social: o.razon_social, tipos: tiposConocidos(o.tipos) })
    else noExiste.value = true
  } catch (e) {
    errorNit.value = mensajeDeError(e)
  } finally {
    buscando.value = false
  }
}

function elegir(o: { id: string; razon_social: string; tipos: TipoOrganizacion[] }) {
  organizacion.value = o
  tipoServicio.value = o.tipos[0] ?? ''
  paso.value = 'contrato'
}

const crear = useAccion((clave) =>
  crearOrganizacion(
    props.copropiedadId,
    {
      nit: normalizarNit(nit.value) ?? nit.value,
      razon_social: razonSocial.value.trim(),
      naturaleza: naturaleza.value,
      tipos: tipos.value,
      correo_contacto: correo.value.trim() || null,
      telefono_contacto: telefono.value.trim() || null,
    },
    clave,
  ),
)

async function enviarCrear() {
  intentadoCrear.value = true
  if (errorCrear.value) return
  const r = await crear.ejecutar()
  if (r.ok) elegir({ id: r.valor.id, razon_social: razonSocial.value.trim(), tipos: tipos.value })
}

const contratar = useAccion((clave) =>
  crearContrato(
    props.copropiedadId,
    {
      organizacion_id: organizacion.value?.id ?? '',
      tipo_servicio: tipoServicio.value || 'otro',
      vigente_desde: desde.value ? aUtc(`${desde.value}T00:00`, entidad.zonaHoraria) : null,
      vigente_hasta: hasta.value ? aUtc(`${hasta.value}T00:00`, entidad.zonaHoraria) : null,
      valor: valor.value || null,
    },
    clave,
  ),
)

async function enviarContrato() {
  intentadoContrato.value = true
  if (!tipoServicio.value || errorHasta.value) return
  const r = await contratar.ejecutar()
  if (r.ok) emit('vinculado', r.valor)
}
</script>

<template>
  <div class="vincular">
    <ol
      class="pasos"
      aria-label="Pasos"
    >
      <li :aria-current="paso === 'nit' ? 'step' : undefined">
        1. Buscar por NIT
      </li>
      <li :aria-current="paso === 'crear' ? 'step' : undefined">
        2. Registrar (si no existe)
      </li>
      <li :aria-current="paso === 'contrato' ? 'step' : undefined">
        3. Contrato
      </li>
    </ol>

    <form
      v-if="paso === 'nit'"
      class="campos"
      @submit.prevent="buscar"
    >
      <HudCampo
        v-model="nit"
        etiqueta="NIT de la organización"
        autocompletar="off"
        :error="errorNit"
        ayuda="Se busca exacto para no registrar dos veces la misma organización."
      />
      <div
        v-if="noExiste"
        class="aviso"
        role="status"
      >
        <p>No hay una organización registrada con ese NIT.</p>
        <HudBoton
          v-if="puedeCrear"
          variante="secundario"
          @click="paso = 'crear'"
        >
          Registrarla
        </HudBoton>
        <p v-else>
          Pida a quien tenga el permiso «Crear organizaciones» que la registre.
        </p>
      </div>
      <div class="botones">
        <HudBoton
          variante="fantasma"
          @click="emit('cancelar')"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          :cargando="buscando"
        >
          Buscar
        </HudBoton>
      </div>
    </form>

    <form
      v-else-if="paso === 'crear'"
      class="campos"
      novalidate
      @submit.prevent="enviarCrear"
    >
      <p class="texto-2">
        NIT {{ normalizarNit(nit) }}
      </p>
      <HudCampo
        v-model="razonSocial"
        etiqueta="Razón social"
        requerido
      />
      <HudSelector
        v-model="naturaleza"
        etiqueta="Naturaleza"
        :opciones="opcionesNaturaleza"
      />
      <fieldset>
        <legend>Servicios que presta</legend>
        <label
          v-for="t in todosLosTipos"
          :key="t"
          class="casilla"
        >
          <input
            v-model="tipos"
            type="checkbox"
            :value="t"
          >
          {{ TIPO_ORGANIZACION[t] }}
        </label>
      </fieldset>
      <HudCampo
        v-model="correo"
        etiqueta="Correo de contacto (opcional)"
        tipo="email"
      />
      <HudCampo
        v-model="telefono"
        etiqueta="Teléfono de contacto (opcional)"
        tipo="tel"
      />
      <p
        v-if="errorCrear || crear.error.value"
        class="error"
        role="alert"
      >
        {{ errorCrear ?? crear.error.value }}
      </p>
      <div class="botones">
        <HudBoton
          variante="fantasma"
          @click="paso = 'nit'"
        >
          Volver
        </HudBoton>
        <HudBoton
          tipo="submit"
          :cargando="crear.cargando.value"
        >
          Registrar y continuar
        </HudBoton>
      </div>
    </form>

    <form
      v-else
      class="campos"
      novalidate
      @submit.prevent="enviarContrato"
    >
      <p class="elegida">
        Organización: <strong>{{ organizacion?.razon_social }}</strong>
      </p>
      <HudSelector
        v-model="tipoServicio"
        etiqueta="Servicio contratado"
        vacio="Elija el servicio"
        :opciones="opcionesServicio"
        :error="intentadoContrato && !tipoServicio ? 'Elija el servicio.' : null"
        requerido
      />
      <HudFecha
        v-model="desde"
        etiqueta="Vigente desde (opcional)"
        ayuda="Si lo deja vacío, desde hoy."
      />
      <HudFecha
        v-model="hasta"
        etiqueta="Vigente hasta (opcional)"
        :minimo="desde || undefined"
        :error="errorHasta"
      />
      <HudCampoMonto
        v-model="valor"
        etiqueta="Valor del contrato (opcional)"
      />
      <p
        v-if="contratar.error.value"
        class="error"
        role="alert"
      >
        {{ contratar.error.value }}
      </p>
      <div class="botones">
        <HudBoton
          variante="fantasma"
          @click="paso = 'nit'"
        >
          Volver
        </HudBoton>
        <HudBoton
          tipo="submit"
          :cargando="contratar.cargando.value"
        >
          Vincular
        </HudBoton>
      </div>
    </form>
  </div>
</template>

<style scoped>
.vincular,
.campos {
  display: grid;
  gap: 14px;
}

.pasos {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0;
  padding: 0;
  color: var(--texto-3);
  font-size: 14px;
  list-style: none;
}

.pasos [aria-current='step'] {
  color: var(--cian);
  font-weight: 600;
}

.botones {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.aviso {
  display: grid;
  gap: 8px;
  justify-items: start;
  padding: 10px 14px;
  border-left: 3px solid var(--ambar);
}

.aviso p,
.texto-2,
.elegida,
.error {
  margin: 0;
}

.texto-2 {
  color: var(--texto-2);
}

.error {
  color: var(--magenta);
}

fieldset {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 2px 12px;
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 6px;
  font-weight: 600;
}

.casilla {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
}

.casilla input {
  width: 20px;
  height: 20px;
  accent-color: var(--cian);
}
</style>
