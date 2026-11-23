<script setup lang="ts">
/**
 * Catálogo laboral de la nómina: parámetros por vigencia (salario mínimo, auxilio, porcentajes,
 * topes), las tablas por tramos (retención por salarios y fondo de solidaridad, siempre la
 * tabla completa) y las administradoras (EPS, fondos, cajas y ARL con su código PILA). Es
 * **solo inserción**: un error se corrige con otra versión; de las administradoras solo cambian
 * el nombre y si está activa.
 */
import { computed, onMounted, ref } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import type { Administradora, CatalogoLaboral, CodigoParametroLaboral, CodigoTablaLaboral, TipoAdministradora, TramoLaboral } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { opcionesDe } from '@/composables/textos-acceso'
import { leerDecimal, numero } from '@/formato/decimales'
import { hoyEn, sumarDias } from '@/formato/fechas'
import { PARAMETRO_LABORAL, TABLA_LABORAL, TIPO_ADMINISTRADORA, UNIDAD_PARAMETRO } from '@/formato/nomina'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import HudTabla from '@/hud/componentes/HudTabla.vue'
import { useEntidad } from '@/stores/entidad'
import { catalogoLaboral, crearAdministradora, crearParametroLaboral, crearTablaLaboral, editarAdministradora } from '../api-normativa'
import EditorTablaNormativa from './EditorTablaNormativa.vue'
import InsigniaVigencia from './InsigniaVigencia.vue'

const entidad = useEntidad()
const hoy = hoyEn(entidad.zonaHoraria)
const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const referencia = ref<string | null>(null)
const catalogo = ref<CatalogoLaboral>({ parametros: [], administradoras: [], tablas: [] })
const resultado = ref<string | null>(null)
const anio = ref('')

// Parámetros: la vigencia de cada versión termina el día antes de la siguiente del mismo parámetro.
const parametros = computed(() => {
  const orden = [...catalogo.value.parametros].sort((a, b) => a.parametro.localeCompare(b.parametro) || a.vigente_desde.localeCompare(b.vigente_desde))
  return orden
    .map((p, i) => {
      const sig = orden[i + 1]
      return { ...p, nombre: PARAMETRO_LABORAL[p.parametro], vigente_hasta: sig && sig.parametro === p.parametro ? sumarDias(sig.vigente_desde, -1) : null }
    })
    .filter((p) => !anio.value || p.vigente_desde.startsWith(anio.value))
})
const COL_PARAMETROS = [
  { clave: 'nombre', titulo: 'Parámetro' },
  { clave: 'valor', titulo: 'Valor', alinear: 'fin' as const },
  { clave: 'vigencia', titulo: 'Vigencia' },
]
const nuevoParametro = ref({ parametro: '' as CodigoParametroLaboral | '', valor: '', fuente: '', desde: '' })
const completoParametro = computed(() => {
  const n = nuevoParametro.value
  return !!(n.parametro && leerDecimal(n.valor, 6) && n.fuente.trim() && n.desde)
})
const crearParametro = useAccion(() => {
  const n = nuevoParametro.value
  if (!n.parametro) throw new Error('Sin parámetro')
  return crearParametroLaboral({ parametro: n.parametro, valor: leerDecimal(n.valor, 6) ?? '0', fuente: n.fuente.trim(), vigente_desde: n.desde })
})

async function enviarParametro(cerrar: () => void) {
  if (!completoParametro.value) return
  const r = await crearParametro.ejecutar()
  if (!r.ok) return
  catalogo.value = { ...catalogo.value, parametros: [...catalogo.value.parametros, r.valor] }
  resultado.value = `Versión de «${PARAMETRO_LABORAL[r.valor.parametro]}» registrada.`
  nuevoParametro.value = { parametro: '', valor: '', fuente: '', desde: '' }
  cerrar()
}

