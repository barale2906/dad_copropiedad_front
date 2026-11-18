<script setup lang="ts">
/**
 * Mesa de registro (tableta): buscar en el padrón y registrar en un toque, apoderados con su
 * soporte, salidas y reingresos, rótulos Code 128 y poderes por revisar. Sin `:id` lista las
 * reuniones con el registro abierto.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { Asistente, DetalleReunion, RegistroAsistente } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { useRefresco } from '@/composables/useRefresco'
import { fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import IImprimir from '~icons/tabler/printer'
import { asistentes, detalleReunion, imprimirRotulos, listarReuniones } from '../api'
import BuscadorMesa from '../componentes/BuscadorMesa.vue'
import ListaAsistentes from '../componentes/ListaAsistentes.vue'
import PoderesPendientes from '../componentes/PoderesPendientes.vue'
import { ESTADO_REUNION, mesaAbierta } from '../reglas'

const route = useRoute()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const reunionId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (accion: string, r = '') => ({ name: 'modulo', params: { ...route.params, accion, id: r }, query: {} })

// Sin reunión elegida: las que tienen la mesa abierta.
const abiertas = useListado(async (despues) => {
  const p = await listarReuniones(id.value, despues)
  return { ...p, datos: p.datos.filter((r) => mesaAbierta(r.estado)) }
}, { inmediato: !reunionId.value })

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const detalle = ref<DetalleReunion | null>(null)
const lista = ref<Asistente[]>([])
const resultado = ref<string | null>(null)
const avisos = ref<string[]>([])
const poderesRef = ref<InstanceType<typeof PoderesPendientes> | null>(null)
const reunion = computed(() => detalle.value?.reunion ?? null)
const codigos = computed(() => Object.fromEntries(lista.value.flatMap((a) => a.bienes.map((b) => [b.bien_privado_id, b.codigo]))))

// Rótulos
const imprimiendo = ref(false)
const prefijo = ref('ASM')
const desde = ref('1')
const cantidad = ref('50')
const rotulos = useAccion(() => imprimirRotulos(id.value, prefijo.value.trim().toUpperCase(), parseInt(desde.value, 10), parseInt(cantidad.value, 10)))

async function registrado(r: RegistroAsistente) {
  resultado.value = `${r.asistente.nombre} registrado con ${r.asistente.bienes.length} bien(es).`
  avisos.value = r.avisos
  await Promise.all([recargarAsistentes(), poderesRef.value?.cargar()])
}

async function cambio(texto: string) {
  resultado.value = texto
  avisos.value = []
  await recargarAsistentes()
}

async function imprimir() {
  if ((await rotulos.ejecutar()).ok) imprimiendo.value = false
}

async function recargarAsistentes() {
  try {
    lista.value = await asistentes(id.value, reunionId.value)
  } catch (e) {
    error.value = mensajeDeError(e)
  }
}

async function cargar() {
  if (!reunionId.value) return
  try {
    const [d, a] = await Promise.all([detalleReunion(id.value, reunionId.value), asistentes(id.value, reunionId.value)])
    detalle.value = d
    lista.value = a
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

// Varias mesas registran a la vez: la lista se refresca sola.
useRefresco(() => (reunionId.value && estado.value === 'listo' ? recargarAsistentes() : undefined), { cada: 20_000 })
watch(reunionId, () => {
  estado.value = 'cargando'
  resultado.value = null
  void cargar()
}, { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-mesa">
    <template v-if="reunionId">
      <HudEstado
        v-if="estado === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="estado === 'error' || !reunion"
        estado="error"
        :mensaje="error ?? undefined"
        @reintentar="cargar"
      />
      <template v-else>
        <header class="encabezado">
          <div>
            <small>Mesa de registro</small>
            <h1 id="titulo-mesa">
              {{ reunion.titulo }}
            </h1>
          </div>
          <div class="botones">
            <HudInsignia :tono="ESTADO_REUNION[reunion.estado].tono">
              {{ ESTADO_REUNION[reunion.estado].texto }}
            </HudInsignia>
            <HudBoton
              variante="secundario"
              @click="imprimiendo = true"
            >
              <IImprimir aria-hidden="true" /> Imprimir rótulos
            </HudBoton>
          </div>
        </header>
        <p
          v-if="!mesaAbierta(reunion.estado)"
          class="aviso"
        >
          El registro no está abierto: se abre desde «Conducir» cuando empieza la asamblea.
        </p>
        <p
          v-if="resultado"
          class="ok"
          role="status"
        >
          {{ resultado }}
        </p>
        <ul
          v-if="avisos.length"
          class="lista"
          aria-label="Avisos del registro"
        >
          <li
            v-for="(a, i) in avisos"
            :key="i"
            class="urgente"
          >
            {{ a }}
          </li>
        </ul>

        <HudPanel
          v-if="mesaAbierta(reunion.estado)"
          etiqueta="Registrar"
          resaltado
        >
          <BuscadorMesa
            :entidad-id="id"
            :reunion-id="reunion.id"
            :exige-soporte="reunion.configuracion.exigir_soporte_poder ?? false"
            @registrado="registrado"
          />
        </HudPanel>
        <HudPanel etiqueta="Asistentes">
          <ListaAsistentes
            :entidad-id="id"
            :reunion-id="reunion.id"
            :asistentes="lista"
            @cambio="cambio"
          />
        </HudPanel>
        <HudPanel etiqueta="Poderes">
          <PoderesPendientes
            ref="poderesRef"
            :entidad-id="id"
            :reunion-id="reunion.id"
            :codigos="codigos"
            @cambio="cambio"
          />
        </HudPanel>

        <HudDialogo
          v-model:abierto="imprimiendo"
          titulo="Imprimir rótulos"
        >
          <form
            id="formulario-rotulos"
            class="campos"
            @submit.prevent="imprimir"
          >
            <p class="texto-2">
              Hoja en PDF con rótulos Code 128 para recortar y entregar a quienes votan en papel.
            </p>
            <HudCampo
              v-model="prefijo"
              etiqueta="Prefijo"
              autocompletar="off"
            />
            <div class="filtros">
              <HudCampo
                v-model="desde"
                etiqueta="Desde el número"
                modo-entrada="numeric"
              />
              <HudCampo
                v-model="cantidad"
                etiqueta="Cantidad"
                modo-entrada="numeric"
              />
            </div>
            <p
              v-if="rotulos.error.value"
              class="error"
              role="alert"
            >
              {{ rotulos.error.value }}
            </p>
          </form>
          <template #acciones>
            <HudBoton
              variante="fantasma"
              @click="imprimiendo = false"
            >
              Cancelar
            </HudBoton>
            <HudBoton
              tipo="submit"
              form="formulario-rotulos"
              :cargando="rotulos.cargando.value"
            >
              Descargar PDF
            </HudBoton>
          </template>
        </HudDialogo>
      </template>
    </template>

    <template v-else>
      <h1 id="titulo-mesa">
        Mesa de registro
      </h1>
      <HudEstado
        v-if="abiertas.estado.value === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="abiertas.estado.value === 'error'"
        estado="error"
        :mensaje="abiertas.error.value ?? undefined"
        @reintentar="abiertas.recargar()"
      />
      <HudEstado
        v-else-if="abiertas.filas.value.length === 0"
        estado="vacio"
        mensaje="No hay asambleas con el registro abierto."
      />
      <ul
        v-else
        class="lista"
        aria-label="Asambleas con el registro abierto"
      >
        <li
          v-for="r in abiertas.filas.value"
          :key="r.id"
        >
          <HudInsignia :tono="ESTADO_REUNION[r.estado].tono">
            {{ ESTADO_REUNION[r.estado].texto }}
          </HudInsignia>
          <span class="crece">
            <RouterLink
              :to="ruta('registro', r.id)"
              class="fila"
            ><strong>{{ r.titulo }}</strong></RouterLink>
            <small>{{ fechaHora(r.fecha_programada, zona) }}</small>
          </span>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped src="./asambleas.css"></style>
<style scoped>
.lista :deep(.hud-boton) {
  min-height: 48px;
}
</style>
