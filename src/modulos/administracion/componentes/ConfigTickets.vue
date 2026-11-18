<script setup lang="ts">
/** Configuración de las PQRS: jornada hábil, días para reabrir, plazos por tipo y categorías. */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CategoriaTicket, ConfiguracionTickets, PrioridadTicket, ReglaPlazo, TipoTicket, UnidadPlazo } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import { PRIORIDAD_TICKET, TIPO_TICKET } from '@/composables/textos-gestion'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import IQuitar from '~icons/tabler/trash'
import { categoriasTicket, configuracionTickets, crearCategoria, editarCategoria, guardarConfiguracionTickets } from '../api'
import { UNIDAD_PLAZO } from '../reglas'

const props = defineProps<{ entidadId: string }>()

interface FilaPlazo {
  tipo: TipoTicket
  prioridad: PrioridadTicket | ''
  cantidad: string
  unidad: UnidadPlazo
}

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const inicio = ref('')
const fin = ref('')
const sabado = ref(false)
const reapertura = ref('')
const plazos = ref<FilaPlazo[]>([])
const categorias = ref<CategoriaTicket[]>([])
const nueva = ref('')
const errorForm = ref<string | null>(null)
const guardado = ref(false)

const opcionesPrioridad = (Object.keys(PRIORIDAD_TICKET) as PrioridadTicket[]).map((valor) => ({ valor, etiqueta: PRIORIDAD_TICKET[valor].texto }))
const datos = computed<ConfiguracionTickets>(() => ({
  jornada_inicio: `${inicio.value.slice(0, 5)}:00`,
  jornada_fin: `${fin.value.slice(0, 5)}:00`,
  incluye_sabado: sabado.value,
  dias_reapertura: parseInt(reapertura.value, 10),
  plazos: plazos.value.map<ReglaPlazo>((p) => ({ tipo: p.tipo, prioridad: p.prioridad || null, plazo: { cantidad: parseInt(p.cantidad, 10), unidad: p.unidad } })),
}))

const guardar = useAccion(() => guardarConfiguracionTickets(props.entidadId, datos.value))
const agregar = useAccion((clave) => crearCategoria(props.entidadId, nueva.value.trim(), clave))
const alternar = useAccion((_c, c: CategoriaTicket) => editarCategoria(props.entidadId, { ...c, activa: !c.activa }))

function llenar(c: ConfiguracionTickets) {
  inicio.value = c.jornada_inicio.slice(0, 5)
  fin.value = c.jornada_fin.slice(0, 5)
  sabado.value = c.incluye_sabado
  reapertura.value = String(c.dias_reapertura)
  plazos.value = c.plazos.map((p) => ({ tipo: p.tipo, prioridad: p.prioridad ?? '', cantidad: String(p.plazo.cantidad), unidad: p.plazo.unidad }))
}

async function enviar() {
  guardado.value = false
  errorForm.value =
    !inicio.value || !fin.value || fin.value <= inicio.value ? 'La jornada debe terminar después de empezar.'
      : !/^\d+$/.test(reapertura.value) ? 'Los días para reabrir deben ser un número entero.'
        : plazos.value.some((p) => !/^[1-9]\d*$/.test(p.cantidad)) ? 'Cada plazo necesita una cantidad mayor que cero.'
          : null
  if (errorForm.value) return
  const r = await guardar.ejecutar()
  if (r.ok) {
    llenar(r.valor)
    guardado.value = true
  }
}

async function agregarCategoria() {
  if (!nueva.value.trim()) return
  const r = await agregar.ejecutar()
  if (!r.ok) return
  categorias.value = [...categorias.value, r.valor]
  nueva.value = ''
}

async function cambiar(c: CategoriaTicket) {
  const r = await alternar.ejecutar(c)
  if (r.ok) categorias.value = categorias.value.map((x) => (x.id === c.id ? r.valor : x))
}

