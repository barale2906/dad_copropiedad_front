<script setup lang="ts">
/**
 * Editor de un comprobante de partida doble: encabezado (tipo, fecha, descripción) y líneas
 * con cuenta, tercero, centro de costo, débito y crédito; totales y diferencia en vivo con
 * decimales exactos. Atajos (ayuda con `?`): Enter siguiente celda, Ctrl+Enter nueva línea,
 * Ctrl+D duplicar, `=` cuadra, F2 buscar cuenta, Ctrl+Supr quitar, Alt+P previsualizar,
 * Ctrl+S guardar y Ctrl+Mayús+Enter contabilizar. El padre guarda; aquí solo se edita.
 */
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { buscarTerceros } from '@/api/contabilidad'
import type { CentroCosto, CuentaContable, TipoComprobante } from '@/api/tipos'
import { moneda } from '@/formato/decimales'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SelectorCuenta from '@/hud/componentes/SelectorCuenta.vue'
import SelectorPersona, { type OpcionPersona } from '@/hud/componentes/SelectorPersona.vue'
import IMas from '~icons/tabler/plus'
import IQuitar from '~icons/tabler/trash'
import IPersona from '~icons/tabler/user'
import { avisosComprobante, type ComprobanteEditable, duplicarLinea, lineaVacia, montoQueCuadra, totales } from '../reglas'
import AyudaAtajos from './AyudaAtajos.vue'

const props = defineProps<{
  entidadId: string
  tipos: TipoComprobante[]
  cuentas: CuentaContable[]
  centros: CentroCosto[]
}>()
const entrada = defineModel<ComprobanteEditable>({ required: true })
const emit = defineEmits<{ guardar: []; previsualizar: []; contabilizar: [] }>()

// Se edita una copia (no se mutan las props) y cada cambio sube completo con `update:modelValue`.
const copiar = (c: ComprobanteEditable): ComprobanteEditable => JSON.parse(JSON.stringify(c)) as ComprobanteEditable
const modelo = ref(copiar(entrada.value))
watch(modelo, (v) => (entrada.value = copiar(v)), { deep: true })
watch(entrada, (v) => {
  if (JSON.stringify(v) !== JSON.stringify(modelo.value)) modelo.value = copiar(v)
})

const raiz = useTemplateRef<HTMLElement>('raiz')
const actual = ref(0)
const ayuda = ref(false)
const tercero = ref<number | null>(null)
const abiertoTercero = computed({ get: () => tercero.value !== null, set: (v) => !v && (tercero.value = null) })

const porCodigo = computed(() => new Map(props.cuentas.map((c) => [c.codigo, c])))
const opcionesCuenta = computed(() => props.cuentas.filter((c) => c.activa && c.acepta_movimiento))
const opcionesTipo = computed(() => props.tipos.filter((t) => t.manual && t.activo).map((t) => ({ valor: t.codigo, etiqueta: `${t.codigo} · ${t.nombre}` })))
const opcionesCentro = computed(() => props.centros.filter((c) => c.activo).map((c) => ({ valor: c.codigo, etiqueta: `${c.codigo} · ${c.nombre}` })))
const t = computed(() => totales(modelo.value.lineas))
const avisos = computed(() => avisosComprobante(modelo.value, porCodigo.value))
const textoDiferencia = computed(() => {
  if (t.value.cuadra) return 'Cuadra'
  const d = t.value.diferencia
  return d.startsWith('-') ? `Faltan ${moneda(d.slice(1))} en débitos` : `Faltan ${moneda(d)} en créditos`
})

const necesita = (codigo: string) => porCodigo.value.get(codigo)

async function enfocar(i: number, campo = 'cuenta') {
  await nextTick()
  raiz.value?.querySelector<HTMLElement>(`[data-linea="${i}"] [data-campo="${campo}"] :is(input, select, button)`)?.focus()
}

function nuevaLinea(despues = actual.value) {
  modelo.value.lineas.splice(despues + 1, 0, lineaVacia())
  actual.value = despues + 1
  void enfocar(despues + 1)
}

function quitarLinea(i: number) {
  if (modelo.value.lineas.length <= 1) return
  modelo.value.lineas.splice(i, 1)
  actual.value = Math.min(i, modelo.value.lineas.length - 1)
  void enfocar(actual.value)
}

