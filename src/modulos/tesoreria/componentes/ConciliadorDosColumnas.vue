<script setup lang="ts">
/**
 * Conciliación a mano en dos columnas: movimientos del extracto y líneas de libros pendientes.
 * Cada columna es una lista de selección múltiple (`listbox`): flechas para moverse, Espacio o
 * Enter para marcar, Inicio/Fin, Tab para pasar a la otra columna. Los totales de lo marcado y
 * la diferencia se ven en vivo; solo se concilia si suman lo mismo (lo exige el backend). Sobre
 * el movimiento activo del extracto: marcarlo como partida conciliatoria o crear un recibo.
 */
import { computed, ref, useId } from 'vue'
import type { LineaLibros, LineaRef, MovimientoExtracto } from '@/api/tipos'
import { moneda } from '@/formato/decimales'
import { fechaCalendario } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import { claveLinea, ESTADO_MOVIMIENTO, totalSeleccion } from '../reglas'

const props = withDefaults(defineProps<{ movimientos: MovimientoExtracto[]; lineas: LineaLibros[]; cargando?: boolean }>(), { cargando: false })
const emit = defineEmits<{
  conciliar: [movimientos: string[], lineas: LineaRef[]]
  partida: [movimiento: MovimientoExtracto, partida: boolean]
  recibo: [movimiento: MovimientoExtracto]
}>()

const id = useId()
const marcadosExt = ref(new Set<string>())
const marcadosLib = ref(new Set<string>())
const activoExt = ref(0)
const activoLib = ref(0)

const selMovs = computed(() => props.movimientos.filter((m) => marcadosExt.value.has(m.id)))
const selLins = computed(() => props.lineas.filter((l) => marcadosLib.value.has(claveLinea(l))))
const totales = computed(() => totalSeleccion(selMovs.value, selLins.value))
const movActivo = computed(() => props.movimientos[activoExt.value] ?? null)
const textoDiferencia = computed(() =>
  !selMovs.value.length && !selLins.value.length ? 'Marque partidas de las dos columnas' : totales.value.cuadra ? 'Suman lo mismo: puede conciliar' : `Diferencia ${moneda(totales.value.diferencia)}`,
)

function alternar(conjunto: typeof marcadosExt, clave: string) {
  const s = new Set(conjunto.value)
  if (s.has(clave)) s.delete(clave)
  else s.add(clave)
  conjunto.value = s
}

function elegirExt(i: number, m: MovimientoExtracto) {
  activoExt.value = i
  alternar(marcadosExt, m.id)
}

function elegirLib(i: number, l: LineaLibros) {
  activoLib.value = i
  alternar(marcadosLib, claveLinea(l))
}

function teclas(e: KeyboardEvent, lado: 'ext' | 'lib') {
  const n = lado === 'ext' ? props.movimientos.length : props.lineas.length
  if (!n) return
  const activo = lado === 'ext' ? activoExt : activoLib
  const mover = (i: number) => (activo.value = Math.max(0, Math.min(n - 1, i)))
  if (e.key === 'ArrowDown') mover(activo.value + 1)
  else if (e.key === 'ArrowUp') mover(activo.value - 1)
  else if (e.key === 'Home') mover(0)
  else if (e.key === 'End') mover(n - 1)
  else if (e.key === ' ' || e.key === 'Enter') {
    if (lado === 'ext') {
      const m = props.movimientos[activo.value]
      if (m) alternar(marcadosExt, m.id)
    } else {
      const l = props.lineas[activo.value]
      if (l) alternar(marcadosLib, claveLinea(l))
    }
  } else return
  e.preventDefault()
}

function conciliar() {
  emit('conciliar', selMovs.value.map((m) => m.id), selLins.value.map((l) => ({ comprobante_id: l.comprobante_id, orden: l.orden })))
  marcadosExt.value = new Set()
  marcadosLib.value = new Set()
}

const signo = (v: string) => (v.startsWith('-') ? 'sale' : 'entra')
</script>

