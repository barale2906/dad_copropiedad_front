<script setup lang="ts">
/**
 * Ficha de la entidad: datos generales y de contacto, zona horaria y, en la PH, datos legales,
 * cargos vigentes, advertencias de la Ley 675, documentos legales y puntos de atención.
 */
import { computed, onMounted, ref } from 'vue'
import { abrirArchivo, subirArchivo } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { CambiosCopropiedad, Cargo, DatosCopropiedad, FichaEntidad } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fecha, fechaCalendario } from '@/formato/fechas'
import HudAdjuntos from '@/hud/componentes/HudAdjuntos.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { useEntidad } from '@/stores/entidad'
import IAlerta from '~icons/tabler/alert-triangle'
import IEditar from '~icons/tabler/edit'
import { editarCopropiedad, editarEntidad, fichaCopropiedad, fichaEntidad } from '../api'
import FormularioFicha from '../componentes/FormularioFicha.vue'
import PuntosAtencion from '../componentes/PuntosAtencion.vue'
import {
  ADVERTENCIA,
  aValores,
  cambiosDeFicha,
  FORMA_COPROPIEDAD,
  TIPO_COPROPIEDAD,
  type ValoresFicha,
} from '../ficha'

type Documento = 'reglamento_archivo_id' | 'certificado_archivo_id'

const entidad = useEntidad()
const entidadId = computed(() => entidad.activa?.entidad_id ?? '')
const editable = computed(() => entidad.tienePermiso('copropiedad.datos.editar'))

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const datos = ref<FichaEntidad | DatosCopropiedad | null>(null)
const cargos = ref<Cargo[]>([])
const advertencias = ref<string[]>([])
const editando = ref(false)
const guardado = ref(false)
const subiendo = ref<Documento | null>(null)
const errorDocumento = ref<string | null>(null)

const valores = computed(() => (datos.value ? aValores(datos.value) : null))
const ph = computed(() => (entidad.esPH && datos.value && 'plantilla_codigo' in datos.value ? datos.value : null))

/** Filas de la ficha para mostrar (se omiten las vacías). */
const filas = computed(() => {
  const d = datos.value
  if (!d) return []
  const lista: [string, string | null | undefined][] = [
    ['Razón social', d.razon_social],
    ['NIT', d.nit],
    ['Dirección', [d.direccion, d.barrio].filter(Boolean).join(', ')],
    ['Departamento', d.departamento],
    ['Municipio (DANE)', d.municipio_dane],
    ['Teléfono', d.telefono],
    ['Correo', d.correo],
    ['Sitio web', d.sitio_web],
    ['Zona horaria', d.zona_horaria],
  ]
  const p = ph.value
  if (p) {
    lista.push(
      ['Tipo', TIPO_COPROPIEDAD[p.tipo]],
      ['Forma', FORMA_COPROPIEDAD[p.forma]],
      ['Estrato', p.estrato ? String(p.estrato) : null],
      ['Escritura', [p.escritura_numero, p.notaria, p.escritura_fecha ? fechaCalendario(p.escritura_fecha) : null].filter(Boolean).join(' · ')],
      ['Matrícula matriz', p.matricula_matriz],
      ['Código de las unidades', p.plantilla_codigo],
    )
  }
  return lista.filter((f): f is [string, string] => !!f[1])
})

function documentos(campo: Documento, nombre: string) {
  const id = ph.value?.[campo]
  return id ? [{ id, nombre }] : []
}

async function guardarCambios(cambios: CambiosCopropiedad): Promise<void> {
  datos.value = entidad.esPH
    ? await editarCopropiedad(entidadId.value, cambios)
    : await editarEntidad(entidadId.value, cambios)
  await entidad.recargarFicha().catch(() => undefined)
}

const guardar = useAccion((_clave, cambios: CambiosCopropiedad) => guardarCambios(cambios))

async function enviar(editado: ValoresFicha) {
  if (!valores.value) return
  const cambios = cambiosDeFicha(valores.value, editado, entidad.esPH)
  if (Object.keys(cambios).length === 0) {
    editando.value = false
    return
  }
  const r = await guardar.ejecutar(cambios)
  if (!r.ok) return
  editando.value = false
  guardado.value = true
}

function abrirEdicion() {
  guardar.reiniciar()
  guardado.value = false
  editando.value = true
}

async function subirDocumento(campo: Documento, archivos: File[]) {
  const archivo = archivos[0]
  if (!archivo) return
  subiendo.value = campo
  errorDocumento.value = null
  try {
    const subido = await subirArchivo(entidadId.value, archivo, 'interno')
    await guardarCambios({ [campo]: subido.id })
  } catch (e) {
    errorDocumento.value = mensajeDeError(e)
  } finally {
    subiendo.value = null
  }
}

async function quitarDocumento(campo: Documento) {
  errorDocumento.value = null
  try {
    await guardarCambios({ [campo]: null })
  } catch (e) {
    errorDocumento.value = mensajeDeError(e)
  }
}

async function abrir(id: string) {
  errorDocumento.value = null
  try {
    await abrirArchivo(entidadId.value, id)
  } catch (e) {
    errorDocumento.value = mensajeDeError(e)
  }
}

