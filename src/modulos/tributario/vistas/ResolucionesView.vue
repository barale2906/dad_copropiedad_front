<script setup lang="ts">
/**
 * Resoluciones de numeración de la DIAN (prefijo, rango y vigencia), con su estado a hoy;
 * activar o desactivar y registrar una nueva. La clave técnica se escribe y no vuelve: se indica
 * solo si está registrada.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { NuevaResolucion, Resolucion, TipoNumeracion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { opcionesDe } from '@/composables/textos-acceso'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import IMas from '~icons/tabler/plus'
import { activarResolucion, crearResolucion, resoluciones as pedirResoluciones } from '../api'
import { ESTADO_RESOLUCION, estadoResolucion, problemaResolucion, TIPO_NUMERACION } from '../reglas'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const configura = computed(() => entidad.tienePermiso('tributario.configurar'))
const hoy = hoyEn(entidad.zonaHoraria)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<Resolucion[]>([])
const resultado = ref<string | null>(null)

const abierto = ref(false)
const tipo = ref<TipoNumeracion | ''>('factura')
const prefijo = ref('')
const desde = ref('1')
const hasta = ref('')
const numero = ref('')
const fecha = ref(hoy)
const vigenteDesde = ref(hoy)
const vigenteHasta = ref('')
const clave = ref('')
const problema = ref<string | null>(null)

const peticion = (): NuevaResolucion => ({
  tipo: tipo.value || 'factura', prefijo: prefijo.value.trim().toUpperCase(), desde: Number.parseInt(desde.value, 10) || 0, hasta: Number.parseInt(hasta.value, 10) || 0,
  numero_resolucion: numero.value.trim(), fecha_resolucion: fecha.value, vigente_desde: vigenteDesde.value, vigente_hasta: vigenteHasta.value, clave_tecnica: clave.value.trim() || null,
})
const crear = useAccion(() => crearResolucion(id.value, peticion()))
const activar = useAccion((_c, r: Resolucion) => activarResolucion(id.value, r.id, !r.activa))

async function alCrear() {
  problema.value = problemaResolucion(peticion())
  if (problema.value) return
  const r = await crear.ejecutar()
  if (!r.ok) return
  abierto.value = false
  clave.value = ''
  resultado.value = `Resolución ${r.valor.numero_resolucion} registrada (${r.valor.tiene_clave_tecnica ? 'con' : 'sin'} clave técnica). Actívela para usarla.`
  await cargar()
}

async function alternar(r: Resolucion) {
  if (!(await activar.ejecutar(r)).ok) return
  resultado.value = `Resolución ${r.prefijo} ${r.activa ? 'desactivada' : 'activada'}.`
  await cargar()
}

async function cargar() {
  try {
    lista.value = await pedirResoluciones(id.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-resoluciones">
    <header class="encabezado">
      <h1 id="titulo-resoluciones">
        Resoluciones de numeración
      </h1>
      <HudBoton
        v-if="configura"
        @click="abierto = true"
      >
        <IMas aria-hidden="true" /> Nueva resolución
      </HudBoton>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <p
      v-if="activar.error.value"
      class="error"
      role="alert"
    >
      {{ activar.error.value }}
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
      v-else-if="!lista.length"
      estado="vacio"
      mensaje="Todavía no hay resoluciones de numeración."
    />
    <ul
      v-else
      class="lista"
      aria-label="Resoluciones"
    >
      <li
        v-for="r in lista"
        :key="r.id"
      >
        <span class="crece">
          <strong>{{ TIPO_NUMERACION[r.tipo] }} · {{ r.prefijo || 'sin prefijo' }} {{ r.desde }} a {{ r.hasta }}</strong>
          <small>Resolución {{ r.numero_resolucion }} del {{ fechaCalendario(r.fecha_resolucion) }} · vigente del {{ fechaCalendario(r.vigente_desde) }} al {{ fechaCalendario(r.vigente_hasta) }}</small>
          <small>{{ r.tiene_clave_tecnica ? 'Clave técnica registrada' : 'Sin clave técnica' }}</small>
        </span>
        <HudInsignia :tono="ESTADO_RESOLUCION[estadoResolucion(r, hoy)].tono">
          {{ ESTADO_RESOLUCION[estadoResolucion(r, hoy)].texto }}
        </HudInsignia>
        <HudBoton
          v-if="configura && estadoResolucion(r, hoy) !== 'vencida'"
          variante="fantasma"
          :cargando="activar.cargando.value"
          @click="alternar(r)"
        >
          {{ r.activa ? 'Desactivar' : 'Activar' }}<span class="solo-lector"> la resolución {{ r.numero_resolucion }}</span>
        </HudBoton>
      </li>
    </ul>
    <HudDialogo
      v-model:abierto="abierto"
      titulo="Nueva resolución de numeración"
    >
      <form
        id="form-resolucion"
        class="campos"
        @submit.prevent="alCrear"
      >
        <HudSelector
          v-model="tipo"
          etiqueta="Documento que numera"
          :opciones="opcionesDe(TIPO_NUMERACION)"
        />
        <div class="filtros">
          <HudCampo
            v-model="prefijo"
            etiqueta="Prefijo"
          />
          <HudCampo
            v-model="desde"
            etiqueta="Desde el número"
            modo-entrada="numeric"
          />
          <HudCampo
            v-model="hasta"
            etiqueta="Hasta el número"
            modo-entrada="numeric"
          />
        </div>
        <div class="filtros">
          <HudCampo
            v-model="numero"
            etiqueta="Número de la resolución"
            modo-entrada="numeric"
          />
          <HudFecha
            v-model="fecha"
            etiqueta="Fecha de la resolución"
          />
          <HudFecha
            v-model="vigenteDesde"
            etiqueta="Vigente desde"
          />
          <HudFecha
            v-model="vigenteHasta"
            etiqueta="Vigente hasta"
          />
        </div>
        <HudCampo
          v-model="clave"
          etiqueta="Clave técnica (opcional)"
          tipo="password"
          autocompletar="off"
          ayuda="La entrega la DIAN. Se guarda cifrada y no se vuelve a mostrar."
        />
        <p
          v-if="problema ?? crear.error.value"
          class="error"
          role="alert"
        >
          {{ problema ?? crear.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="abierto = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="form-resolucion"
          :cargando="crear.cargando.value"
        >
          Registrar la resolución
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="./tributario.css"></style>
