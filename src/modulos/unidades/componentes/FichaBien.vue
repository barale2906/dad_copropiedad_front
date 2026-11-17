<script setup lang="ts">
/**
 * Ficha de un bien privado: datos (editar), anexos y usos exclusivos, titulares, residentes,
 * vehículos y mascotas, con su coeficiente vigente. Inactivarlo conserva su historia.
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { FichaBien, TipoBienPrivado, TipoUsoExclusivo, UsoBienPrivado, UsoExclusivo } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { usePestana } from '@/composables/usePestana'
import { coeficiente } from '@/formato/decimales'
import { fecha } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPestanas from '@/hud/componentes/HudPestanas.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import SelectorBien from '@/hud/componentes/SelectorBien.vue'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import { asignarUsoExclusivo, editarBien, fichaBien, inactivarBien, terminarUsoExclusivo, vincularPrincipal } from '../api'
import { TIPO_BIEN, TIPO_USO, TIPOS_ANEXO, USO_BIEN } from '../bienes'
import PanelMascotas from './PanelMascotas.vue'
import PanelResidentes from './PanelResidentes.vue'
import PanelTitulares from './PanelTitulares.vue'
import PanelVehiculos from './PanelVehiculos.vue'

const props = defineProps<{ bienId: string }>()

const entidad = useEntidad()
const bienes = useBienes()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const editable = computed(() => entidad.tienePermiso('bienes_privados.editar'))

const PESTANAS = computed(() => [
  { id: 'datos' as const, texto: 'Datos' },
  { id: 'anexos' as const, texto: 'Anexos y usos' },
  ...(entidad.tienePermiso('titulares.ver') ? [{ id: 'titulares' as const, texto: 'Titulares' }] : []),
  ...(entidad.tienePermiso('censo.ver')
    ? [
        { id: 'residentes' as const, texto: 'Residentes' },
        { id: 'vehiculos' as const, texto: 'Vehículos' },
        { id: 'mascotas' as const, texto: 'Mascotas' },
      ]
    : []),
])
const pestana = usePestana(PESTANAS.value)

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const ficha = ref<FichaBien | null>(null)
const resultado = ref<string | null>(null)
const bien = computed(() => ficha.value?.bien_privado ?? null)
const opciones = <T extends string>(m: Record<T, string>) => (Object.keys(m) as T[]).map((valor) => ({ valor, etiqueta: m[valor] }))

// Datos
const editando = ref(false)
const tipo = ref<TipoBienPrivado>('apartamento')
const uso = ref<UsoBienPrivado>('residencial')
const numero = ref('')
const piso = ref('')
const area = ref('')
const matricula = ref('')
const catastral = ref('')
const guardar = useAccion(() =>
  editarBien(id.value, props.bienId, {
    tipo: tipo.value,
    uso: uso.value,
    numero: numero.value.trim() || null,
    piso: /^-?\d+$/.test(piso.value.trim()) ? Number.parseInt(piso.value, 10) : null,
    area_privada_m2: area.value.trim().replace(',', '.') || null,
    matricula_inmobiliaria: matricula.value.trim() || null,
    cedula_catastral: catastral.value.trim() || null,
  }),
)

function abrirEdicion() {
  const b = bien.value
  if (!b) return
  tipo.value = b.tipo
  uso.value = b.uso
  numero.value = b.numero ?? ''
  piso.value = b.piso === null || b.piso === undefined ? '' : String(b.piso)
  area.value = b.area_privada_m2 ?? ''
  matricula.value = b.matricula_inmobiliaria ?? ''
  catastral.value = b.cedula_catastral ?? ''
  guardar.reiniciar()
  editando.value = true
}

async function enviarDatos() {
  const r = await guardar.ejecutar()
  if (!r.ok || !ficha.value) return
  ficha.value = { ...ficha.value, bien_privado: r.valor }
  editando.value = false
  resultado.value = 'Datos guardados.'
}

// Inactivar
const inactivando = ref(false)
const inactivar = useAccion(() => inactivarBien(id.value, props.bienId))

function abrirInactivar() {
  inactivar.reiniciar()
  inactivando.value = true
}

async function confirmarInactivar() {
  const r = await inactivar.ejecutar()
  if (!r.ok || !ficha.value) return
  ficha.value = { ...ficha.value, bien_privado: r.valor }
  inactivando.value = false
  resultado.value = 'Bien inactivo: conserva su historia y el próximo cuadro ya no lo incluye.'
}

// Anexo de un bien principal
const principal = ref('')
const vincular = useAccion((_c, p: string | null) => vincularPrincipal(id.value, props.bienId, p))
const buscarBien = async (q: string) => (await bienes.buscar(q)).datos.filter((b) => b.id !== props.bienId)

async function guardarPrincipal(p: string | null) {
  const r = await vincular.ejecutar(p)
  if (!r.ok || !ficha.value) return
  ficha.value = { ...ficha.value, bien_privado: r.valor }
  resultado.value = p ? `Vinculado como anexo de ${bienes.codigo(p)}.` : 'Ya no es anexo de otro bien.'
  principal.value = ''
}

// Usos exclusivos
const asignando = ref(false)
const tipoUso = ref<TipoUsoExclusivo>('parqueadero')
const codigoUso = ref('')
const descripcionUso = ref('')
const asignar = useAccion((clave) =>
  asignarUsoExclusivo(id.value, props.bienId, { tipo: tipoUso.value, codigo: codigoUso.value.trim(), descripcion: descripcionUso.value.trim() || null }, clave),
)
const terminarUso = useAccion((_c, u: UsoExclusivo) => terminarUsoExclusivo(id.value, props.bienId, u.id))

function abrirUso() {
  codigoUso.value = descripcionUso.value = ''
  asignar.reiniciar()
  asignando.value = true
}

async function enviarUso() {
  if (!codigoUso.value.trim()) return
  const r = await asignar.ejecutar()
  if (!r.ok || !ficha.value) return
  ficha.value = { ...ficha.value, usos_exclusivos: [...ficha.value.usos_exclusivos, r.valor] }
  asignando.value = false
  resultado.value = `Uso exclusivo ${r.valor.codigo} asignado.`
}

async function quitarUso(u: UsoExclusivo) {
  if (!(await terminarUso.ejecutar(u)).ok || !ficha.value) return
  ficha.value = { ...ficha.value, usos_exclusivos: ficha.value.usos_exclusivos.filter((x) => x.id !== u.id) }
  resultado.value = `Uso exclusivo ${u.codigo} terminado (queda en el historial).`
}

async function cargar() {
  estado.value = 'cargando'
  try {
    ficha.value = await fichaBien(id.value, props.bienId)
    bienes.recordar([ficha.value.bien_privado, ...ficha.value.anexos])
    const p = ficha.value.bien_privado.bien_principal_id
    if (p) await bienes.resolver([p])
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <div class="ficha-bien">
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
    <template v-else-if="ficha && bien">
      <div class="cabecera">
        <h2>{{ bien.codigo }}</h2>
        <HudInsignia :tono="bien.activo ? 'exito' : 'neutro'">
          {{ bien.activo ? 'Activo' : 'Inactivo' }}
        </HudInsignia>
        <span class="texto-2">
          {{ TIPO_BIEN[bien.tipo] }} · coeficiente {{ bien.coeficiente ? coeficiente(bien.coeficiente) : 'sin asignar' }}
        </span>
      </div>
      <HudPestanas
        :pestanas="PESTANAS"
        etiqueta="Secciones del bien"
      />
      <p
        v-if="resultado"
        class="ok"
        role="status"
      >
        {{ resultado }}
      </p>

      <HudPanel
        v-if="pestana === 'datos'"
        etiqueta="Datos del bien"
      >
        <form
          v-if="editando"
          class="rejilla"
          @submit.prevent="enviarDatos"
        >
          <HudSelector
            v-model="tipo"
            etiqueta="Tipo"
            :opciones="opciones(TIPO_BIEN)"
          />
          <HudSelector
            v-model="uso"
            etiqueta="Uso"
            :opciones="opciones(USO_BIEN)"
          />
          <HudCampo
            v-model="numero"
            etiqueta="Número"
          />
          <HudCampo
            v-model="piso"
            etiqueta="Piso"
            modo-entrada="numeric"
          />
          <HudCampo
            v-model="area"
            etiqueta="Área privada (m²)"
            modo-entrada="decimal"
          />
          <HudCampo
            v-model="matricula"
            etiqueta="Matrícula inmobiliaria"
          />
          <HudCampo
            v-model="catastral"
            etiqueta="Cédula catastral"
          />
          <p
            v-if="guardar.error.value"
            class="error"
            role="alert"
          >
            {{ guardar.error.value }}
          </p>
          <div class="botones">
            <HudBoton
              variante="fantasma"
              @click="editando = false"
            >
              Cancelar
            </HudBoton>
            <HudBoton
              tipo="submit"
              :cargando="guardar.cargando.value"
            >
              Guardar
            </HudBoton>
          </div>
        </form>
        <template v-else>
          <dl class="datos">
            <div><dt>Uso</dt><dd>{{ USO_BIEN[bien.uso] }}</dd></div>
            <div><dt>Número</dt><dd>{{ bien.numero ?? '—' }}</dd></div>
            <div><dt>Piso</dt><dd>{{ bien.piso ?? '—' }}</dd></div>
            <div><dt>Área privada</dt><dd>{{ bien.area_privada_m2 ? `${bien.area_privada_m2.replace('.', ',')} m²` : '—' }}</dd></div>
            <div><dt>Matrícula</dt><dd>{{ bien.matricula_inmobiliaria ?? '—' }}</dd></div>
            <div><dt>Cédula catastral</dt><dd>{{ bien.cedula_catastral ?? '—' }}</dd></div>
          </dl>
          <div
            v-if="editable && bien.activo"
            class="botones"
          >
            <HudBoton
              variante="secundario"
              @click="abrirEdicion"
            >
              Editar datos
            </HudBoton>
            <HudBoton
              variante="fantasma"
              @click="abrirInactivar"
            >
              Inactivar el bien
            </HudBoton>
          </div>
        </template>
      </HudPanel>

      <template v-else-if="pestana === 'anexos'">
        <HudPanel etiqueta="Anexos con folio propio">
          <p
            v-if="bien.bien_principal_id"
            class="texto-2"
          >
            Es anexo de <strong>{{ bienes.codigo(bien.bien_principal_id) }}</strong>.
            <HudBoton
              v-if="editable"
              variante="fantasma"
              @click="guardarPrincipal(null)"
            >
              Desvincular
            </HudBoton>
          </p>
          <ul
            v-if="ficha.anexos.length"
            class="lista"
            aria-label="Anexos"
          >
            <li
              v-for="a in ficha.anexos"
              :key="a.id"
            >
              {{ a.codigo }} · {{ TIPO_BIEN[a.tipo] }}
            </li>
          </ul>
          <p
            v-else-if="!bien.bien_principal_id"
            class="texto-2"
          >
            No tiene anexos.
          </p>
          <div
            v-if="editable && TIPOS_ANEXO.includes(bien.tipo) && !bien.bien_principal_id"
            class="vincular"
          >
            <SelectorBien
              v-model="principal"
              etiqueta="Bien principal"
              :buscar="buscarBien"
              :codigo-elegido="principal ? bienes.codigo(principal) : null"
            />
            <HudBoton
              variante="secundario"
              :deshabilitado="!principal"
              :cargando="vincular.cargando.value"
              @click="guardarPrincipal(principal)"
            >
              Vincular como anexo
            </HudBoton>
          </div>
          <p
            v-if="vincular.error.value"
            class="error"
            role="alert"
          >
            {{ vincular.error.value }}
          </p>
        </HudPanel>
        <HudPanel etiqueta="Usos exclusivos (art. 22)">
          <ul
            v-if="ficha.usos_exclusivos.length"
            class="lista"
            aria-label="Usos exclusivos"
          >
            <li
              v-for="u in ficha.usos_exclusivos"
              :key="u.id"
            >
              <span>{{ TIPO_USO[u.tipo] }} {{ u.codigo }}{{ u.descripcion ? ` · ${u.descripcion}` : '' }} · desde {{ fecha(u.vigente_desde, zona) }}</span>
              <HudBoton
                v-if="editable"
                variante="fantasma"
                @click="quitarUso(u)"
              >
                Terminar<span class="solo-lector"> el uso exclusivo {{ u.codigo }}</span>
              </HudBoton>
            </li>
          </ul>
          <p
            v-else
            class="texto-2"
          >
            Sin usos exclusivos.
          </p>
          <p
            v-if="terminarUso.error.value"
            class="error"
            role="alert"
          >
            {{ terminarUso.error.value }}
          </p>
          <HudBoton
            v-if="editable"
            variante="secundario"
            @click="abrirUso"
          >
            Asignar uso exclusivo
          </HudBoton>
        </HudPanel>
      </template>

      <HudPanel
        v-else-if="pestana === 'titulares'"
        etiqueta="Titulares"
      >
        <PanelTitulares
          :bien-id="bienId"
          :codigo="bien.codigo"
        />
      </HudPanel>
      <PanelResidentes
        v-else-if="pestana === 'residentes'"
        :bien-id="bienId"
      />
      <PanelVehiculos
        v-else-if="pestana === 'vehiculos'"
        :bien-id="bienId"
      />
      <PanelMascotas
        v-else-if="pestana === 'mascotas'"
        :bien-id="bienId"
      />
    </template>

    <HudDialogo
      v-model:abierto="inactivando"
      titulo="Inactivar el bien"
    >
      <p>{{ bien?.codigo }} quedará inactivo: conserva su historia, pero el próximo cuadro de coeficientes no lo incluye.</p>
      <p
        v-if="inactivar.error.value"
        class="error"
        role="alert"
      >
        {{ inactivar.error.value }}
      </p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="inactivando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          :cargando="inactivar.cargando.value"
          @click="confirmarInactivar"
        >
          Inactivar
        </HudBoton>
      </template>
    </HudDialogo>

    <HudDialogo
      v-model:abierto="asignando"
      titulo="Asignar uso exclusivo"
    >
      <form
        id="formulario-uso"
        class="campos"
        @submit.prevent="enviarUso"
      >
        <HudSelector
          v-model="tipoUso"
          etiqueta="Tipo"
          :opciones="opciones(TIPO_USO)"
        />
        <HudCampo
          v-model="codigoUso"
          etiqueta="Código"
          requerido
        />
        <HudCampo
          v-model="descripcionUso"
          etiqueta="Descripción (opcional)"
        />
        <p
          v-if="asignar.error.value"
          class="error"
          role="alert"
        >
          {{ asignar.error.value }}
        </p>
      </form>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="asignando = false"
        >
          Cancelar
        </HudBoton>
        <HudBoton
          tipo="submit"
          form="formulario-uso"
          :cargando="asignar.cargando.value"
        >
          Asignar
        </HudBoton>
      </template>
    </HudDialogo>
  </div>
</template>

<style scoped>
.ficha-bien,
.campos {
  display: grid;
  gap: 14px;
}

.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}

h2 {
  margin: 0;
  font-size: clamp(22px, 3vw, 28px);
}

.texto-2 {
  margin: 0;
  color: var(--texto-2);
}

.rejilla,
.datos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  align-items: end;
  gap: 12px 16px;
  margin: 0;
}

.datos {
  margin-bottom: 12px;
}

dt {
  color: var(--texto-3);
  font-size: 13px;
}

dd {
  margin: 2px 0 0;
}

.botones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  grid-column: 1 / -1;
}

.lista {
  display: grid;
  gap: 6px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
}

.lista li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--linea);
}

.vincular {
  display: grid;
  gap: 8px;
  justify-items: start;
}

.vincular > :first-child {
  width: 100%;
}

.ok,
.error {
  margin: 0;
}

.ok {
  padding: 10px 14px;
  border-left: 3px solid var(--verde);
  background: color-mix(in srgb, var(--verde) 10%, transparent);
}

.error {
  color: var(--magenta);
  grid-column: 1 / -1;
}
</style>