// Tablas por tramos
const nuevaTabla = ref({ tabla: '' as CodigoTablaLaboral | '', desde: '', fuente: '', tramos: [{ desde: '0', hasta: '', tarifa: '', adicional: '0' }] })
const tramosValidos = computed(() => nuevaTabla.value.tramos.every((t) => leerDecimal(t.desde, 4) !== null && leerDecimal(t.tarifa, 4) !== null && (t.hasta === '' || leerDecimal(t.hasta, 4) !== null)))
const completaTabla = computed(() => !!(nuevaTabla.value.tabla && nuevaTabla.value.desde && nuevaTabla.value.fuente.trim() && nuevaTabla.value.tramos.length && tramosValidos.value))
const crearTabla = useAccion(() => {
  const n = nuevaTabla.value
  if (!n.tabla) throw new Error('Sin tabla')
  const tramos: TramoLaboral[] = n.tramos.map((t) => ({ desde: leerDecimal(t.desde, 4) ?? '0', hasta: t.hasta === '' ? null : leerDecimal(t.hasta, 4), tarifa: leerDecimal(t.tarifa, 4) ?? '0', adicional: leerDecimal(t.adicional || '0', 4) ?? '0' }))
  return crearTablaLaboral({ tabla: n.tabla, vigente_desde: n.desde, fuente: n.fuente.trim(), tramos })
})

function agregarTramo() {
  const ultimo = nuevaTabla.value.tramos.at(-1)
  nuevaTabla.value.tramos.push({ desde: ultimo?.hasta ?? '', hasta: '', tarifa: '', adicional: '0' })
}

function quitarTramo(i: number) {
  nuevaTabla.value.tramos.splice(i, 1)
}

async function enviarTabla(cerrar: () => void) {
  if (!completaTabla.value) return
  const r = await crearTabla.ejecutar()
  if (!r.ok) return
  catalogo.value = { ...catalogo.value, tablas: [...catalogo.value.tablas, r.valor] }
  resultado.value = `Tabla «${TABLA_LABORAL[r.valor.tabla]}» registrada.`
  nuevaTabla.value = { tabla: '', desde: '', fuente: '', tramos: [{ desde: '0', hasta: '', tarifa: '', adicional: '0' }] }
  cerrar()
}

const tablas = computed(() => [...catalogo.value.tablas].sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde)))
const tramoTexto = (t: TramoLaboral) => `${numero(t.desde)} a ${t.hasta ? numero(t.hasta) : 'en adelante'}: ${numero(t.tarifa)} %${t.adicional && t.adicional !== '0' ? ` + ${numero(t.adicional)}` : ''}`

// Administradoras
const COL_ADMIN = [
  { clave: 'nombre', titulo: 'Administradora' },
  { clave: 'tipoTexto', titulo: 'Tipo' },
  { clave: 'codigo', titulo: 'Código PILA' },
  { clave: 'activa', titulo: 'Estado' },
]
const administradoras = computed(() =>
  [...catalogo.value.administradoras].map((a) => ({ ...a, tipoTexto: TIPO_ADMINISTRADORA[a.tipo] })).sort((a, b) => a.tipoTexto.localeCompare(b.tipoTexto) || a.nombre.localeCompare(b.nombre)),
)
const nuevaAdmin = ref({ tipo: '' as TipoAdministradora | '', codigo: '', nit: '', nombre: '' })
const completaAdmin = computed(() => !!(nuevaAdmin.value.tipo && nuevaAdmin.value.codigo.trim() && nuevaAdmin.value.nit.trim() && nuevaAdmin.value.nombre.trim()))
const crearAdmin = useAccion(() => {
  const n = nuevaAdmin.value
  if (!n.tipo) throw new Error('Sin tipo')
  return crearAdministradora({ tipo: n.tipo, codigo: n.codigo.trim(), nit: n.nit.trim(), nombre: n.nombre.trim() })
})
const cambiarAdmin = useAccion((_c, a: Administradora) => editarAdministradora(a.id, { nombre: a.nombre, activa: !a.activa }))

async function enviarAdmin(cerrar: () => void) {
  if (!completaAdmin.value) return
  const r = await crearAdmin.ejecutar()
  if (!r.ok) return
  catalogo.value = { ...catalogo.value, administradoras: [...catalogo.value.administradoras, r.valor] }
  resultado.value = `Administradora «${r.valor.nombre}» registrada.`
  nuevaAdmin.value = { tipo: '', codigo: '', nit: '', nombre: '' }
  cerrar()
}

async function alternar(a: Administradora) {
  const r = await cambiarAdmin.ejecutar(a)
  if (!r.ok) return
  catalogo.value = { ...catalogo.value, administradoras: catalogo.value.administradoras.map((x) => (x.id === r.valor.id ? r.valor : x)) }
  resultado.value = `${r.valor.nombre} quedó ${r.valor.activa ? 'activa' : 'inactiva'}.`
}