<template>
  <div class="conciliador">
    <p class="texto-2 ayuda">
      Con el teclado: flechas para moverse, Espacio para marcar y Tab para pasar a la otra columna.
    </p>
    <div class="columnas">
      <section :aria-labelledby="`${id}-ext`">
        <h3 :id="`${id}-ext`">
          Extracto del banco ({{ movimientos.length }})
        </h3>
        <ul
          role="listbox"
          aria-multiselectable="true"
          tabindex="0"
          :aria-labelledby="`${id}-ext`"
          :aria-activedescendant="movimientos.length ? `${id}-m-${activoExt}` : undefined"
          class="lista-sel"
          @keydown="teclas($event, 'ext')"
        >
          <li
            v-for="(m, i) in movimientos"
            :id="`${id}-m-${i}`"
            :key="m.id"
            role="option"
            :aria-selected="marcadosExt.has(m.id)"
            :class="{ activo: i === activoExt }"
            @click="elegirExt(i, m)"
          >
            <span class="crece">
              <strong>{{ m.descripcion }}</strong>
              <small>{{ fechaCalendario(m.fecha) }}{{ m.referencia ? ` · ${m.referencia}` : '' }}</small>
            </span>
            <span
              class="cifra"
              :class="signo(m.valor)"
            >{{ moneda(m.valor) }}</span>
            <HudInsignia
              v-if="m.estado !== 'pendiente'"
              :tono="ESTADO_MOVIMIENTO[m.estado].tono"
            >
              {{ ESTADO_MOVIMIENTO[m.estado].texto }}
            </HudInsignia>
          </li>
          <li
            v-if="!movimientos.length"
            class="vacio"
            role="option"
            aria-selected="false"
            aria-disabled="true"
          >
            No hay movimientos pendientes.
          </li>
        </ul>
        <div
          v-if="movActivo"
          class="botones"
        >
          <HudBoton
            variante="fantasma"
            @click="emit('partida', movActivo, movActivo.estado !== 'partida_conciliatoria')"
          >
            {{ movActivo.estado === 'partida_conciliatoria' ? 'Quitar la partida conciliatoria' : 'Marcar como partida conciliatoria' }}<span class="solo-lector">: {{ movActivo.descripcion }}</span>
          </HudBoton>
          <HudBoton
            v-if="!movActivo.valor.startsWith('-') && movActivo.estado === 'pendiente'"
            variante="fantasma"
            @click="emit('recibo', movActivo)"
          >
            Crear recibo<span class="solo-lector"> desde «{{ movActivo.descripcion }}»</span>
          </HudBoton>
        </div>
      </section>
      <section :aria-labelledby="`${id}-lib`">
        <h3 :id="`${id}-lib`">
          Libros ({{ lineas.length }})
        </h3>
        <ul
          role="listbox"
          aria-multiselectable="true"
          tabindex="0"
          :aria-labelledby="`${id}-lib`"
          :aria-activedescendant="lineas.length ? `${id}-l-${activoLib}` : undefined"
          class="lista-sel"
          @keydown="teclas($event, 'lib')"
        >
          <li
            v-for="(l, i) in lineas"
            :id="`${id}-l-${i}`"
            :key="claveLinea(l)"
            role="option"
            :aria-selected="marcadosLib.has(claveLinea(l))"
            :class="{ activo: i === activoLib }"
            @click="elegirLib(i, l)"
          >
            <span class="crece">
              <strong>{{ l.descripcion }}</strong>
              <small>{{ fechaCalendario(l.fecha) }} · {{ l.tipo }}-{{ l.numero }}</small>
            </span>
            <span
              class="cifra"
              :class="signo(l.valor)"
            >{{ moneda(l.valor) }}</span>
          </li>
          <li
            v-if="!lineas.length"
            class="vacio"
            role="option"
            aria-selected="false"
            aria-disabled="true"
          >
            No hay líneas pendientes en libros.
          </li>
        </ul>
      </section>
    </div>
    <div class="pie">
      <dl
        class="totales"
        aria-label="Lo marcado"
      >
        <div>
          <dt>Extracto</dt>
          <dd class="cifra">
            {{ moneda(totales.extracto) }}
          </dd>
        </div>
        <div>
          <dt>Libros</dt>
          <dd class="cifra">
            {{ moneda(totales.libros) }}
          </dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <span
              role="status"
              aria-live="polite"
              :class="totales.cuadra ? 'cuadra' : 'falta'"
            >{{ textoDiferencia }}</span>
          </dd>
        </div>
      </dl>
      <HudBoton
        :deshabilitado="!totales.cuadra"
        :cargando="cargando"
        @click="conciliar"
      >
        Conciliar lo marcado
      </HudBoton>
    </div>
  </div>
</template>

<style scoped src="../vistas/tesoreria.css"></style>
<style scoped>
.conciliador {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.columnas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 14px;
}

.columnas section {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
}

h3 {
  margin: 0;
  font-size: 17px;
}

.lista-sel {
  display: grid;
  gap: 4px;
  max-height: 420px;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  border: 1px solid var(--linea-fuerte);
  list-style: none;
}

.lista-sel:focus-visible {
  outline: 2px solid var(--cian);
  outline-offset: 2px;
}

.lista-sel li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid transparent;
  cursor: pointer;
}

.lista-sel li.activo {
  border-color: var(--linea-fuerte);
}

.lista-sel li[aria-selected='true'] {
  background: var(--cian-tenue);
  border-color: var(--cian);
}

.lista-sel li.vacio {
  color: var(--texto-2);
  cursor: default;
}

.sale {
  color: var(--magenta);
}

.entra {
  color: var(--verde);
}

.pie {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.totales {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
  margin: 0;
}

.cuadra {
  color: var(--verde);
  font-weight: 600;
}

.falta {
  color: var(--ambar);
}
</style>
