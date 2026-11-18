<script setup lang="ts">
/**
 * Formulario de una pregunta en borrador: enunciado, tipo, visibilidad del voto, base de
 * cómputo, regla de mayoría y opciones (en elecciones, planchas con sus integrantes, cupos y
 * cargo). Valida con las mismas reglas del backend antes de enviar.
 */
import { computed, ref } from 'vue'
import { buscarPersonas } from '@/api/personas'
import type { BaseComputo, NuevaPregunta, Pregunta, PuntoOrdenDia } from '@/api/tipos'
import { opcionesDe } from '@/composables/textos-acceso'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SelectorPersona, { type OpcionPersona } from '@/hud/componentes/SelectorPersona.vue'
import IMas from '~icons/tabler/plus'
import IQuitar from '~icons/tabler/x'
import {
  BASE_COMPUTO,
  borradorDe,
  borradorVacio,
  CARGO_ELECCION,
  MAYORIA,
  opcionVacia,
  peticionPregunta,
  TIPO_PREGUNTA,
  TIPO_VOTO,
} from '../reglas'

const props = withDefaults(
  defineProps<{
    entidadId: string
    /** La pregunta a editar; sin ella, una nueva. */
    pregunta?: Pregunta | null
    puntos?: PuntoOrdenDia[]
    /** ¿Puede buscar personas (`personas.ver`) para las planchas? */
    buscaPersonas?: boolean
    cargando?: boolean
    error?: string | null
  }>(),
  { pregunta: null, puntos: () => [], buscaPersonas: false, cargando: false, error: null },
)
const emit = defineEmits<{ guardar: [datos: NuevaPregunta]; cancelar: [] }>()

const b = ref(props.pregunta ? borradorDe(props.pregunta) : borradorVacio())
const problema = ref<string | null>(null)
const maximo = ref(String(b.value.max_selecciones))
const cupos = ref(String(b.value.cupos))

const eleccion = computed(() => b.value.tipo === 'eleccion')
const conOpciones = computed(() => b.value.tipo !== 'si_no')
const opcionesPunto = computed(() => props.puntos.map((p) => ({ valor: p.id, etiqueta: `${p.orden}. ${p.titulo}` })))
const opcionesSobre = [
  { valor: 'presentes' as const, etiqueta: 'De los presentes' },
  { valor: 'total' as const, etiqueta: 'De toda la copropiedad' },
]

async function buscar(q: string): Promise<OpcionPersona[]> {
  const r = await buscarPersonas(props.entidadId, q, undefined, 8)
  return r.datos.map((p) => ({ id: p.id, nombre: p.nombre, detalle: p.documento ?? null }))
}

function agregarCandidato(i: number, persona: OpcionPersona) {
  const o = b.value.opciones[i]
  if (o && !o.candidatos.some((c) => c.id === persona.id)) o.candidatos.push({ id: persona.id, nombre: persona.nombre })
}

function guardar() {
  b.value.max_selecciones = Number.parseInt(maximo.value, 10) || 0
  b.value.cupos = Number.parseInt(cupos.value, 10) || 0
  const r = peticionPregunta(b.value)
  if ('error' in r) {
    problema.value = r.error
    return
  }
  problema.value = null
  emit('guardar', r.datos)
}
</script>