async function cargar() {
  estado.value = 'cargando'
  try {
    catalogo.value = await catalogoLaboral()
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    referencia.value = e instanceof ErrorApi ? e.requestId : null
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
    :referencia="referencia"
    @reintentar="cargar()"
  />
  <template v-else>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>

    <EditorTablaNormativa
      v-model:anio="anio"
      titulo="Parámetros laborales"
      descripcion="Lo que usan los contratos y la liquidación. Solo se agregan versiones: un error se corrige con otra versión."
      :anios="catalogo.parametros.map((p) => Number(p.vigente_desde.slice(0, 4)))"
      accion="Nueva versión"
    >
      <template #formulario="{ cerrar }">
        <form
          class="filtros"
          novalidate
          @submit.prevent="enviarParametro(cerrar)"
        >
          <HudSelector
            v-model="nuevoParametro.parametro"
            etiqueta="Parámetro"
            vacio="Elija el parámetro"
            :opciones="opcionesDe(PARAMETRO_LABORAL)"
          />
          <HudCampo
            v-model="nuevoParametro.valor"
            etiqueta="Valor"
            modo-entrada="decimal"
          />
          <HudFecha
            v-model="nuevoParametro.desde"
            etiqueta="Vigente desde"
          />
          <HudCampo
            v-model="nuevoParametro.fuente"
            etiqueta="Fuente (decreto o ley)"
          />
          <div>
            <HudBoton
              tipo="submit"
              :deshabilitado="!completoParametro"
              :cargando="crearParametro.cargando.value"
            >
              Registrar versión
            </HudBoton>
          </div>
        </form>
        <p
          v-if="crearParametro.error.value"
          class="error"
          role="alert"
        >
          {{ crearParametro.error.value }}
        </p>
      </template>
      <HudEstado
        v-if="!parametros.length"
        estado="vacio"
        mensaje="No hay parámetros para ese año."
      />
      <HudTabla
        v-else
        :filas="parametros"
        :columnas="COL_PARAMETROS"
        clave="id"
        titulo="Parámetros laborales"
      >
        <template #celda-nombre="{ fila }">
          <span class="crece">
            <span>{{ fila.nombre }}</span>
            <small>{{ fila.fuente }}</small>
          </span>
        </template>
        <template #celda-valor="{ fila }">
          <span class="cifra">{{ numero(fila.valor) }}</span> <small>{{ UNIDAD_PARAMETRO[fila.unidad] }}</small>
        </template>
        <template #celda-vigencia="{ fila }">
          <InsigniaVigencia
            :version="fila"
            :hoy="hoy"
          />
        </template>
      </HudTabla>
    </EditorTablaNormativa>

    <EditorTablaNormativa
      titulo="Tablas por tramos"
      descripcion="Retención en la fuente por salarios y fondo de solidaridad pensional. Se carga la tabla completa desde su fecha."
      accion="Nueva tabla"
    >
      <template #formulario="{ cerrar }">
        <form
          class="campos"
          novalidate
          @submit.prevent="enviarTabla(cerrar)"
        >
          <div class="filtros">
            <HudSelector
              v-model="nuevaTabla.tabla"
              etiqueta="Tabla"
              vacio="Elija la tabla"
              :opciones="opcionesDe(TABLA_LABORAL)"
            />
            <HudFecha
              v-model="nuevaTabla.desde"
              etiqueta="Vigente desde"
            />
            <HudCampo
              v-model="nuevaTabla.fuente"
              etiqueta="Fuente"
            />
          </div>
          <fieldset
            v-for="(t, i) in nuevaTabla.tramos"
            :key="i"
            class="filtros tramo"
          >
            <legend class="solo-lector">
              Tramo {{ i + 1 }}
            </legend>
            <HudCampo
              v-model="t.desde"
              :etiqueta="`Desde (tramo ${i + 1})`"
              modo-entrada="decimal"
            />
            <HudCampo
              v-model="t.hasta"
              :etiqueta="`Hasta (tramo ${i + 1})`"
              ayuda="Vacío: en adelante"
              modo-entrada="decimal"
            />
            <HudCampo
              v-model="t.tarifa"
              :etiqueta="`Tarifa % (tramo ${i + 1})`"
              modo-entrada="decimal"
            />
            <HudCampo
              v-model="t.adicional"
              :etiqueta="`Adicional (tramo ${i + 1})`"
              modo-entrada="decimal"
            />
            <HudBoton
              v-if="nuevaTabla.tramos.length > 1"
              variante="fantasma"
              @click="quitarTramo(i)"
            >
              Quitar<span class="solo-lector"> el tramo {{ i + 1 }}</span>
            </HudBoton>
          </fieldset>
          <div class="botones">
            <HudBoton
              variante="secundario"
              @click="agregarTramo"
            >
              Agregar tramo
            </HudBoton>
            <HudBoton
              tipo="submit"
              :deshabilitado="!completaTabla"
              :cargando="crearTabla.cargando.value"
            >
              Registrar la tabla
            </HudBoton>
          </div>
        </form>
        <p
          v-if="crearTabla.error.value"
          class="error"
          role="alert"
        >
          {{ crearTabla.error.value }}
        </p>
      </template>
      <ul
        class="lista"
        aria-label="Tablas por tramos"
      >
        <li
          v-for="t in tablas"
          :key="`${t.tabla}-${t.vigente_desde}`"
        >
          <span class="crece">
            <strong>{{ TABLA_LABORAL[t.tabla] }}</strong>
            <small>{{ t.fuente }}</small>
            <small
              v-for="(r, i) in t.tramos"
              :key="i"
            >{{ tramoTexto(r) }}</small>
          </span>
          <InsigniaVigencia
            :version="t"
            :hoy="hoy"
          />
        </li>
      </ul>
    </EditorTablaNormativa>

    <EditorTablaNormativa
      titulo="Administradoras"
      descripcion="EPS, fondos de pensiones y cesantías, cajas de compensación y ARL. Los contratos y las planillas las usan por su código PILA."
      accion="Nueva administradora"
    >
      <template #formulario="{ cerrar }">
        <form
          class="filtros"
          novalidate
          @submit.prevent="enviarAdmin(cerrar)"
        >
          <HudSelector
            v-model="nuevaAdmin.tipo"
            etiqueta="Tipo"
            vacio="Elija el tipo"
            :opciones="opcionesDe(TIPO_ADMINISTRADORA)"
          />
          <HudCampo
            v-model="nuevaAdmin.nombre"
            etiqueta="Nombre"
          />
          <HudCampo
            v-model="nuevaAdmin.codigo"
            etiqueta="Código PILA"
          />
          <HudCampo
            v-model="nuevaAdmin.nit"
            etiqueta="NIT"
          />
          <div>
            <HudBoton
              tipo="submit"
              :deshabilitado="!completaAdmin"
              :cargando="crearAdmin.cargando.value"
            >
              Registrar administradora
            </HudBoton>
          </div>
        </form>
        <p
          v-if="crearAdmin.error.value"
          class="error"
          role="alert"
        >
          {{ crearAdmin.error.value }}
        </p>
      </template>
      <p
        v-if="cambiarAdmin.error.value"
        class="error"
        role="alert"
      >
        {{ cambiarAdmin.error.value }}
      </p>
      <HudTabla
        :filas="administradoras"
        :columnas="COL_ADMIN"
        clave="id"
        titulo="Administradoras"
      >
        <template #celda-nombre="{ fila }">
          <span class="crece">
            <span>{{ fila.nombre }}</span>
            <small>NIT {{ fila.nit }}</small>
          </span>
        </template>
        <template #celda-activa="{ fila }">
          <HudInsignia :tono="fila.activa ? 'exito' : 'neutro'">
            {{ fila.activa ? 'Activa' : 'Inactiva' }}
          </HudInsignia>
          <HudBoton
            variante="fantasma"
            @click="alternar(fila)"
          >
            {{ fila.activa ? 'Inactivar' : 'Activar' }}<span class="solo-lector"> {{ fila.nombre }}</span>
          </HudBoton>
        </template>
      </HudTabla>
    </EditorTablaNormativa>
  </template>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
<style scoped>
.tramo {
  margin: 0;
  padding: 10px 0 0;
  border: 0;
  border-top: 1px solid var(--linea);
}
</style>
