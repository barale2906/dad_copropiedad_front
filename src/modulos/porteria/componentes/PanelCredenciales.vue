<script setup lang="ts">
/**
 * Credenciales de una persona: el valor nunca vuelve en claro; el secreto (PIN, QR) se muestra
 * una sola vez al emitir o rotar. Suspender y reactivar; revocar y reportar perdida son
 * definitivas (se confirman).
 */
import { computed, ref, watch } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Credencial, EstadoCredencial, TipoCredencial } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { aUtc, fecha } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SecretoUnaVez from '@/hud/componentes/SecretoUnaVez.vue'
import { cambiarEstadoCredencial, credenciales, emitirCredencial, rotarCredencial } from '../api'
import { ESTADO_CREDENCIAL, pideValor, rotable, TIPO_CREDENCIAL, TIPOS_EMITIBLES, transicionesCredencial } from '../reglas'

const props = defineProps<{ entidadId: string; personaId: string; zona: string }>()

const ACCION_ESTADO: Record<EstadoCredencial, string> = { activa: 'Reactivar', suspendida: 'Suspender', perdida: 'Reportar perdida', revocada: 'Revocar' }

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<Credencial[]>([])
const secreto = ref<{ valor: string; tipo: TipoCredencial } | null>(null)
const resultado = ref<string | null>(null)

// Emitir
const emitiendo = ref(false)
const tipo = ref<TipoCredencial>('tarjeta_rfid')
const valor = ref('')
const hasta = ref('')
const faltaValor = ref<string | null>(null)
const opcionesTipo = TIPOS_EMITIBLES.map((t) => ({ valor: t, etiqueta: TIPO_CREDENCIAL[t] }))
const emitir = useAccion((clave) =>
  emitirCredencial(
    props.entidadId,
    {
      titular: { persona_id: props.personaId },
      tipo: tipo.value,
      valor: pideValor(tipo.value) ? valor.value.trim() : null,
      vigente_hasta: hasta.value ? aUtc(`${hasta.value}T23:59`, props.zona) : null,
    },
    clave,
  ),
)

// Estado y rotación
const definitivo = ref<{ c: Credencial; a: EstadoCredencial } | null>(null)
const confirmando = computed({ get: () => !!definitivo.value, set: (si: boolean) => !si && (definitivo.value = null) })
const cambio = useAccion((_c, c: Credencial, a: EstadoCredencial) => cambiarEstadoCredencial(props.entidadId, c.id, a), { alConflicto: () => cargar() })
const rotar = useAccion((_c, c: Credencial) => rotarCredencial(props.entidadId, c.id))

function abrirEmitir() {
  tipo.value = 'tarjeta_rfid'
  valor.value = hasta.value = ''
  faltaValor.value = null
  emitir.reiniciar()
  emitiendo.value = true
}

async function guardarEmision() {
  faltaValor.value = pideValor(tipo.value) && !valor.value.trim() ? `Escriba ${tipo.value === 'placa' ? 'la placa' : 'el número de la tarjeta'}.` : null
  if (faltaValor.value) return
  const r = await emitir.ejecutar()
  if (!r.ok) return
  emitiendo.value = false
  secreto.value = r.valor.secreto ? { valor: r.valor.secreto, tipo: r.valor.credencial.tipo } : null
  resultado.value = `${TIPO_CREDENCIAL[r.valor.credencial.tipo]} emitida.`
  await cargar()
}

async function cambiar(c: Credencial, a: EstadoCredencial) {
  if ((a === 'revocada' || a === 'perdida') && definitivo.value?.c.id !== c.id) {
    cambio.reiniciar()
    definitivo.value = { c, a }
    return
  }
  const r = await cambio.ejecutar(c, a)
  definitivo.value = null
  if (!r.ok) return
  resultado.value = `${TIPO_CREDENCIAL[c.tipo]}: ${ESTADO_CREDENCIAL[a].texto.toLowerCase()}.`
  await cargar()
}

async function rotarla(c: Credencial) {
  const r = await rotar.ejecutar(c)
  if (!r.ok) return
  secreto.value = r.valor.secreto ? { valor: r.valor.secreto, tipo: c.tipo } : null
  resultado.value = `${TIPO_CREDENCIAL[c.tipo]} rotado: el anterior deja de servir.`
}

