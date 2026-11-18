<script setup lang="ts">
/**
 * Conducir la asamblea: quórum en vivo (refresco cada 5 s; el backend dice si hay quórum),
 * abrir el registro, instalar, suspender, reanudar y cerrar; segunda convocatoria si no hubo
 * quórum (art. 41); foto del quórum para el acta y avance del orden del día.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mensajeDeError } from '@/api/errores'
import type { AccionReunion, DetalleReunion, EstadoPunto, PuntoOrdenDia, TableroReunion } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { useListado } from '@/composables/useListado'
import { useRefresco } from '@/composables/useRefresco'
import { fechaHora } from '@/formato/fechas'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import MedidorQuorum from '@/hud/componentes/MedidorQuorum.vue'
import { useEntidad } from '@/stores/entidad'
import { detalleReunion, estadoPunto, fotoQuorum, listarReuniones, segundaConvocatoria, tablero, transicionReunion } from '../api'
import { ACCION_REUNION, accionesReunion, CONVOCATORIA, ESTADO_PUNTO, ESTADO_REUNION, umbralQuorum } from '../reglas'

const route = useRoute()
const router = useRouter()
const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const zona = computed(() => entidad.zonaHoraria)
const reunionId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const ruta = (accion: string, r = '') => ({ name: 'modulo', params: { ...route.params, accion, id: r }, query: {} })
const conduce = computed(() => entidad.tienePermiso('asambleas.conducir'))

const enCurso = useListado(async (despues) => {
  const p = await listarReuniones(id.value, despues)
  return { ...p, datos: p.datos.filter((r) => ['convocada', 'en_registro', 'instalada', 'suspendida'].includes(r.estado)) }
}, { inmediato: !reunionId.value })

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const vivo = ref<TableroReunion | null>(null)
const detalle = ref<DetalleReunion | null>(null)
const resultado = ref<string | null>(null)
const r = computed(() => vivo.value?.reunion ?? null)
const acciones = computed(() =>
  r.value ? accionesReunion(r.value.estado, { convocar: entidad.tienePermiso('asambleas.convocar'), conducir: conduce.value }) : [],
)
const sinQuorumEnRegistro = computed(() => r.value?.estado === 'en_registro' && !vivo.value?.hay_quorum)

// Confirmaciones
const cerrando = ref(false)
const cancelando = ref(false)
const transicion = useAccion((_c, accion: AccionReunion, motivo?: string) => transicionReunion(id.value, reunionId.value, accion, motivo), {
  alConflicto: () => cargar(),
})
const segunda = useAccion(() => segundaConvocatoria(id.value, reunionId.value, { whatsapp: true, correo: true }))
const foto = useAccion(() => fotoQuorum(id.value, reunionId.value))
const punto = useAccion((_c, p: PuntoOrdenDia, e: EstadoPunto) => estadoPunto(id.value, reunionId.value, p.id, e))
const HECHO: Record<AccionReunion, string> = {
  abrir_registro: 'Registro abierto: la mesa ya puede inscribir asistentes.',
  instalar: 'Asamblea instalada.',
  suspender: 'Asamblea suspendida.',
  reanudar: 'Asamblea reanudada.',
  cerrar: 'Asamblea cerrada.',
  cancelar: 'Reunión cancelada.',
}

async function hacer(accion: AccionReunion, motivo?: string) {
  if (accion === 'cerrar' && !cerrando.value) {
    cerrando.value = true
    return
  }
  if (accion === 'cancelar' && motivo === undefined) {
    cancelando.value = true
    return
  }
  const res = await transicion.ejecutar(accion, motivo)
  cerrando.value = cancelando.value = false
  if (!res.ok) return
  resultado.value = HECHO[accion]
  await cargar()
}

async function convocarSegunda() {
  const res = await segunda.ejecutar()
  if (!res.ok) return
  resultado.value = `Segunda convocatoria enviada para ${fechaHora(res.valor.reunion.fecha_programada, zona.value)} (decide cualquier número de asistentes).`
  await router.push(ruta('reuniones', res.valor.reunion.id))
}

async function tomarFoto() {
  const res = await foto.ejecutar()
  if (res.ok) resultado.value = `Quórum registrado para el acta: ${res.valor.porcentaje_coeficiente} % del coeficiente.`
}

async function avanzarPunto(p: PuntoOrdenDia, e: EstadoPunto) {
  if (!(await punto.ejecutar(p, e)).ok) return
  resultado.value = `«${p.titulo}»: ${ESTADO_PUNTO[e].texto.toLowerCase()}.`
  await cargar()
}

async function cargar() {
  if (!reunionId.value) return
  try {
    const [t, d] = await Promise.all([tablero(id.value, reunionId.value), detalleReunion(id.value, reunionId.value)])
    vivo.value = t
    detalle.value = d
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    if (estado.value !== 'listo') estado.value = 'error'
  }
}

useRefresco(async () => {
  if (!reunionId.value || estado.value !== 'listo') return
  vivo.value = await tablero(id.value, reunionId.value)
}, { cada: 5_000 })
watch(reunionId, () => {
  estado.value = 'cargando'
  resultado.value = null
  void cargar()
}, { immediate: true })
</script>

<template>
  <section aria-labelledby="titulo-conducir">
    <template v-if="reunionId">
      <HudEstado
        v-if="estado === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="estado === 'error' || !vivo || !r || !detalle"
        estado="error"
        :mensaje="error ?? undefined"
        @reintentar="cargar"
      />
      <template v-else>
        <header class="encabezado">
          <div>
            <small>{{ CONVOCATORIA[r.convocatoria] }} · {{ fechaHora(r.fecha_programada, zona) }}</small>
            <h1 id="titulo-conducir">
              {{ r.titulo }}
            </h1>
          </div>
          <HudInsignia :tono="ESTADO_REUNION[r.estado].tono">
            {{ ESTADO_REUNION[r.estado].texto }}
          </HudInsignia>
        </header>
        <p
          v-if="resultado"
          class="ok"
          role="status"
        >
          {{ resultado }}
        </p>
        <p
          v-for="e in [transicion.error.value, segunda.error.value, foto.error.value, punto.error.value].filter(Boolean)"
          :key="e ?? ''"
          class="error"
          role="alert"
        >
          {{ e }}
        </p>

        <HudPanel
          etiqueta="Quórum"
          :resaltado="vivo.hay_quorum"
        >
          <MedidorQuorum
            :porcentaje-coeficiente="vivo.quorum.porcentaje_coeficiente"
            :unidades-presentes="vivo.quorum.unidades_presentes"
            :unidades-total="vivo.quorum.unidades_total"
            :asistentes="vivo.quorum.asistentes"
            :hay-quorum="vivo.hay_quorum"
            :umbral="umbralQuorum(r.convocatoria)"
          />
          <div
            v-if="acciones.length || conduce"
            class="botones acciones"
          >
            <HudBoton
              v-for="a in acciones"
              :key="a"
              :variante="a === 'cancelar' || a === 'cerrar' ? 'fantasma' : a === 'suspender' ? 'secundario' : 'primario'"
              :deshabilitado="a === 'instalar' && !vivo.hay_quorum"
              :cargando="transicion.cargando.value"
              @click="hacer(a)"
            >
              {{ ACCION_REUNION[a] }}
            </HudBoton>
            <HudBoton
              v-if="conduce && ['en_registro', 'instalada'].includes(r.estado)"
              variante="fantasma"
              :cargando="foto.cargando.value"
              @click="tomarFoto"
            >
              Registrar el quórum para el acta
            </HudBoton>
          </div>
          <p
            v-if="sinQuorumEnRegistro && conduce"
            class="texto-2"
          >
            Sin quórum no se puede instalar. Pasada la hora, puede convocar la reunión de segunda convocatoria (art. 41).
          </p>
          <HudBoton
            v-if="sinQuorumEnRegistro && entidad.tienePermiso('asambleas.convocar')"
            variante="secundario"
            :cargando="segunda.cargando.value"
            @click="convocarSegunda"
          >
            Convocar la segunda reunión
          </HudBoton>
        </HudPanel>

        <HudPanel etiqueta="Orden del día">
          <p
            v-if="vivo.punto_en_curso"
            class="texto-2"
          >
            En curso: <strong>{{ vivo.punto_en_curso }}</strong>
          </p>
          <ol
            class="lista"
            aria-label="Orden del día"
          >
            <li
              v-for="(p, i) in detalle.puntos"
              :key="p.id"
            >
              <span class="crece"><strong>{{ i + 1 }}. {{ p.titulo }}</strong></span>
              <HudInsignia :tono="ESTADO_PUNTO[p.estado].tono">
                {{ ESTADO_PUNTO[p.estado].texto }}
              </HudInsignia>
              <div
                v-if="conduce && r.estado === 'instalada'"
                class="botones"
              >
                <HudBoton
                  v-if="p.estado === 'pendiente' || p.estado === 'aplazado'"
                  variante="secundario"
                  :cargando="punto.cargando.value"
                  @click="avanzarPunto(p, 'en_curso')"
                >
                  Iniciar<span class="solo-lector"> «{{ p.titulo }}»</span>
                </HudBoton>
                <template v-if="p.estado === 'en_curso'">
                  <HudBoton
                    :cargando="punto.cargando.value"
                    @click="avanzarPunto(p, 'terminado')"
                  >
                    Terminar<span class="solo-lector"> «{{ p.titulo }}»</span>
                  </HudBoton>
                  <HudBoton
                    variante="fantasma"
                    :cargando="punto.cargando.value"
                    @click="avanzarPunto(p, 'aplazado')"
                  >
                    Aplazar<span class="solo-lector"> «{{ p.titulo }}»</span>
                  </HudBoton>
                </template>
              </div>
            </li>
          </ol>
        </HudPanel>

        <HudDialogo
          v-model:abierto="cerrando"
          titulo="Cerrar la asamblea"
        >
          <p>Al cerrarla ya no se registran asistentes ni votos. Después se genera el acta.</p>
          <template #acciones>
            <HudBoton
              variante="fantasma"
              @click="cerrando = false"
            >
              Volver
            </HudBoton>
            <HudBoton
              :cargando="transicion.cargando.value"
              @click="hacer('cerrar')"
            >
              Cerrar la asamblea
            </HudBoton>
          </template>
        </HudDialogo>
        <ConfirmarConMotivo
          v-model:abierto="cancelando"
          titulo="Cancelar la reunión"
          accion="Cancelar la reunión"
          :cargando="transicion.cargando.value"
          :error="transicion.error.value"
          @confirmar="(m) => hacer('cancelar', m)"
        />
      </template>
    </template>

    <template v-else>
      <h1 id="titulo-conducir">
        Conducir una asamblea
      </h1>
      <HudEstado
        v-if="enCurso.estado.value === 'cargando'"
        estado="cargando"
      />
      <HudEstado
        v-else-if="enCurso.estado.value === 'error'"
        estado="error"
        :mensaje="enCurso.error.value ?? undefined"
        @reintentar="enCurso.recargar()"
      />
      <HudEstado
        v-else-if="enCurso.filas.value.length === 0"
        estado="vacio"
        mensaje="No hay asambleas convocadas o en curso."
      />
      <ul
        v-else
        class="lista"
        aria-label="Asambleas por conducir"
      >
        <li
          v-for="x in enCurso.filas.value"
          :key="x.id"
        >
          <HudInsignia :tono="ESTADO_REUNION[x.estado].tono">
            {{ ESTADO_REUNION[x.estado].texto }}
          </HudInsignia>
          <span class="crece">
            <RouterLink
              :to="ruta('en-vivo', x.id)"
              class="fila"
            ><strong>{{ x.titulo }}</strong></RouterLink>
            <small>{{ fechaHora(x.fecha_programada, zona) }}</small>
          </span>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped src="./asambleas.css"></style>
<style scoped>
.acciones {
  margin-top: 14px;
}

.acciones :deep(.hud-boton) {
  min-height: 52px;
}
</style>
