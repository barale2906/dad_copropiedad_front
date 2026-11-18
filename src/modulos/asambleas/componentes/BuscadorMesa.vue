<script setup lang="ts">
/**
 * Búsqueda en el padrón por código del bien o documento. «Registrar» inscribe **en un toque** al
 * representante con todos sus bienes libres; «Con poder» registra a otra persona como apoderada
 * de ese bien (con el soporte si la asamblea lo exige).
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import type { CoincidenciaMesa, RegistroAsistente } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useAdjuntos } from '@/composables/useAdjuntos'
import { coeficiente } from '@/formato/decimales'
import HudAdjuntos from '@/hud/componentes/HudAdjuntos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import { buscarEnMesa, registrarAsistente } from '../api'
import { bienesDelRepresentante } from '../reglas'

const props = defineProps<{ entidadId: string; reunionId: string; exigeSoporte: boolean }>()
const emit = defineEmits<{ registrado: [r: RegistroAsistente] }>()

const texto = ref('')
const coincidencias = ref<CoincidenciaMesa[]>([])
const buscando = ref(false)
const errorBusqueda = ref<string | null>(null)
let temporizador: ReturnType<typeof setTimeout> | undefined
let turno = 0

// Registro del representante (un toque)
const registrar = useAccion((clave, c: CoincidenciaMesa) =>
  registrarAsistente(
    props.entidadId,
    props.reunionId,
    { persona_id: c.representante_persona_id, bienes_propios: bienesDelRepresentante(c, coincidencias.value), telefono: c.representante_telefono, metodo: 'mesa' },
    clave,
  ),
)

// Registro con poder
const conPoder = ref<CoincidenciaMesa | null>(null)
const abiertoPoder = ref(false)
const nombre = ref('')
const documento = ref('')
const telefono = ref('')
const soporte = useAdjuntos(() => props.entidadId, 'personal')
const errorPoder = ref<string | null>(null)
const registrarPoder = useAccion((clave) =>
  registrarAsistente(
    props.entidadId,
    props.reunionId,
    {
      nombre: nombre.value.trim(),
      documento: documento.value.trim(),
      telefono: telefono.value.trim() || null,
      poderes: [{ bien_privado_id: conPoder.value?.bien_privado_id ?? '', soporte_archivo_id: soporte.ids()[0] ?? null }],
      metodo: 'mesa',
    },
    clave,
  ),
)

watch(texto, (t) => {
  clearTimeout(temporizador)
  const n = ++turno
  if (t.trim().length < 2) {
    coincidencias.value = []
    return
  }
  buscando.value = true
  temporizador = setTimeout(async () => {
    try {
      const r = await buscarEnMesa(props.entidadId, props.reunionId, t)
      if (n === turno) {
        coincidencias.value = r
        errorBusqueda.value = null
      }
    } catch {
      if (n === turno) errorBusqueda.value = 'No se pudo buscar en el padrón. Intente de nuevo.'
    } finally {
      if (n === turno) buscando.value = false
    }
  }, 300)
})

async function registrarRepresentante(c: CoincidenciaMesa) {
  const r = await registrar.ejecutar(c)
  if (!r.ok) return
  texto.value = ''
  emit('registrado', r.valor)
}

function abrirPoder(c: CoincidenciaMesa) {
  conPoder.value = c
  nombre.value = documento.value = telefono.value = ''
  soporte.limpiar()
  errorPoder.value = null
  registrarPoder.reiniciar()
  abiertoPoder.value = true
}

async function confirmarPoder() {
  errorPoder.value =
    !nombre.value.trim() || !documento.value.trim() ? 'Escriba el nombre y el documento del apoderado.'
      : props.exigeSoporte && !soporte.ids().length ? 'Esta asamblea exige el soporte escrito del poder.'
        : null
  if (errorPoder.value) return
  const r = await registrarPoder.ejecutar()
  if (!r.ok) return
  abiertoPoder.value = false
  texto.value = ''
  emit('registrado', r.valor)
}

onBeforeUnmount(() => clearTimeout(temporizador))
</script>

<template>
  <div class="campos">
    <HudCampo
      v-model="texto"
      etiqueta="Buscar en el padrón"
      tipo="search"
      autocompletar="off"
      ayuda="Código del bien (T1-101) o documento del propietario."
    />
    <p
      v-if="errorBusqueda"
      class="error"
      role="alert"
    >
      {{ errorBusqueda }}
    </p>
    <p
      v-else-if="texto.trim().length >= 2 && !buscando && coincidencias.length === 0"
      class="texto-2"
    >
      Nada coincide en el padrón.
    </p>
    <ul
      v-if="coincidencias.length"
      class="lista"
      aria-label="Coincidencias en el padrón"
    >
      <li
        v-for="c in coincidencias"
        :key="c.bien_privado_id"
      >
        <span class="crece">
          <strong>{{ c.codigo }} · {{ c.representante_nombre ?? 'Sin representante' }}</strong>
          <small>
            Coeficiente {{ coeficiente(c.coeficiente) }}{{ c.otros_bienes.length ? ` · ${c.otros_bienes.length} bien(es) más` : '' }}
          </small>
        </span>
        <HudInsignia
          v-if="c.moroso"
          tono="aviso"
        >
          En mora
        </HudInsignia>
        <HudInsignia
          v-if="c.asistente_actual"
          tono="info"
        >
          Ya registrado
        </HudInsignia>
        <div
          v-else
          class="botones"
        >
          <HudBoton
            v-if="c.representante_persona_id"
            :cargando="registrar.cargando.value"
            @click="registrarRepresentante(c)"
          >
            Registrar<span class="solo-lector"> a {{ c.representante_nombre }} con {{ c.codigo }}</span>
          </HudBoton>
          <HudBoton
            variante="secundario"
            @click="abrirPoder(c)"
          >
            Con poder<span class="solo-lector"> para {{ c.codigo }}</span>
          </HudBoton>
        </div>
      </li>
    </ul>
    <p
      v-if="registrar.error.value"
      class="error"
      role="alert"
    >
      {{ registrar.error.value }}
    </p>

    <HudDialogo
      v-model:abierto="abiertoPoder"
      :titulo="conPoder ? `Apoderado de ${conPoder.codigo}` : ''"
    >
      <form
        id="formulario-poder"
        class="campos"
        novalidate
        @submit.prevent="confirmarPoder"
      >
        <HudCampo
          v-model="nombre"
          etiqueta="Nombre del apoderado"
          autocompletar="off"
        />
        <HudCampo
          v-model="documento"
          etiqueta="Documento del apoderado"
          autocompletar="off"
        />
        <HudCampo
          v-model="telefono"
          etiqueta="Celular (opcional, para votar por WhatsApp)"
          tipo="tel"
          autocompletar="off"
        />
        <div>
          <p class="texto-2">
            Soporte del poder{{ exigeSoporte ? ' (obligatorio)' : ' (opcional)' }}
          </p>
          <HudAdjuntos
            :adjuntos="soporte.adjuntos.value"
            acepta="image/*,application/pdf"
            :subiendo="soporte.subiendo.value"
            @subir="soporte.subir"
            @abrir="soporte.abrir"
            @quitar="soporte.quitar"
          />
        </div>
        <p
          v-if="errorPoder || registrarPoder.error.value || soporte.error.value"
          class="error"
          role="alert"
        >
          {{ errorPoder ?? registrarPoder.error.value ?? soporte.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="abiertoPoder = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-poder"
          :cargando="registrarPoder.cargando.value"
          :deshabilitado="soporte.subiendo.value"
        >
          Registrar apoderado
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped src="../vistas/asambleas.css"></style>