async function cargar() {
  try {
    const [c, cats] = await Promise.all([configuracionTickets(props.entidadId), categoriasTicket(props.entidadId)])
    llenar(c)
    categorias.value = cats
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
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
    <HudPanel etiqueta="Plazos de respuesta">
      <form
        class="campos"
        novalidate
        @submit.prevent="enviar"
      >
        <div class="filtros">
          <HudCampo
            v-model="inicio"
            etiqueta="Jornada desde"
            tipo="time"
          />
          <HudCampo
            v-model="fin"
            etiqueta="Jornada hasta"
            tipo="time"
          />
          <HudCampo
            v-model="reapertura"
            etiqueta="Días para reabrir un resuelto"
            modo-entrada="numeric"
          />
        </div>
        <label class="casilla">
          <input
            v-model="sabado"
            type="checkbox"
          > Los sábados cuentan como día hábil
        </label>
        <fieldset class="plazos">
          <legend>Plazo por tipo (sin plazo propio se usan los 15 días hábiles de la Ley 1755)</legend>
          <div
            v-for="(p, i) in plazos"
            :key="i"
            class="plazo"
          >
            <HudSelector
              v-model="p.tipo"
              etiqueta="Tipo"
              :opciones="opcionesDe(TIPO_TICKET)"
            />
            <HudSelector
              v-model="p.prioridad"
              etiqueta="Prioridad"
              vacio="Cualquiera"
              :opciones="opcionesPrioridad"
            />
            <HudCampo
              v-model="p.cantidad"
              etiqueta="Cantidad"
              modo-entrada="numeric"
            />
            <HudSelector
              v-model="p.unidad"
              etiqueta="Unidad"
              :opciones="opcionesDe(UNIDAD_PLAZO)"
            />
            <HudBoton
              variante="fantasma"
              @click="plazos.splice(i, 1)"
            >
              <IQuitar aria-hidden="true" /><span class="solo-lector">Quitar el plazo de {{ TIPO_TICKET[p.tipo] }}</span>
            </HudBoton>
          </div>
          <HudBoton
            variante="secundario"
            @click="plazos.push({ tipo: 'peticion', prioridad: '', cantidad: '15', unidad: 'dias_habiles' })"
          >
            Agregar un plazo
          </HudBoton>
        </fieldset>
        <p
          v-if="errorForm || guardar.error.value"
          class="error"
          role="alert"
        >
          {{ errorForm ?? guardar.error.value }}
        </p>
        <p
          v-if="guardado"
          class="ok"
          role="status"
        >
          Configuración guardada.
        </p>
        <div class="botones">
          <HudBoton
            tipo="submit"
            :cargando="guardar.cargando.value"
          >
            Guardar plazos
          </HudBoton>
        </div>
      </form>
    </HudPanel>

    <HudPanel etiqueta="Categorías">
      <div class="campos">
        <ul
          class="lista"
          aria-label="Categorías de PQRS"
        >
          <li
            v-for="c in categorias"
            :key="c.id"
          >
            <span class="crece">{{ c.nombre }}<small v-if="!c.activa"> · inactiva</small></span>
            <HudBoton
              variante="fantasma"
              :cargando="alternar.cargando.value"
              @click="cambiar(c)"
            >
              {{ c.activa ? 'Desactivar' : 'Activar' }}<span class="solo-lector"> {{ c.nombre }}</span>
            </HudBoton>
          </li>
        </ul>
        <form
          class="campos"
          @submit.prevent="agregarCategoria"
        >
          <HudCampo
            v-model="nueva"
            etiqueta="Categoría nueva"
            autocompletar="off"
            :error="agregar.error.value ?? alternar.error.value"
          />
          <div class="botones">
            <HudBoton
              tipo="submit"
              variante="secundario"
              :cargando="agregar.cargando.value"
              :deshabilitado="!nueva.trim()"
            >
              Agregar categoría
            </HudBoton>
          </div>
        </form>
      </div>
    </HudPanel>
  </template>
</template>

<style scoped src="../vistas/administracion.css"></style>
<style scoped>
.plazos {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
  justify-items: start;
}

.plazos legend {
  margin-bottom: 6px;
  color: var(--texto-2);
}

.plazo {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
  gap: 10px;
  align-items: end;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--linea);
}
</style>
