<script setup lang="ts">
/** Dispositivos conectados a cada puente (torniquetes, lectores, cámaras): listar y registrar. */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { DispositivoAcceso, Puente, PuntoAcceso, TipoDispositivoAcceso } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { dispositivos, registrarDispositivo } from '../api'
import { TIPO_DISPOSITIVO } from '../reglas'

const props = defineProps<{ entidadId: string; puentes: Puente[]; puntos: PuntoAcceso[] }>()

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const lista = ref<DispositivoAcceso[]>([])
const puenteId = ref('')
const puntoId = ref('')
const tipo = ref<TipoDispositivoAcceso>('torniquete')
const fabricante = ref('')
const modelo = ref('')
const errorForm = ref<string | null>(null)

const opcionesPuente = computed(() => props.puentes.filter((p) => p.estado === 'activo').map((p) => ({ valor: p.id, etiqueta: p.nombre })))
const opcionesPunto = computed(() => props.puntos.filter((p) => p.id).map((p) => ({ valor: p.id ?? '', etiqueta: p.nombre })))
const nombrePuente = (id: string) => props.puentes.find((p) => p.id === id)?.nombre ?? 'Puente'
const nombrePunto = (id: string) => props.puntos.find((p) => p.id === id)?.nombre ?? 'Punto'

const registrar = useAccion((clave) =>
  registrarDispositivo(
    props.entidadId,
    { puente_id: puenteId.value, punto_acceso_id: puntoId.value, tipo: tipo.value, fabricante: fabricante.value.trim(), modelo: modelo.value.trim() || null, config: {} },
    clave,
  ),
)

async function agregar() {
  errorForm.value = !puenteId.value || !puntoId.value ? 'Elija el puente y el punto de acceso.' : !fabricante.value.trim() ? 'Escriba el fabricante.' : null
  if (errorForm.value) return
  const r = await registrar.ejecutar()
  if (!r.ok) return
  fabricante.value = modelo.value = ''
  await cargar()
}

async function cargar() {
  try {
    lista.value = await dispositivos(props.entidadId)
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <HudPanel etiqueta="Dispositivos">
    <div class="campos">
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
      <ul
        v-else-if="lista.length"
        class="lista"
        aria-label="Dispositivos"
      >
        <li
          v-for="(d, i) in lista"
          :key="d.id ?? i"
        >
          <HudInsignia :tono="d.activo === false ? 'neutro' : 'exito'">
            {{ d.activo === false ? 'Inactivo' : 'Activo' }}
          </HudInsignia>
          <span class="crece">
            <strong>{{ TIPO_DISPOSITIVO[d.tipo] }} · {{ d.fabricante }}{{ d.modelo ? ` ${d.modelo}` : '' }}</strong>
            <small>{{ nombrePunto(d.punto_acceso_id) }} · {{ nombrePuente(d.puente_id) }}</small>
          </span>
        </li>
      </ul>
      <p
        v-else
        class="texto-2"
      >
        Aún no hay dispositivos.
      </p>
      <p
        v-if="!opcionesPuente.length || !opcionesPunto.length"
        class="texto-2"
      >
        Para registrar un dispositivo necesita al menos un puente activo y un punto de acceso.
      </p>
      <form
        v-else
        class="campos"
        novalidate
        @submit.prevent="agregar"
      >
        <HudSelector
          v-model="puenteId"
          etiqueta="Puente"
          vacio="Elija un puente"
          :opciones="opcionesPuente"
        />
        <HudSelector
          v-model="puntoId"
          etiqueta="Punto de acceso"
          vacio="Elija un punto"
          :opciones="opcionesPunto"
        />
        <HudSelector
          v-model="tipo"
          etiqueta="Tipo de dispositivo"
          :opciones="opcionesDe(TIPO_DISPOSITIVO)"
        />
        <HudCampo
          v-model="fabricante"
          etiqueta="Fabricante"
          autocompletar="off"
        />
        <HudCampo
          v-model="modelo"
          etiqueta="Modelo (opcional)"
          autocompletar="off"
        />
        <p class="texto-2">
          La conexión (IP, puerto, claves) se configura en el puente: nunca escriba contraseñas aquí.
        </p>
        <p
          v-if="errorForm || registrar.error.value"
          class="error"
          role="alert"
        >
          {{ errorForm ?? registrar.error.value }}
        </p>
        <div class="botones">
          <HudBoton
            tipo="submit"
            variante="secundario"
            :cargando="registrar.cargando.value"
          >
            Registrar dispositivo
          </HudBoton>
        </div>
      </form>
    </div>
  </HudPanel>
</template>

<style scoped src="../vistas/porteria.css"></style>