function duplicar(i: number) {
  modelo.value.lineas = duplicarLinea(modelo.value.lineas, i)
  actual.value = i + 1
  void enfocar(i + 1)
}

function cuadrar(i: number, lado: 'debito' | 'credito') {
  const l = modelo.value.lineas[i]
  const monto = montoQueCuadra(modelo.value.lineas, i, lado)
  if (!l || !monto) return
  l[lado] = monto
  l[lado === 'debito' ? 'credito' : 'debito'] = ''
}

function elegirTercero(p: OpcionPersona) {
  const l = tercero.value === null ? undefined : modelo.value.lineas[tercero.value]
  if (l) l.tercero = { id: p.id, nombre: p.nombre }
  const i = tercero.value
  tercero.value = null
  if (i !== null) void enfocar(i, 'centro')
}

function quitarTercero() {
  const l = tercero.value === null ? undefined : modelo.value.lineas[tercero.value]
  if (l) l.tercero = null
  tercero.value = null
}

async function buscar(q: string): Promise<OpcionPersona[]> {
  const r = await buscarTerceros(props.entidadId, q)
  return r.datos.map((x) => ({ id: x.persona_id, nombre: x.nombre, detalle: [x.tipo_documento, x.documento].filter(Boolean).join(' ') || null }))
}

/** Enter: siguiente celda del orden cuenta → tercero → centro → débito → crédito → siguiente línea. */
function siguienteCelda(origen: HTMLElement) {
  const celdas = [...(raiz.value?.querySelectorAll<HTMLElement>('[data-campo] :is(input, select, button)') ?? [])]
  const i = celdas.indexOf(origen)
  if (i < 0) return
  const siguiente = celdas[i + 1]
  if (siguiente && siguiente.closest('[data-linea]')) siguiente.focus()
  else nuevaLinea(modelo.value.lineas.length - 1)
}

function alTeclear(e: KeyboardEvent) {
  const objetivo = e.target as HTMLElement
  const ctrl = e.ctrlKey || e.metaKey
  const campo = objetivo.closest<HTMLElement>('[data-campo]')?.dataset.campo
  if (ctrl && e.shiftKey && e.key === 'Enter') {
    e.preventDefault()
    emit('contabilizar')
  } else if (ctrl && e.key === 'Enter') {
    e.preventDefault()
    nuevaLinea()
  } else if (ctrl && (e.key === 'd' || e.key === 'D')) {
    e.preventDefault()
    duplicar(actual.value)
  } else if (ctrl && e.key === 'Delete') {
    e.preventDefault()
    quitarLinea(actual.value)
  } else if (ctrl && (e.key === 's' || e.key === 'S')) {
    e.preventDefault()
    emit('guardar')
  } else if (e.altKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP')) {
    e.preventDefault()
    emit('previsualizar')
  } else if (e.key === '=' && (campo === 'debito' || campo === 'credito')) {
    e.preventDefault()
    cuadrar(actual.value, campo)
  } else if (e.key === '?' && !(objetivo instanceof HTMLInputElement || objetivo instanceof HTMLTextAreaElement)) {
    e.preventDefault()
    ayuda.value = true
  } else if (e.key === 'Enter' && campo && !e.shiftKey && !(objetivo instanceof HTMLButtonElement)) {
    e.preventDefault()
    siguienteCelda(objetivo)
  }
}

function alEnfocar(e: FocusEvent) {
  const fila = (e.target as HTMLElement).closest<HTMLElement>('[data-linea]')
  if (fila?.dataset.linea) actual.value = Number(fila.dataset.linea)
}
</script>

