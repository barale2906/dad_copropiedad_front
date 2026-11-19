<script setup lang="ts">
/**
 * Beneficiarios finales (RUB): registrar por criterio (propiedad con participación de 5 % o más,
 * control o beneficio) y terminar la vigencia de uno. Se reportan a la DIAN.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Beneficiario, CriterioBeneficiario } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useBuscarTerceros } from '@/composables/useBuscarTerceros'
import { opcionesDe } from '@/composables/textos-acceso'
import { fechaCalendario, hoyEn } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import type { OpcionPersona } from '@/hud/componentes/SelectorPersona.vue'
import SelectorTercero from '@/hud/componentes/SelectorTercero.vue'
import { useEntidad } from '@/stores/entidad'
import { useTercerosConocidos } from '@/stores/terceros'
import { beneficiarios as pedirBeneficiarios, crearBeneficiario, terminarBeneficiario } from '../api'
import { CRITERIO } from '../reglas'

const entidad = useEntidad()
const conocidos = useTercerosConocidos()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const prepara = computed(() => entidad.tienePermiso('tributario.preparar'))
const { buscar, crearSiPuede } = useBuscarTerceros(id)
const hoy = hoyEn(entidad.zonaHoraria)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<Beneficiario[]>([])
const resultado = ref<string | null>(null)
const vigentes = computed(() => lista.value.filter((b) => !b.vigente_hasta || b.vigente_hasta >= hoy))
const terminados = computed(() => lista.value.filter((b) => b.vigente_hasta && b.vigente_hasta < hoy))

const persona = ref<OpcionPersona | null>(null)
const criterio = ref<CriterioBeneficiario | ''>('propiedad')
const porcentaje = ref('')
const desde = ref(hoy)
const crear = useAccion(() =>
  crearBeneficiario(id.value, { persona_id: persona.value?.id ?? '', criterio: criterio.value || 'propiedad', porcentaje: criterio.value === 'propiedad' ? porcentaje.value.trim() || null : null, vigente_desde: desde.value }),
)
const terminando = ref<Beneficiario | null>(null)
const abiertoTerminar = computed({ get: () => !!terminando.value, set: (v) => !v && (terminando.value = null) })
const fin = ref(hoy)
const terminar = useAccion((_c, b: Beneficiario) => terminarBeneficiario(id.value, b.id, fin.value))

async function alCrear() {
  const r = await crear.ejecutar()
  if (!r.ok) return
  resultado.value = `${persona.value?.nombre ?? 'Beneficiario'} registrado como beneficiario final.`
  persona.value = null
  porcentaje.value = ''
  await cargar()
}

async function alTerminar() {
  const b = terminando.value
  if (!b) return
  const r = await terminar.ejecutar(b)
  if (!r.ok) return
  terminando.value = null
  resultado.value = `Vigencia terminada el ${fechaCalendario(fin.value)}.`
  await cargar()
}

// Los beneficiarios traen solo `persona_id`: se piden los nombres que aún no se conocen.
watch(lista, (l) => void conocidos.resolver(id.value, l.map((b) => b.persona_id)))

async function cargar() {
  try {
    lista.value = await pedirBeneficiarios(id.value)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-beneficiarios">
    <h1 id="titulo-beneficiarios">
      Beneficiarios finales
    </h1>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <HudPanel
      v-if="prepara"
      etiqueta="Registrar beneficiario"
    >
      <form
        class="campos"
        @submit.prevent="alCrear"
      >
        <SelectorTercero
          v-model="persona"
          :buscar="buscar"
          :crear="crearSiPuede"
          etiqueta="Persona"
        />
        <div class="filtros">
          <HudSelector
            v-model="criterio"
            etiqueta="Criterio"
            :opciones="opcionesDe(CRITERIO)"
          />
          <HudCampo
            v-if="criterio === 'propiedad'"
            v-model="porcentaje"
            etiqueta="Participación (%)"
            modo-entrada="decimal"
          />
          <HudFecha
            v-model="desde"
            etiqueta="Desde"
          />
        </div>
        <p
          v-if="crear.error.value"
          class="error"
          role="alert"
        >
          {{ crear.error.value }}
        </p>
        <div class="botones">
          <HudBoton
            tipo="submit"
            :cargando="crear.cargando.value"
            :deshabilitado="!persona"
          >
            Registrar
          </HudBoton>
        </div>
      </form>
    </HudPanel>
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
    <HudPanel
      v-else
      etiqueta="Registrados"
    >
      <HudEstado
        v-if="!lista.length"
        estado="vacio"
        mensaje="Todavía no hay beneficiarios finales registrados."
      />
      <ul
        v-else
        class="lista"
        aria-label="Beneficiarios finales"
      >
        <li
          v-for="b in [...vigentes, ...terminados]"
          :key="b.id"
        >
          <span class="crece">
            <strong>{{ conocidos.nombre(b.persona_id, 'Persona') }}</strong>
            <small>{{ CRITERIO[b.criterio] }}{{ b.porcentaje ? ` · ${b.porcentaje} %` : '' }} · desde el {{ fechaCalendario(b.vigente_desde) }}{{ b.vigente_hasta ? ` hasta el ${fechaCalendario(b.vigente_hasta)}` : '' }}</small>
          </span>
          <HudInsignia :tono="terminados.includes(b) ? 'neutro' : 'exito'">
            {{ terminados.includes(b) ? 'Terminado' : 'Vigente' }}
          </HudInsignia>
          <HudBoton
            v-if="prepara && !b.vigente_hasta"
            variante="fantasma"
            @click="terminando = b"
          >
            Terminar<span class="solo-lector"> la vigencia de {{ conocidos.nombre(b.persona_id, 'esta persona') }}</span>
          </HudBoton>
        </li>
      </ul>
    </HudPanel>
    <HudDialogo
      v-model:abierto="abiertoTerminar"
      titulo="Terminar la vigencia"
    >
      <HudFecha
        v-model="fin"
        etiqueta="Fecha de terminación"
      />
      <p
        v-if="terminar.error.value"
        class="error"
        role="alert"
      >
        {{ terminar.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="terminando = null"
        >
          Volver
        </HudBoton>
        <HudBoton
          :cargando="terminar.cargando.value"
          @click="alTerminar"
        >
          Terminar
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="./tributario.css"></style>
