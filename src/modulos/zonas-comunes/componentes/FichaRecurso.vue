<script setup lang="ts">
/**
 * Ficha de un recurso con pestañas: datos y política, horario, cobro de las reservas (lo decide
 * el contador) y estado (cerrarlo cancela las reservas futuras). Sin permiso de edición, todo se
 * consulta.
 */
import { computed, onMounted, ref, watch } from 'vue'
import type { CobroRecurso, DestinoCobro, EstadoRecurso, Horario, Recurso } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { usePestana } from '@/composables/usePestana'
import { normalizarHorario, resumirHorario, validarHorario } from '@/formato/horario'
import EditorHorario from '@/hud/componentes/EditorHorario.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { cambiarCobro, cambiarEstadoRecurso, editarRecurso, itemsFacturacion } from '../api'
import { DESTINO_COBRO, ESTADO_RECURSO, resumenPolitica } from '../recursos'
import { useZonasComunes } from '../store'
import FormularioRecurso, { type DatosRecurso } from './FormularioRecurso.vue'

const props = defineProps<{ recurso: Recurso }>()
const emit = defineEmits<{ cambio: [recurso: Recurso] }>()

const entidad = useEntidad()
const zonas = useZonasComunes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const editable = computed(() =>
  props.recurso.tipo === 'parqueadero' ? entidad.tienePermiso('parqueaderos.asignar') : entidad.tienePermiso('bienes_comunes.editar'),
)
const configuraCobro = computed(() => entidad.tienePermiso('cartera.configurar') || entidad.tienePermiso('contabilidad.configurar'))

const PESTANAS = [
  { id: 'datos', texto: 'Datos y política' },
  { id: 'horario', texto: 'Horario' },
  { id: 'cobro', texto: 'Cobro' },
  { id: 'estado', texto: 'Estado' },
] as const
const pestana = usePestana(PESTANAS)

const editando = ref(false)
const mensaje = ref<string | null>(null)

// Datos y política
const guardarDatos = useAccion((_c, d: DatosRecurso) =>
  editarRecurso(id.value, props.recurso.id, {
    nombre: d.nombre,
    ubicacion: d.ubicacion,
    descripcion: d.descripcion,
    politica: d.politica,
    bien_comun: props.recurso.bien_comun && d.categoria ? { ...props.recurso.bien_comun, categoria: d.categoria, reglas: d.reglas } : null,
  }),
)

async function enviarDatos(d: DatosRecurso) {
  const r = await guardarDatos.ejecutar(d)
  if (!r.ok) return
  editando.value = false
  listo(r.valor, 'Datos y política guardados.')
}

// Horario
const horario = ref<Horario>({ franjas: [], excepciones: [] })
const intentadoHorario = ref(false)
const erroresHorario = computed(() => (intentadoHorario.value ? validarHorario(horario.value) : []))
const guardarHorario = useAccion(() => editarRecurso(id.value, props.recurso.id, { horario: normalizarHorario(horario.value) }))

async function enviarHorario() {
  intentadoHorario.value = true
  if (validarHorario(horario.value).length) return
  const r = await guardarHorario.ejecutar()
  if (r.ok) listo(r.valor, 'Horario guardado.')
}

// Cobro
const cobro = ref<CobroRecurso | null>(null)
const destino = ref<DestinoCobro>('manual')
const itemId = ref('')
const items = ref<{ id: string; descripcion: string }[]>([])
const guardarCobro = useAccion(() =>
  cambiarCobro(id.value, props.recurso.id, { destino: destino.value, item_facturacion_id: destino.value === 'factura' ? itemId.value || null : null }),
)
const opcionesDestino = computed(() =>
  (Object.keys(DESTINO_COBRO) as DestinoCobro[])
    .filter((d) => d !== 'factura' || items.value.length > 0 || cobro.value?.destino === 'factura')
    .map((valor) => ({ valor, etiqueta: DESTINO_COBRO[valor].texto })),
)