async function cargar() {
  try {
    lista.value = await credenciales(props.entidadId, props.personaId)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

watch(
  () => props.personaId,
  () => {
    estado.value = 'cargando'
    secreto.value = resultado.value = null
    void cargar()
  },
  { immediate: true },
)
</script>

<template>
  <HudPanel etiqueta="Credenciales">
    <div class="campos">
      <SecretoUnaVez
        v-if="secreto"
        :valor="secreto.valor"
        :etiqueta="TIPO_CREDENCIAL[secreto.tipo]"
        aviso="Entréguelo a la persona ahora: no se volverá a mostrar."
      />
      <p
        v-if="resultado"
        class="ok"
        role="status"
      >
        {{ resultado }}
      </p>
      <p
        v-for="e in [cambio.error.value, rotar.error.value].filter(Boolean)"
        :key="e ?? ''"
        class="error"
        role="alert"
      >
        {{ e }}
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
      <p
        v-else-if="lista.length === 0"
        class="texto-2"
      >
        No tiene credenciales.
      </p>
      <ul
        v-else
        class="lista"
        aria-label="Credenciales"
      >
        <li
          v-for="c in lista"
          :key="c.id"
        >
          <HudInsignia :tono="ESTADO_CREDENCIAL[c.estado].tono">
            {{ ESTADO_CREDENCIAL[c.estado].texto }}
          </HudInsignia>
          <span class="crece">
            <strong>{{ TIPO_CREDENCIAL[c.tipo] }}</strong>
            <small>Desde {{ fecha(c.vigente_desde, zona) }}{{ c.vigente_hasta ? ` hasta ${fecha(c.vigente_hasta, zona)}` : '' }}</small>
          </span>
          <div class="botones">
            <HudBoton
              v-for="a in transicionesCredencial(c.estado)"
              :key="a"
              :variante="a === 'activa' ? 'secundario' : 'fantasma'"
              :cargando="cambio.cargando.value"
              @click="cambiar(c, a)"
            >
              {{ ACCION_ESTADO[a] }}<span class="solo-lector"> {{ TIPO_CREDENCIAL[c.tipo] }}</span>
            </HudBoton>
            <HudBoton
              v-if="rotable(c.tipo) && c.estado === 'activa'"
              variante="fantasma"
              :cargando="rotar.cargando.value"
              @click="rotarla(c)"
            >
              Rotar<span class="solo-lector"> {{ TIPO_CREDENCIAL[c.tipo] }}</span>
            </HudBoton>
          </div>
        </li>
      </ul>
      <div class="botones">
        <HudBoton @click="abrirEmitir">
          Emitir credencial
        </HudBoton>
      </div>
    </div>

    <HudDialogo
      v-model:abierto="emitiendo"
      titulo="Emitir credencial"
    >
      <form
        id="formulario-credencial"
        class="campos"
        novalidate
        @submit.prevent="guardarEmision"
      >
        <HudSelector
          v-model="tipo"
          etiqueta="Tipo"
          :opciones="opcionesTipo"
        />
        <HudCampo
          v-if="pideValor(tipo)"
          v-model="valor"
          :etiqueta="tipo === 'placa' ? 'Placa' : 'Número de la tarjeta'"
          autocompletar="off"
          :error="faltaValor"
        />
        <p
          v-else
          class="texto-2"
        >
          El {{ TIPO_CREDENCIAL[tipo] }} lo genera el sistema y se muestra una sola vez.
        </p>
        <HudFecha
          v-model="hasta"
          etiqueta="Vigente hasta (opcional)"
        />
        <p
          v-if="emitir.error.value"
          class="error"
          role="alert"
        >
          {{ emitir.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="emitiendo = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-credencial"
          :cargando="emitir.cargando.value"
        >
          Emitir
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="confirmando"
      :titulo="definitivo ? `${ACCION_ESTADO[definitivo.a]} ${TIPO_CREDENCIAL[definitivo.c.tipo].toLowerCase()}` : ''"
    >
      <p>Esta acción es definitiva: la credencial no se podrá volver a activar.</p>
      <p
        v-if="cambio.error.value"
        class="error"
        role="alert"
      >
        {{ cambio.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="definitivo = null"
        >
          Volver
        </HudBoton>
        <HudBoton
          v-if="definitivo"
          :cargando="cambio.cargando.value"
          @click="cambiar(definitivo.c, definitivo.a)"
        >
          {{ ACCION_ESTADO[definitivo.a] }}
        </HudBoton>
      </template>
    </HudDialogo>
  </HudPanel>
</template>

<style scoped src="../vistas/porteria.css"></style>
