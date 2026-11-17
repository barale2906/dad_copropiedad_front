<script setup lang="ts">
/**
 * Política de tratamiento de datos: la vigente, sus versiones y publicar una nueva (texto,
 * PDF o ambos). Las autorizaciones anteriores conservan la versión bajo la que se dieron.
 */
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { abrirArchivo, subirArchivo } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { Politica } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { aUtc, fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import { politicas, publicarPolitica } from '../api-proteccion'

const props = defineProps<{ copropiedadId: string }>()

const entidad = useEntidad()
const selector = useTemplateRef<HTMLInputElement>('selector')

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const versiones = ref<Politica[]>([])
const publicando = ref(false)
const texto = ref('')
const archivo = ref<File | null>(null)
const desde = ref('')
const intentado = ref(false)
const errorAbrir = ref<string | null>(null)

/** La vigente es la más reciente que ya empezó a regir. */
const vigente = computed(() => versiones.value.find((v) => Date.parse(v.vigente_desde) <= Date.now()) ?? null)
const errorContenido = computed(() =>
  intentado.value && !texto.value.trim() && !archivo.value ? 'Escriba el texto de la política o adjunte el PDF.' : null,
)

const publicar = useAccion(async (clave) => {
  const archivoId = archivo.value ? (await subirArchivo(props.copropiedadId, archivo.value, 'publico')).id : null
  return publicarPolitica(
    props.copropiedadId,
    {
      texto: texto.value.trim() || null,
      archivo_id: archivoId,
      vigente_desde: desde.value ? aUtc(desde.value, entidad.zonaHoraria) : null,
    },
    clave,
  )
})

function abrirPublicar() {
  texto.value = desde.value = ''
  archivo.value = null
  intentado.value = false
  publicar.reiniciar()
  publicando.value = true
}

function elegido(e: Event) {
  archivo.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function enviar() {
  intentado.value = true
  if (errorContenido.value) return
  const r = await publicar.ejecutar()
  if (!r.ok) return
  versiones.value = [r.valor, ...versiones.value]
  publicando.value = false
}

async function abrir(id: string) {
  errorAbrir.value = null
  try {
    await abrirArchivo(props.copropiedadId, id)
  } catch (e) {
    errorAbrir.value = mensajeDeError(e)
  }
}

async function cargar() {
  estado.value = 'cargando'
  try {
    versiones.value = await politicas(props.copropiedadId)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <div class="politica">
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
      <p
        v-if="!vigente"
        class="alerta"
        role="alert"
      >
        Aún no hay una política vigente: sin ella no se pueden registrar autorizaciones.
      </p>
      <ol
        v-if="versiones.length"
        class="versiones"
        aria-label="Versiones de la política"
      >
        <li
          v-for="v in versiones"
          :key="v.id"
        >
          <div class="cabecera">
            <strong>Versión {{ v.version }}</strong>
            <HudInsignia
              v-if="v.id === vigente?.id"
              tono="exito"
            >
              Vigente
            </HudInsignia>
            <HudInsignia
              v-else-if="Date.parse(v.vigente_desde) > Date.now()"
              tono="info"
            >
              Programada
            </HudInsignia>
            <small>Rige desde {{ fechaHora(v.vigente_desde, entidad.zonaHoraria) }}</small>
          </div>
          <details v-if="v.texto">
            <summary>Leer el texto<span class="solo-lector"> de la versión {{ v.version }}</span></summary>
            <p class="texto">
              {{ v.texto }}
            </p>
          </details>
          <HudBoton
            v-if="v.archivo_id"
            variante="fantasma"
            @click="abrir(v.archivo_id)"
          >
            Abrir el PDF<span class="solo-lector"> de la versión {{ v.version }}</span>
          </HudBoton>
        </li>
      </ol>
      <p
        v-if="errorAbrir"
        class="error"
        role="alert"
      >
        {{ errorAbrir }}
      </p>
      <HudBoton @click="abrirPublicar">
        <IMas aria-hidden="true" /> Publicar versión nueva
      </HudBoton>
    </template>

    <HudDialogo
      v-model:abierto="publicando"
      titulo="Publicar versión nueva"
    >
      <p class="ayuda">
        Las autorizaciones ya otorgadas conservan la versión bajo la que se dieron.
      </p>
      <form
        id="formulario-politica"
        class="campos"
        novalidate
        @submit.prevent="enviar"
      >
        <HudCampo
          v-model="texto"
          etiqueta="Texto de la política"
          multilinea
          :error="errorContenido"
        />
        <div class="archivo">
          <input
            ref="selector"
            type="file"
            accept="application/pdf"
            class="solo-lector"
            tabindex="-1"
            aria-hidden="true"
            @change="elegido"
          >
          <HudBoton
            variante="secundario"
            @click="selector?.click()"
          >
            {{ archivo ? 'Cambiar PDF' : 'Adjuntar PDF (opcional)' }}
          </HudBoton>
          <span
            v-if="archivo"
            class="texto-2"
          >{{ archivo.name }}</span>
        </div>
        <HudFecha
          v-model="desde"
          etiqueta="Rige desde (opcional)"
          con-hora
          ayuda="Si lo deja vacío, rige desde ahora."
        />
        <p
          v-if="publicar.error.value"
          class="error"
          role="alert"
        >
          {{ publicar.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="publicando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-politica"
          :cargando="publicar.cargando.value"
        >
          Publicar
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped>
.politica {
  display: grid;
  gap: 12px;
  justify-items: start;
}

.versiones {
  display: grid;
  gap: 10px;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.versiones li {
  display: grid;
  gap: 6px;
  justify-items: start;
  padding: 10px 14px;
  border: 1px solid var(--linea);
  background: var(--superficie);
}

.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

small,
.ayuda,
.texto-2 {
  color: var(--texto-2);
}

.ayuda,
.error,
.alerta {
  margin: 0;
}

.texto {
  margin: 6px 0 0;
  white-space: pre-wrap;
}

summary {
  min-height: 40px;
  padding: 8px 0;
  color: var(--cian);
  cursor: pointer;
}

.campos {
  display: grid;
  gap: 14px;
}

.archivo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.error {
  color: var(--magenta);
}

.alerta {
  padding: 10px 14px;
  border-left: 3px solid var(--ambar);
  background: color-mix(in srgb, var(--ambar) 10%, transparent);
}
</style>
