<script setup lang="ts">
/**
 * Mascotas (de un bien o de toda la PH): registrar y actualizar vacunas, póliza (obligatoria para
 * las potencialmente peligrosas) y estado. Con `censo.editar`.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { EspecieMascota, EstadoMascota, Mascota } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import SelectorBien from '@/hud/componentes/SelectorBien.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import { editarMascota, mascotas, registrarMascota } from '../api'
import { ESPECIE, ESTADO_MASCOTA } from '../censo'

const props = defineProps<{ bienId?: string }>()

const entidad = useEntidad()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const editable = computed(() => entidad.tienePermiso('censo.editar'))
const hoy = computed(() => hoyEn(entidad.zonaHoraria))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<Mascota[]>([])
const resultado = ref<string | null>(null)

const columnas = computed(() => [
  { clave: 'nombre', titulo: 'Mascota' },
  ...(props.bienId ? [] : [{ clave: 'bien', titulo: 'Bien' }]),
  { clave: 'vacunas', titulo: 'Vacunas y póliza' },
  { clave: 'acciones', titulo: 'Acciones', alinear: 'fin' as const },
])
const opciones = <T extends string>(m: Record<T, string>) => (Object.keys(m) as T[]).map((valor) => ({ valor, etiqueta: m[valor] }))
const buscarBien = async (q: string) => (await bienes.buscar(q)).datos
const vencida = (f: string | null | undefined) => !!f && f < hoy.value

// Formulario (registrar o editar)
const editando = ref<Mascota | null>(null)
const abierto = ref(false)
const bienElegido = ref('')
const especie = ref<EspecieMascota>('perro')
const nombre = ref('')
const raza = ref('')
const peligrosa = ref(false)
const esterilizada = ref(false)
const vacunas = ref('')
const polizaNumero = ref('')
const polizaVence = ref('')
const estadoMascota = ref<EstadoMascota>('activa')
const intentado = ref(false)
const errorForm = computed(() => {
  if (!intentado.value) return null
  if (!editando.value && !props.bienId && !bienElegido.value) return 'Elija el bien.'
  if (!editando.value && !nombre.value.trim()) return 'Escriba el nombre de la mascota.'
  if (peligrosa.value && !polizaNumero.value.trim()) return 'Las mascotas potencialmente peligrosas deben tener póliza (Ley 1801).'
  return null
})
const guardar = useAccion((clave) => {
  const comunes = {
    raza: raza.value.trim() || null,
    potencialmente_peligrosa: peligrosa.value,
    esterilizada: esterilizada.value,
    vacunas_vencen: vacunas.value || null,
    poliza_numero: polizaNumero.value.trim() || null,
    poliza_vence: polizaVence.value || null,
  }
  return editando.value
    ? editarMascota(id.value, editando.value.id, { ...comunes, estado: estadoMascota.value })
    : registrarMascota(id.value, { ...comunes, bien_privado_id: props.bienId ?? bienElegido.value, especie: especie.value, nombre: nombre.value.trim() }, clave)
})

function abrir(m: Mascota | null) {
  editando.value = m
  bienElegido.value = ''
  especie.value = m?.especie ?? 'perro'
  nombre.value = m?.nombre ?? ''
  raza.value = m?.raza ?? ''
  peligrosa.value = m?.potencialmente_peligrosa ?? false
  esterilizada.value = m?.esterilizada ?? false
  vacunas.value = m?.vacunas_vencen ?? ''
  polizaNumero.value = m?.poliza_numero ?? ''
  polizaVence.value = m?.poliza_vence ?? ''
  estadoMascota.value = m?.estado ?? 'activa'
  intentado.value = false
  guardar.reiniciar()
  abierto.value = true
}

async function enviar() {
  intentado.value = true
  if (errorForm.value) return
  const r = await guardar.ejecutar()
  if (!r.ok) return
  abierto.value = false
  const nueva = r.valor
  lista.value = editando.value
    ? lista.value.map((x) => (x.id === nueva.id ? nueva : x)).filter((x) => x.estado === 'activa')
    : [...lista.value, nueva]
  resultado.value = editando.value ? `${nueva.nombre}: datos actualizados.` : `${nueva.nombre} quedó registrada.`
}

watch(lista, (l) => {
  if (!props.bienId) bienes.resolver(l.map((m) => m.bien_privado_id))
})

async function cargar() {
  estado.value = 'cargando'
  try {
    lista.value = await mascotas(id.value, props.bienId)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <div class="panel-censo">
    <div
      v-if="editable"
      class="barra"
    >
      <HudBoton
        variante="secundario"
        @click="abrir(null)"
      >
        <IMas aria-hidden="true" /> Registrar mascota
      </HudBoton>
    </div>
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
    />
    <HudEstado
      v-else-if="estado === 'error'"
      estado="error"
      :mensaje="error ?? undefined"
      @reintentar="cargar"
    />
    <HudEstado
      v-else-if="lista.length === 0"
      estado="vacio"
      mensaje="No hay mascotas registradas."
    />
    <HudTabla
      v-else
      :filas="lista"
      :columnas="columnas"
      clave="id"
      titulo="Mascotas"
    >
      <template #celda-nombre="{ fila }">
        <span class="celda">
          <strong>{{ fila.nombre }}</strong>
          <small>{{ ESPECIE[fila.especie] }}{{ fila.raza ? ` · ${fila.raza}` : '' }}</small>
          <HudInsignia
            v-if="fila.potencialmente_peligrosa"
            tono="aviso"
          >Potencialmente peligrosa</HudInsignia>
        </span>
      </template>
      <template #celda-bien="{ fila }">
        {{ bienes.codigo(fila.bien_privado_id) }}
      </template>
      <template #celda-vacunas="{ fila }">
        <span class="celda">
          <HudInsignia :tono="!fila.vacunas_vencen ? 'aviso' : vencida(fila.vacunas_vencen) ? 'peligro' : 'exito'">
            {{ !fila.vacunas_vencen ? 'Sin registro de vacunas' : `Vacunas ${vencida(fila.vacunas_vencen) ? 'vencidas' : 'al día'} (${fechaCalendario(fila.vacunas_vencen)})` }}
          </HudInsignia>
          <small v-if="fila.poliza_numero">Póliza {{ fila.poliza_numero }}{{ fila.poliza_vence ? ` hasta ${fechaCalendario(fila.poliza_vence)}` : '' }}</small>
        </span>
      </template>
      <template #celda-acciones="{ fila }">
        <HudBoton
          v-if="editable"
          variante="fantasma"
          @click="abrir(fila)"
        >
          Actualizar<span class="solo-lector"> los datos de {{ fila.nombre }}</span>
        </HudBoton>
      </template>
    </HudTabla>

    <HudDialogo
      v-model:abierto="abierto"
      :titulo="editando ? `Actualizar a ${editando.nombre}` : 'Registrar mascota'"
    >
      <div class="campos">
        <SelectorBien
          v-if="!editando && !bienId"
          v-model="bienElegido"
          :buscar="buscarBien"
          :codigo-elegido="bienElegido ? bienes.codigo(bienElegido) : null"
        />
        <form
          id="formulario-mascota"
          class="campos"
          novalidate
          @submit.prevent="enviar"
        >
          <template v-if="!editando">
            <HudSelector
              v-model="especie"
              etiqueta="Especie"
              :opciones="opciones(ESPECIE)"
            />
            <HudCampo
              v-model="nombre"
              etiqueta="Nombre"
              requerido
            />
          </template>
          <HudCampo
            v-model="raza"
            etiqueta="Raza (opcional)"
          />
          <HudFecha
            v-model="vacunas"
            etiqueta="Las vacunas vencen el"
          />
          <label class="casilla">
            <input
              v-model="peligrosa"
              type="checkbox"
            >
            Potencialmente peligrosa
          </label>
          <label class="casilla">
            <input
              v-model="esterilizada"
              type="checkbox"
            >
            Esterilizada
          </label>
          <HudCampo
            v-model="polizaNumero"
            etiqueta="Número de la póliza"
            :ayuda="peligrosa ? 'Obligatoria para las potencialmente peligrosas.' : 'Opcional.'"
          />
          <HudFecha
            v-model="polizaVence"
            etiqueta="La póliza vence el"
          />
          <HudSelector
            v-if="editando"
            v-model="estadoMascota"
            etiqueta="Estado"
            :opciones="opciones(ESTADO_MASCOTA)"
          />
          <p
            v-if="errorForm || guardar.error.value"
            class="error"
            role="alert"
          >
            {{ errorForm ?? guardar.error.value }}
          </p>
        </form>
      </div>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="abierto = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-mascota"
          :cargando="guardar.cargando.value"
        >
          Guardar
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped src="./panel-censo.css"></style>