<template>
  <div
    ref="raiz"
    class="editor"
    aria-keyshortcuts="Control+Enter Control+D Control+Delete Alt+P Control+S Control+Shift+Enter"
    @keydown="alTeclear"
    @focusin="alEnfocar"
  >
    <div class="encabezado-comprobante">
      <HudSelector
        v-model="modelo.tipo"
        etiqueta="Tipo de comprobante"
        vacio="Elija el tipo"
        :opciones="opcionesTipo"
      />
      <HudFecha
        v-model="modelo.fecha"
        etiqueta="Fecha"
      />
      <HudCampo
        v-model="modelo.descripcion"
        class="ancho"
        etiqueta="Descripción"
      />
    </div>

    <div
      class="cabecera-lineas"
      aria-hidden="true"
    >
      <span>#</span><span>Cuenta</span><span>Tercero</span><span>Centro</span><span class="fin">Débito</span><span class="fin">Crédito</span><span />
    </div>
    <ol
      class="lineas"
      aria-label="Líneas del comprobante"
    >
      <li
        v-for="(l, i) in modelo.lineas"
        :key="l.clave"
        :data-linea="i"
        class="linea"
        :class="{ actual: actual === i }"
      >
        <span
          class="numero"
          aria-hidden="true"
        >{{ i + 1 }}</span>
        <div data-campo="cuenta">
          <SelectorCuenta
            v-model="l.cuenta"
            :opciones="opcionesCuenta"
            :etiqueta="`Cuenta de la línea ${i + 1}`"
            etiqueta-oculta
            @elegido="enfocar(i, 'tercero')"
          />
          <small
            v-if="necesita(l.cuenta)?.exige_tercero || necesita(l.cuenta)?.exige_centro_costo"
            class="exige"
          >Exige {{ [necesita(l.cuenta)?.exige_tercero ? 'tercero' : '', necesita(l.cuenta)?.exige_centro_costo ? 'centro' : ''].filter(Boolean).join(' y ') }}</small>
        </div>
        <div data-campo="tercero">
          <button
            type="button"
            class="tercero"
            :class="{ vacio: !l.tercero }"
            @click="tercero = i"
          >
            <IPersona aria-hidden="true" />
            <span>{{ l.tercero ? l.tercero.nombre || 'Tercero registrado' : 'Tercero' }}</span>
            <span class="solo-lector"> de la línea {{ i + 1 }}{{ l.tercero ? '' : ': sin elegir' }}</span>
          </button>
        </div>
        <div data-campo="centro">
          <HudSelector
            v-model="l.centro"
            :etiqueta="`Centro de costo de la línea ${i + 1}`"
            etiqueta-oculta
            vacio="—"
            :opciones="opcionesCentro"
          />
        </div>
        <div
          data-campo="debito"
          class="monto"
        >
          <HudCampoMonto
            v-model="l.debito"
            :etiqueta="`Débito de la línea ${i + 1}`"
            etiqueta-oculta
          />
        </div>
        <div
          data-campo="credito"
          class="monto"
        >
          <HudCampoMonto
            v-model="l.credito"
            :etiqueta="`Crédito de la línea ${i + 1}`"
            etiqueta-oculta
          />
        </div>
        <div class="acciones-linea">
          <HudBoton
            variante="fantasma"
            :deshabilitado="modelo.lineas.length <= 1"
            aria-keyshortcuts="Control+Delete"
            @click="quitarLinea(i)"
          >
            <IQuitar aria-hidden="true" /><span class="solo-lector">Quitar la línea {{ i + 1 }}</span>
          </HudBoton>
        </div>
      </li>
    </ol>
    <div class="botones">
      <HudBoton
        variante="secundario"
        aria-keyshortcuts="Control+Enter"
        @click="nuevaLinea(modelo.lineas.length - 1)"
      >
        <IMas aria-hidden="true" /> Agregar línea
      </HudBoton>
      <HudBoton
        variante="fantasma"
        aria-keyshortcuts="Shift+?"
        @click="ayuda = true"
      >
        Atajos de teclado
      </HudBoton>
    </div>

    <dl
      class="totales"
      aria-label="Totales del comprobante"
    >
      <div>
        <dt>Débitos</dt>
        <dd>{{ moneda(t.debito) }}</dd>
      </div>
      <div>
        <dt>Créditos</dt>
        <dd>{{ moneda(t.credito) }}</dd>
      </div>
      <div>
        <dt>Diferencia</dt>
        <dd>
          <HudInsignia :tono="t.cuadra ? 'exito' : 'aviso'">
            <span
              role="status"
              aria-live="polite"
            >{{ textoDiferencia }}</span>
          </HudInsignia>
        </dd>
      </div>
    </dl>
    <ul
      v-if="avisos.length"
      class="avisos"
      aria-label="Pendientes del comprobante"
    >
      <li
        v-for="a in avisos"
        :key="a"
      >
        {{ a }}
      </li>
    </ul>

    <HudDialogo
      v-model:abierto="abiertoTercero"
      :titulo="`Tercero de la línea ${(tercero ?? 0) + 1}`"
    >
      <SelectorPersona
        etiqueta="Buscar tercero por nombre o documento"
        :buscar="buscar"
        @elegir="elegirTercero"
      />
      <template #acciones>
        <HudBoton
          v-if="tercero !== null && modelo.lineas[tercero]?.tercero"
          variante="fantasma"
          @click="quitarTercero"
        >
          Quitar el tercero
        </HudBoton>
        <HudBoton
          variante="secundario"
          @click="tercero = null"
        >
          Cerrar
        </HudBoton>
      </template>
    </HudDialogo>
    <AyudaAtajos v-model:abierto="ayuda" />
  </div>
