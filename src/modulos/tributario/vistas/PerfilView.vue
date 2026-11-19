<script setup lang="ts">
/**
 * Perfil tributario versionado: la versión vigente (confirmada) y el borrador. Lo confirmado no se
 * edita: se crea una versión nueva (con el RUT de soporte) y la **confirma** el contador
 * (`tributario.perfil.confirmar`). Sin perfil confirmado no se emiten documentos ni hay ventas con
 * IVA: se avisa aquí y en los demás módulos (`usePerfilTributario`).
 */
import { computed, onMounted, ref } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { CanalFacturacion, ParametrosPerfil, PerfilTributario, ResponsabilidadFiscal } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useAdjuntos } from '@/composables/useAdjuntos'
import { fechaCalendario, fechaHora, hoyEn } from '@/formato/fechas'
import { CANAL_FACTURACION, RESPONSABILIDAD } from '@/formato/tributario'
import HudAdjuntos from '@/hud/componentes/HudAdjuntos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { useCuenta } from '@/stores/cuenta'
import { useEntidad } from '@/stores/entidad'
import { usePerfilTributario } from '@/stores/perfil-tributario'
import { confirmarPerfil, crearPerfil } from '../api'
import { avisosPerfil, leerCodigos, OBLIGACIONES, parametrosVacios } from '../reglas'

