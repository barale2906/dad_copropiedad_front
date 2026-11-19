<script setup lang="ts">
/**
 * Información exógena: por año, los formatos vigentes del catálogo; generar uno da el CSV de
 * preparación (separado por `;`) con su huella SHA-256 y los terceros con datos por corregir.
 * Cada generación queda con su versión.
 */
import { computed, ref, watch } from 'vue'
import { guardarBlob } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { ExogenaGenerada, FormatoExogena, GeneracionExogena } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { moneda } from '@/formato/decimales'
import { fechaHora, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useEntidad } from '@/stores/entidad'
import { catalogo, generacionesExogena, generarExogena } from '../api'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const actual = Number(hoyEn(zona.value).slice(0, 4))
const anio = ref(String(actual - 1))
const opcionesAnio = [actual, actual - 1, actual - 2].map((a) => ({ valor: String(a), etiqueta: String(a) }))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const formatos = ref<FormatoExogena[]>([])
const historial = ref<GeneracionExogena[]>([])
const ultima = ref<ExogenaGenerada | null>(null)
const generar = useAccion((_c, f: FormatoExogena) => generarExogena(id.value, f.id))
const nombreFormato = (fid: string) => {
  const f = formatos.value.find((x) => x.id === fid)
  return f ? `${f.codigo} · ${f.nombre}` : 'Formato'
}

function descargar(g: ExogenaGenerada) {
  const f = formatos.value.find((x) => x.id === g.generacion.formato_id)
  guardarBlob(new Blob([g.csv], { type: 'text/csv;charset=utf-8' }), `exogena-${f?.codigo ?? 'formato'}-${g.generacion.anio}-v${g.generacion.version}.csv`)
}

async function alGenerar(f: FormatoExogena) {
  const r = await generar.ejecutar(f)
  if (!r.ok) return
  ultima.value = r.valor
  historial.value = await generacionesExogena(id.value, Number(anio.value))
}

async function cargar() {
  estado.value = 'cargando'
  ultima.value = null
  try {
    const [c, h] = await Promise.all([catalogo(id.value), generacionesExogena(id.value, Number(anio.value))])
    formatos.value = c.formatos_exogena.filter((f) => f.anio === Number(anio.value))
    historial.value = h
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(anio, cargar, { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-exogena">
    <h1 id="titulo-exogena">
      Información exógena
    </h1>
    <div class="filtros">
      <HudSelector
        v-model="anio"
        etiqueta="Año gravable"
        :opciones="opcionesAnio"
      />
    </div>
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
      <div
        v-if="ultima"
        class="ok"
        role="status"
      >
        <p>
          {{ nombreFormato(ultima.generacion.formato_id) }}, versión {{ ultima.generacion.version }}: {{ ultima.generacion.filas }} filas por {{ moneda(ultima.generacion.total) }}.
        </p>
        <p>Huella SHA-256: <code class="huella">{{ ultima.generacion.sha256 }}</code></p>
      </div>
      <ul
        v-if="ultima?.errores.length"
        class="lista"
        aria-label="Terceros con datos por corregir"
      >
        <li
          v-for="e in ultima.errores"
          :key="e"
          class="aviso"
        >
          {{ e }}
        </li>
      </ul>
      <HudBoton
        v-if="ultima"
        variante="secundario"
        @click="descargar(ultima)"
      >
        Descargar el CSV
      </HudBoton>
      <p
        v-if="generar.error.value"
        class="error"
        role="alert"
      >
        {{ generar.error.value }}
      </p>
      <HudPanel :etiqueta="`Formatos de ${anio}`">
        <HudEstado
          v-if="!formatos.length"
          estado="vacio"
          mensaje="El catálogo no tiene formatos para ese año."
        />
        <ul
          v-else
          class="lista"
          aria-label="Formatos de exógena"
        >
          <li
            v-for="f in formatos"
            :key="f.id"
          >
            <span class="crece">
              <strong>{{ f.codigo }} · {{ f.nombre }}</strong>
              <small>{{ f.resolucion }} · cuantía menor {{ moneda(f.cuantia_menor) }} (se agrega en el NIT 222222222)</small>
            </span>
            <HudBoton
              :cargando="generar.cargando.value"
              @click="alGenerar(f)"
            >
              Generar<span class="solo-lector"> el formato {{ f.codigo }}</span>
            </HudBoton>
          </li>
        </ul>
      </HudPanel>
      <HudPanel etiqueta="Generaciones">
        <HudEstado
          v-if="!historial.length"
          estado="vacio"
          mensaje="Todavía no se ha generado ningún formato de ese año."
        />
        <ul
          v-else
          class="lista"
          aria-label="Generaciones de exógena"
        >
          <li
            v-for="g in historial"
            :key="g.id"
          >
            <span class="crece">
              <strong>{{ nombreFormato(g.formato_id) }} · versión {{ g.version }}</strong>
              <small>{{ fechaHora(g.generada_en, zona) }} · {{ g.filas }} filas · {{ moneda(g.total) }}{{ g.errores ? ` · ${g.errores} tercero(s) por corregir` : '' }}</small>
            </span>
          </li>
        </ul>
      </HudPanel>
    </template>
  </section>
</template>

<style scoped src="./tributario.css"></style>
<style scoped>
.ok p {
  margin: 0;
}

.huella {
  overflow-wrap: anywhere;
  font-family: var(--fuente-mono);
}
</style>