</template>

<style scoped>
.editor {
  display: grid;
  gap: 14px;
  min-width: 0;
  container-type: inline-size;
}

.encabezado-comprobante {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 12px;
}

.encabezado-comprobante .ancho {
  grid-column: 1 / -1;
}

.cabecera-lineas,
.linea {
  display: grid;
  grid-template-columns: 28px minmax(220px, 2.2fr) minmax(150px, 1.3fr) minmax(110px, 1fr) minmax(130px, 1fr) minmax(130px, 1fr) 48px;
  gap: 8px;
  align-items: start;
}

.linea > *,
.linea :deep(.marco),
.linea :deep(.hud-campo),
.linea :deep(.hud-selector) {
  min-width: 0;
}

/* Los controles nativos tienen un ancho mínimo propio: sin esto desbordan la celda. */
.linea :deep(input),
.linea :deep(select) {
  width: 100%;
  min-width: 0;
}

.cabecera-lineas {
  padding: 0 8px;
  color: var(--texto-3);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.fin {
  text-align: right;
}

.lineas {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.linea {
  padding: 6px 8px;
  border: 1px solid var(--linea);
  background: var(--superficie);
}

.linea.actual {
  border-color: var(--linea-fuerte);
}

.numero {
  align-self: center;
  color: var(--texto-3);
  font-family: var(--fuente-mono);
}

.monto :deep(input) {
  text-align: right;
}

.exige {
  color: var(--texto-3);
  font-size: 12px;
}

.tercero {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 44px;
  padding: 0 10px;
  overflow: hidden;
  border: 1px solid var(--linea-fuerte);
  border-radius: var(--radio);
  background: var(--superficie-solida);
  color: var(--texto);
  font: inherit;
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}

.tercero.vacio {
  color: var(--texto-3);
}

.tercero:focus-visible {
  outline: 2px solid var(--cian);
  outline-offset: 1px;
}

.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.totales {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px 28px;
  margin: 0;
}

.totales dt {
  color: var(--texto-3);
  font-size: 13px;
}

.totales dd {
  margin: 2px 0 0;
  font-family: var(--fuente-mono);
  font-size: 18px;
}

.avisos {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 10px 14px 10px 32px;
  border-left: 3px solid var(--ambar);
  color: var(--texto-2);
}

/* Si el editor es angosto (móvil, tableta o escritorio con el menú lateral), cada línea pasa a
   tarjeta: la cuenta arriba y los demás campos de a dos. */
@container (width < 860px) {
  .cabecera-lineas {
    display: none;
  }

  .linea {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .numero {
    grid-column: 1 / -1;
  }

  .linea > [data-campo='cuenta'] {
    grid-column: 1 / -1;
  }

  .acciones-linea {
    grid-column: 1 / -1;
    justify-self: end;
  }

  /* Sin la cabecera de columnas, cada campo vuelve a mostrar su etiqueta. */
  .linea [data-campo] :deep(label.solo-lector) {
    position: static;
    width: auto;
    height: auto;
    overflow: visible;
    clip: auto;
    color: var(--texto-3);
    font-size: 13px;
    white-space: normal;
  }
}
</style>