const entidad = useEntidad()
const cuenta = useCuenta()
const perfil = usePerfilTributario()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const configura = computed(() => entidad.tienePermiso('tributario.configurar'))
const confirma = computed(() => entidad.tienePermiso('tributario.perfil.confirmar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const resultado = ref<string | null>(null)
const historial = computed(() => [...perfil.perfiles].sort((a, b) => b.version - a.version))

// Formulario de versión nueva
const editando = ref(false)
const desde = ref(hoyEn(zona.value))
const parametros = ref<ParametrosPerfil>(parametrosVacios())
const municipios = ref('')
const actividades = ref('')
const observaciones = ref('')
const soporte = useAdjuntos(() => id.value, 'interno')
const problema = ref<string | null>(null)
const avisos = computed(() => avisosPerfil({ ...parametros.value, municipios_ica: leerCodigos(municipios.value, 5).codigos, actividades_ica: leerCodigos(actividades.value, 4).codigos }))
const opcionesCanal = (Object.keys(CANAL_FACTURACION) as CanalFacturacion[]).map((valor) => ({ valor, etiqueta: CANAL_FACTURACION[valor] }))

const crear = useAccion(() =>
  crearPerfil(id.value, {
    vigente_desde: desde.value,
    parametros: { ...parametros.value, municipios_ica: leerCodigos(municipios.value, 5).codigos, actividades_ica: leerCodigos(actividades.value, 4).codigos },
    soporte_archivo_id: soporte.ids()[0] ?? null,
    observaciones: observaciones.value.trim() || null,
  }),
)
const confirmando = ref<PerfilTributario | null>(null)
const abiertoConfirmar = computed({ get: () => !!confirmando.value, set: (v) => !v && (confirmando.value = null) })
const confirmar = useAccion((_c, p: PerfilTributario) => confirmarPerfil(id.value, p.id))

function nueva() {
  const base = perfil.borrador ?? perfil.vigente
  parametros.value = base ? JSON.parse(JSON.stringify(base.parametros)) : parametrosVacios()
  municipios.value = (base?.parametros.municipios_ica ?? []).join(', ')
  actividades.value = (base?.parametros.actividades_ica ?? []).join(', ')
  observaciones.value = ''
  soporte.limpiar()
  editando.value = true
}

function alternarResponsabilidad(r: ResponsabilidadFiscal) {
  const actual = parametros.value.responsabilidades ?? []
  parametros.value.responsabilidades = actual.includes(r) ? actual.filter((x) => x !== r) : [...actual, r]
}

async function alCrear() {
  const malos = [...leerCodigos(municipios.value, 5).invalidos, ...leerCodigos(actividades.value, 4).invalidos]
  if (malos.length) {
    problema.value = `Revise estos códigos: ${malos.join(', ')} (municipios DANE de 5 dígitos; actividades CIIU de 4).`
    return
  }
  problema.value = null
  const r = await crear.ejecutar()
  if (!r.ok) return
  editando.value = false
  resultado.value = `Versión ${r.valor.version} guardada en borrador: falta que la confirme el contador.`
  await perfil.recargar()
}

async function alConfirmar() {
  const p = confirmando.value
  if (!p) return
  const r = await confirmar.ejecutar(p)
  confirmando.value = null
  if (!r.ok) return
  resultado.value = `Versión ${r.valor.version} confirmada: rige desde el ${fechaCalendario(r.valor.vigente_desde)}.`
  await perfil.recargar()
}

const resumen = (p: ParametrosPerfil) =>
  [...OBLIGACIONES.filter((o) => p[o.clave]).map((o) => o.texto), ...(p.responsabilidades ?? []).map((r) => RESPONSABILIDAD[r])].join(' · ') || 'Sin obligaciones marcadas'

async function cargar() {
  try {
    await Promise.all([perfil.recargar(), cuenta.asegurar().catch(() => undefined)])
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section aria-labelledby="titulo-perfil">
    <header class="encabezado">
      <h1 id="titulo-perfil">
        Perfil tributario
      </h1>
      <HudBoton
        v-if="configura && !editando && estado === 'listo'"
        @click="nueva"
      >
        Nueva versión
      </HudBoton>
    </header>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
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
    <template v-else>
      <p
        v-if="perfil.sinConfirmar"
        class="aviso"
      >
        No hay un perfil tributario confirmado: no se emiten documentos electrónicos ni se registran ventas con IVA hasta que el contador confirme una versión.
      </p>

      <HudPanel
        v-if="editando"
        etiqueta="Versión nueva"
      >
        <form
          class="campos"
          @submit.prevent="alCrear"
        >
          <div class="filtros">
            <HudFecha
              v-model="desde"
              etiqueta="Rige desde"
            />
            <HudSelector
              v-model="parametros.canal_facturacion"
              etiqueta="Facturación electrónica"
              :opciones="opcionesCanal"
            />
          </div>
          <fieldset class="grupo">
            <legend>Obligaciones</legend>
            <label
              v-for="o in OBLIGACIONES"
              :key="o.clave"
              class="casilla"
            >
              <input
                v-model="parametros[o.clave]"
                type="checkbox"
              > {{ o.texto }}
            </label>
          </fieldset>
          <fieldset class="grupo">
            <legend>Responsabilidades del RUT</legend>
            <label
              v-for="(texto, codigo) in RESPONSABILIDAD"
              :key="codigo"
              class="casilla"
            >
              <input
                type="checkbox"
                :checked="(parametros.responsabilidades ?? []).includes(codigo)"
                @change="alternarResponsabilidad(codigo)"
              > {{ texto }}
            </label>
          </fieldset>
          <div class="filtros">
            <HudCampo
              v-model="municipios"
              etiqueta="Municipios donde declara ICA"
              ayuda="Códigos DANE separados por coma (11001, 05001)."
            />
            <HudCampo
              v-model="actividades"
              etiqueta="Actividades CIIU"
              ayuda="Separadas por coma (8110)."
            />
          </div>
          <HudCampo
            v-model="observaciones"
            etiqueta="Observaciones (opcional)"
            multilinea
          />
          <div class="campos">
            <small>RUT u otro soporte (opcional)</small>
            <HudAdjuntos
              :adjuntos="soporte.adjuntos.value"
              acepta="application/pdf,image/*"
              :subiendo="soporte.subiendo.value"
              @subir="soporte.subir"
              @abrir="soporte.abrir"
              @quitar="soporte.quitar"
            />
          </div>
          <ul
            v-if="avisos.length"
            class="lista"
            aria-label="Revise antes de guardar"
          >
            <li
              v-for="a in avisos"
              :key="a"
              class="aviso"
            >
              {{ a }}
            </li>
          </ul>
          <p
            v-if="problema ?? crear.error.value ?? soporte.error.value"
            class="error"
            role="alert"
          >
            {{ problema ?? crear.error.value ?? soporte.error.value }}
          </p>
          <div class="botones">
            <HudBoton
              tipo="submit"
              :cargando="crear.cargando.value"
            >
              Guardar en borrador
            </HudBoton>
            <HudBoton
              variante="fantasma"
              @click="editando = false"
            >
              Cancelar
            </HudBoton>
          </div>
        </form>
      </HudPanel>

      <HudPanel etiqueta="Versiones">
        <HudEstado
          v-if="!historial.length"
          estado="vacio"
          mensaje="Todavía no hay versiones del perfil tributario."
        />
        <ol
          v-else
          class="lista"
          aria-label="Versiones del perfil"
        >
          <li
            v-for="p in historial"
            :key="p.id"
          >
            <span class="crece">
              <strong>Versión {{ p.version }} · rige desde el {{ fechaCalendario(p.vigente_desde) }}</strong>
              <small>{{ resumen(p.parametros) }}</small>
              <small>{{ CANAL_FACTURACION[p.parametros.canal_facturacion] }}</small>
              <small v-if="p.observaciones">{{ p.observaciones }}</small>
              <small v-if="p.confirmado_en">Confirmada el {{ fechaHora(p.confirmado_en, zona) }}{{ p.confirmado_por === cuenta.id ? ' por usted' : '' }}</small>
            </span>
            <HudInsignia :tono="p.estado === 'confirmado' ? (p.id === perfil.vigente?.id ? 'exito' : 'neutro') : 'aviso'">
              {{ p.estado === 'borrador' ? 'Borrador' : p.id === perfil.vigente?.id ? 'Vigente' : 'Confirmada' }}
            </HudInsignia>
            <HudBoton
              v-if="p.estado === 'borrador' && confirma"
              :cargando="confirmar.cargando.value"
              @click="confirmando = p"
            >
              Confirmar<span class="solo-lector"> la versión {{ p.version }}</span>
            </HudBoton>
          </li>
        </ol>
        <p
          v-if="confirmar.error.value"
          class="error"
          role="alert"
        >
          {{ confirmar.error.value }}
        </p>
      </HudPanel>
    </template>
    <HudDialogo
      v-model:abierto="abiertoConfirmar"
      :titulo="`Confirmar la versión ${confirmando?.version ?? ''}`"
    >
      <p>Al confirmarla, el sistema aplica estas obligaciones desde el {{ confirmando ? fechaCalendario(confirmando.vigente_desde) : '' }} (retenciones, IVA, ICA y facturación). Lo confirmado ya no se edita: para cambiarlo se crea otra versión.</p>
      <template #acciones>
        <HudBoton
          variante="fantasma"
          @click="confirmando = null"
        >
          Volver
        </HudBoton>
        <HudBoton
          :cargando="confirmar.cargando.value"
          @click="alConfirmar"
        >
          Confirmar el perfil
        </HudBoton>
      </template>
    </HudDialogo>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
<style scoped>
.grupo {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  border: 0;
}

.grupo legend {
  margin-bottom: 6px;
  color: var(--texto-2);
}
</style>