async function enviarCobro() {
  const r = await guardarCobro.ejecutar()
  if (!r.ok) return
  cobro.value = r.valor
  zonas.recordarCobro(props.recurso.id, r.valor)
  mensaje.value = 'Cobro guardado: rige para las reservas que se aprueben desde ahora.'
}

// Estado
const nuevoEstado = ref<EstadoRecurso>('disponible')
const motivo = ref('')
const cambiarEstado = useAccion(() => cambiarEstadoRecurso(id.value, props.recurso.id, nuevoEstado.value, motivo.value))
const opcionesEstado = (Object.keys(ESTADO_RECURSO) as EstadoRecurso[]).map((valor) => ({ valor, etiqueta: ESTADO_RECURSO[valor].texto }))

async function enviarEstado() {
  const r = await cambiarEstado.ejecutar()
  if (!r.ok) return
  const canceladas = r.valor
  listo({ ...props.recurso, estado: nuevoEstado.value }, canceladas ? `Estado actualizado. Se cancelaron ${canceladas} reservas futuras y se avisó a los solicitantes.` : 'Estado actualizado.')
  motivo.value = ''
}

function listo(r: Recurso, texto: string) {
  zonas.recordarRecurso(r)
  emit('cambio', r)
  mensaje.value = texto
}

watch(
  () => props.recurso,
  (r) => {
    horario.value = { franjas: (r.horario.franjas ?? []).map((f) => ({ ...f })), excepciones: (r.horario.excepciones ?? []).map((x) => ({ ...x })) }
    nuevoEstado.value = r.estado
  },
  { immediate: true },
)
watch(pestana, () => (mensaje.value = null))

onMounted(async () => {
  cobro.value = await zonas.cobroDe(id.value, props.recurso.id)
  destino.value = cobro.value?.destino ?? 'manual'
  itemId.value = cobro.value?.item_facturacion_id ?? ''
  if (configuraCobro.value && entidad.tienePermiso('facturacion.ver')) {
    items.value = await itemsFacturacion(id.value).catch(() => [])
  }
})
</script>