async function cargar() {
  estado.value = 'cargando'
  try {
    if (entidad.esPH) {
      const f = await fichaCopropiedad(entidadId.value)
      datos.value = f.datos
      cargos.value = f.cargos
      advertencias.value = f.advertencias.map((a) => ADVERTENCIA[a])
    } else {
      datos.value = await fichaEntidad(entidadId.value)
    }
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(cargar)
</script>

<template>
  <section
    class="ficha"
    aria-labelledby="titulo-ficha"
  >
    <header class="encabezado">
      <div>
        <h1 id="titulo-ficha">
          Ficha
        </h1>
        <p class="texto-2">
          Datos generales y de contacto de la entidad.
        </p>
      </div>
      <HudBoton
        v-if="editable && estado === 'listo'"
        @click="abrirEdicion"
      >
        <IEditar aria-hidden="true" /> Editar
      </HudBoton>
    </header>

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
    <template v-else-if="datos">
      <p
        v-if="guardado"
        class="ok"
        role="status"
      >
        Ficha actualizada.
      </p>
      <ul
        v-if="advertencias.length"
        class="advertencias"
        aria-label="Advertencias"
      >
        <li
          v-for="a in advertencias"
          :key="a"
        >
          <IAlerta aria-hidden="true" /> {{ a }}
        </li>
      </ul>

      <HudPanel :etiqueta="datos.nombre">
        <dl class="datos">
          <div
            v-for="[etiqueta, valor] in filas"
            :key="etiqueta"
          >
            <dt>{{ etiqueta }}</dt>
            <dd>{{ valor }}</dd>
          </div>
        </dl>
      </HudPanel>

      <template v-if="ph">
        <HudPanel etiqueta="Cargos vigentes">
          <p
            v-if="cargos.length === 0"
            class="texto-2"
          >
            No hay cargos vigentes registrados.
          </p>
          <ul
            v-else
            class="cargos"
          >
            <li
              v-for="c in cargos"
              :key="`${c.rol}-${c.cuenta_id}`"
            >
              <span class="rol">{{ c.rol_nombre }}</span>
              <strong>{{ c.nombre }}</strong>
              <small>{{ c.organizacion ? `${c.organizacion} · ` : '' }}desde {{ fecha(c.vigente_desde, entidad.zonaHoraria) }}</small>
            </li>
          </ul>
        </HudPanel>

        <HudPanel etiqueta="Documentos legales">
          <div class="documentos">
            <div>
              <h2>Reglamento de propiedad horizontal</h2>
              <HudAdjuntos
                :adjuntos="documentos('reglamento_archivo_id', 'Reglamento de propiedad horizontal')"
                acepta="application/pdf"
                :subiendo="subiendo === 'reglamento_archivo_id'"
                :solo-lectura="!editable"
                @subir="subirDocumento('reglamento_archivo_id', $event)"
                @abrir="abrir"
                @quitar="quitarDocumento('reglamento_archivo_id')"
              />
            </div>
            <div>
              <h2>Certificado de existencia y representación legal</h2>
              <HudAdjuntos
                :adjuntos="documentos('certificado_archivo_id', 'Certificado de existencia y representación legal')"
                acepta="application/pdf"
                :subiendo="subiendo === 'certificado_archivo_id'"
                :solo-lectura="!editable"
                @subir="subirDocumento('certificado_archivo_id', $event)"
                @abrir="abrir"
                @quitar="quitarDocumento('certificado_archivo_id')"
              />
            </div>
          </div>
          <p
            v-if="errorDocumento"
            class="error"
            role="alert"
          >
            {{ errorDocumento }}
          </p>
        </HudPanel>

        <HudPanel etiqueta="Puntos de atención">
          <PuntosAtencion
            :copropiedad-id="entidadId"
            :editable="editable"
          />
        </HudPanel>
      </template>

      <FormularioFicha
        v-if="valores"
        v-model:abierto="editando"
        :valores="valores"
        :propiedad-horizontal="entidad.esPH"
        :cargando="guardar.cargando.value"
        :error="guardar.error.value"
        @enviar="enviar"
      />
    </template>
  </section>
</template>

<style scoped>
.ficha {
  display: grid;
  gap: 16px;
}

.encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

h1 {
  font-size: clamp(26px, 3.5vw, 34px);
}

h2 {
  margin: 0 0 8px;
  font-size: 17px;
}

.texto-2 {
  margin: 4px 0 0;
  color: var(--texto-2);
}

.datos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
  gap: 12px 20px;
  margin: 0;
}

.datos dt {
  color: var(--texto-3);
  font-size: 13px;
}

.datos dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}

.cargos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cargos li {
  display: grid;
}

.rol {
  color: var(--cian);
  font-size: 13px;
}

small {
  color: var(--texto-3);
}

.documentos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: 16px;
}

.advertencias {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 10px 14px;
  border-left: 3px solid var(--ambar);
  background: color-mix(in srgb, var(--ambar) 10%, transparent);
  list-style: none;
}

.advertencias li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ok {
  margin: 0;
  padding: 10px 14px;
  border-left: 3px solid var(--verde);
  background: color-mix(in srgb, var(--verde) 10%, transparent);
}

.error {
  margin: 8px 0 0;
  color: var(--magenta);
}
</style>