<template>
  <form
    class="campos"
    novalidate
    @submit.prevent="guardar"
  >
    <HudCampo
      v-model="b.enunciado"
      etiqueta="Pregunta"
      multilinea
      requerido
    />
    <div class="filtros">
      <HudSelector
        v-model="b.tipo"
        etiqueta="Tipo de pregunta"
        :opciones="opcionesDe(TIPO_PREGUNTA)"
      />
      <HudSelector
        v-model="b.tipo_voto"
        etiqueta="Voto"
        :opciones="opcionesDe(TIPO_VOTO)"
      />
      <HudSelector
        v-model="b.base"
        etiqueta="Base de cómputo"
        vacio="La de la reunión"
        :opciones="opcionesDe<BaseComputo>(BASE_COMPUTO)"
      />
      <HudSelector
        v-if="!eleccion"
        v-model="b.mayoria"
        etiqueta="Mayoría"
        :opciones="opcionesDe(MAYORIA)"
      />
    </div>
    <p
      v-if="b.base === 'unidades'"
      class="aviso"
    >
      La Ley 675 decide por coeficientes (arts. 45 y 46): por unidades, la decisión podría impugnarse y así quedará en el acta.
    </p>
    <div
      v-if="!eleccion && b.mayoria === 'personalizada'"
      class="filtros"
    >
      <HudCampo
        v-model="b.umbral"
        etiqueta="Umbral (%)"
        modo-entrada="decimal"
        ayuda="Se aprueba con al menos este porcentaje."
      />
      <HudSelector
        v-model="b.sobre"
        etiqueta="Sobre"
        :opciones="opcionesSobre"
      />
    </div>

    <label
      v-if="!conOpciones"
      class="casilla"
    >
      <input
        v-model="b.con_abstencion"
        type="checkbox"
      > Incluir «Abstención» además de «Sí» y «No»
    </label>
    <fieldset
      v-else
      class="opciones"
    >
      <legend>{{ eleccion ? 'Planchas o candidatos' : 'Opciones' }}</legend>
      <div
        v-for="(o, i) in b.opciones"
        :key="i"
        class="opcion"
      >
        <div class="fila-opcion">
          <HudCampo
            v-model="o.texto"
            :etiqueta="eleccion ? `Plancha ${i + 1}` : `Opción ${i + 1}`"
          />
          <HudBoton
            v-if="b.opciones.length > 1"
            variante="fantasma"
            @click="b.opciones.splice(i, 1)"
          >
            <IQuitar aria-hidden="true" /><span class="solo-lector">Quitar {{ eleccion ? 'la plancha' : 'la opción' }} {{ i + 1 }}</span>
          </HudBoton>
        </div>
        <template v-if="eleccion">
          <ul
            v-if="o.candidatos.length"
            class="candidatos"
            :aria-label="`Integrantes de la plancha ${i + 1}`"
          >
            <li
              v-for="(c, k) in o.candidatos"
              :key="c.id"
            >
              {{ c.nombre || 'Integrante registrado' }}
              <HudBoton
                variante="fantasma"
                @click="o.candidatos.splice(k, 1)"
              >
                <IQuitar aria-hidden="true" /><span class="solo-lector">Quitar a {{ c.nombre || 'este integrante' }}</span>
              </HudBoton>
            </li>
          </ul>
          <SelectorPersona
            v-if="buscaPersonas"
            :etiqueta="`Agregar integrante a la plancha ${i + 1}`"
            :buscar="buscar"
            @elegir="(p) => agregarCandidato(i, p)"
          />
        </template>
      </div>
      <HudBoton
        variante="secundario"
        @click="b.opciones.push(opcionVacia())"
      >
        <IMas aria-hidden="true" /> {{ eleccion ? 'Agregar plancha' : 'Agregar opción' }}
      </HudBoton>
    </fieldset>

    <div class="filtros">
      <HudCampo
        v-if="b.tipo === 'seleccion_multiple'"
        v-model="maximo"
        etiqueta="Máximo de opciones por voto"
        modo-entrada="numeric"
      />
      <template v-if="eleccion">
        <HudCampo
          v-model="cupos"
          etiqueta="Cupos a proveer"
          modo-entrada="numeric"
        />
        <HudSelector
          v-model="b.cargo"
          etiqueta="Cargo que se elige"
          vacio="Sin cargo (solo queda en el acta)"
          :opciones="opcionesDe(CARGO_ELECCION)"
        />
      </template>
      <HudSelector
        v-if="opcionesPunto.length"
        v-model="b.punto_id"
        etiqueta="Punto del orden del día"
        vacio="Ninguno"
        :opciones="opcionesPunto"
      />
      <HudCampo
        v-model="b.temporizador"
        etiqueta="Temporizador (segundos)"
        modo-entrada="numeric"
        ayuda="Vacío: el de la reunión; 0: sin temporizador."
      />
    </div>
    <label
      v-if="eleccion"
      class="casilla"
    >
      <input
        v-model="b.con_blanco"
        type="checkbox"
      > Permitir el voto en blanco
    </label>

    <p
      v-if="problema ?? error"
      class="error"
      role="alert"
    >
      {{ problema ?? error }}
    </p>
    <div class="botones">
      <HudBoton
        tipo="submit"
        :cargando="cargando"
      >
        {{ pregunta ? 'Guardar la pregunta' : 'Agregar la pregunta' }}
      </HudBoton>
      <HudBoton
        variante="fantasma"
        @click="emit('cancelar')"
      >
        Cancelar
      </HudBoton>
    </div>
  </form>
</template>

<style scoped src="../vistas/asambleas.css"></style>
<style scoped>
.opciones {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  border: 0;
}

.opciones legend {
  margin-bottom: 6px;
  color: var(--texto-2);
}

.opcion {
  display: grid;
  gap: 8px;
}

.fila-opcion {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.fila-opcion > :first-child {
  flex: 1;
}

.candidatos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.candidatos li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding-left: 10px;
  border: 1px solid var(--linea);
}
</style>