<template>
  <div class="ficha-recurso">
    <div class="cabecera">
      <h2>{{ recurso.nombre }}</h2>
      <HudInsignia :tono="ESTADO_RECURSO[recurso.estado].tono">
        {{ ESTADO_RECURSO[recurso.estado].texto }}
      </HudInsignia>
    </div>
    <HudPestanas
      :pestanas="PESTANAS"
      etiqueta="Secciones del recurso"
    />
    <p
      v-if="mensaje"
      class="ok"
      role="status"
    >
      {{ mensaje }}
    </p>

    <template v-if="pestana === 'datos'">
      <FormularioRecurso
        v-if="editando"
        :recurso="recurso"
        :cargando="guardarDatos.cargando.value"
        :error="guardarDatos.error.value"
        @enviar="enviarDatos"
        @cancelar="editando = false"
      />
      <HudPanel
        v-else
        etiqueta="Política"
      >
        <p
          v-if="recurso.descripcion"
          class="texto-2"
        >
          {{ recurso.descripcion }}
        </p>
        <ul class="lista">
          <li
            v-for="l in resumenPolitica(recurso.politica)"
            :key="l"
          >
            {{ l }}
          </li>
        </ul>
        <HudBoton
          v-if="editable"
          variante="secundario"
          @click="editando = true"
        >
          Editar datos y política
        </HudBoton>
      </HudPanel>
    </template>

    <HudPanel
      v-else-if="pestana === 'horario'"
      etiqueta="Horario de atención"
    >
      <template v-if="editable">
        <EditorHorario v-model="horario" />
        <ul
          v-if="erroresHorario.length"
          class="error"
          role="alert"
        >
          <li
            v-for="e in erroresHorario"
            :key="e"
          >
            {{ e }}
          </li>
        </ul>
        <p
          v-if="guardarHorario.error.value"
          class="error"
          role="alert"
        >
          {{ guardarHorario.error.value }}
        </p>
        <HudBoton
          :cargando="guardarHorario.cargando.value"
          @click="enviarHorario"
        >
          Guardar horario
        </HudBoton>
      </template>
      <ul
        v-else
        class="lista"
      >
        <li
          v-for="l in resumirHorario(recurso.horario)"
          :key="l"
        >
          {{ l }}
        </li>
      </ul>
    </HudPanel>

    <HudPanel
      v-else-if="pestana === 'cobro'"
      etiqueta="Cómo se cobran las reservas"
    >
      <template v-if="configuraCobro">
        <form
          class="campos"
          @submit.prevent="enviarCobro"
        >
          <HudSelector
            v-model="destino"
            etiqueta="Cobro"
            :opciones="opcionesDestino"
            :ayuda="DESTINO_COBRO[destino].ayuda"
          />
          <HudSelector
            v-if="destino === 'factura'"
            v-model="itemId"
            etiqueta="Ítem de facturación"
            vacio="Elija el ítem"
            :opciones="items.map((i) => ({ valor: i.id, etiqueta: i.descripcion }))"
          />
          <p
            v-if="guardarCobro.error.value"
            class="error"
            role="alert"
          >
            {{ guardarCobro.error.value }}
          </p>
          <HudBoton
            tipo="submit"
            :cargando="guardarCobro.cargando.value"
          >
            Guardar cobro
          </HudBoton>
        </form>
      </template>
      <p v-else-if="cobro">
        {{ DESTINO_COBRO[cobro.destino].texto }}: {{ DESTINO_COBRO[cobro.destino].ayuda }}
      </p>
      <p
        v-else
        class="texto-2"
      >
        No se pudo consultar cómo se cobra este recurso.
      </p>
    </HudPanel>

    <HudPanel
      v-else
      etiqueta="Estado del recurso"
    >
      <form
        v-if="editable"
        class="campos"
        @submit.prevent="enviarEstado"
      >
        <HudSelector
          v-model="nuevoEstado"
          etiqueta="Estado"
          :opciones="opcionesEstado"
        />
        <p
          v-if="nuevoEstado !== 'disponible' && recurso.estado === 'disponible'"
          class="aviso"
        >
          Al cerrarlo se cancelan sus reservas futuras y se avisa a los solicitantes.
        </p>
        <HudCampo
          v-model="motivo"
          etiqueta="Motivo (opcional)"
          ayuda="Lo verán quienes tenían reservas."
        />
        <p
          v-if="cambiarEstado.error.value"
          class="error"
          role="alert"
        >
          {{ cambiarEstado.error.value }}
        </p>
        <HudBoton
          tipo="submit"
          :cargando="cambiarEstado.cargando.value"
          :deshabilitado="nuevoEstado === recurso.estado"
        >
          Cambiar estado
        </HudBoton>
      </form>
      <p v-else>
        {{ ESTADO_RECURSO[recurso.estado].texto }}
      </p>
    </HudPanel>
  </div>
</template>

<style scoped>
.ficha-recurso,
.campos {
  display: grid;
  gap: 14px;
}

.campos {
  justify-items: start;
}

.campos > * {
  width: 100%;
}

.campos > :last-child {
  width: auto;
}

.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: clamp(22px, 3vw, 28px);
}

.lista {
  display: grid;
  gap: 4px;
  margin: 0 0 12px;
  padding-left: 18px;
}

.texto-2 {
  color: var(--texto-2);
}

.ok,
.aviso,
.error {
  margin: 0;
}

.ok {
  padding: 10px 14px;
  border-left: 3px solid var(--verde);
  background: color-mix(in srgb, var(--verde) 10%, transparent);
}

.aviso {
  color: var(--ambar);
}

.error {
  color: var(--magenta);
}
</style>
