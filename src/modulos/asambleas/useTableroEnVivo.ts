/**
 * Tablero de una reunión alimentado por el WebSocket `…/en-vivo` (plan 08). Cada mensaje
 * **reemplaza** el tablero; mientras el socket no está conectado (reconectando con espera
 * creciente, sin soporte o en modo demo) se consulta `GET …/tablero` cada pocos segundos, así
 * la sala nunca queda con datos viejos.
 */
import { computed, onScopeDispose, ref, watch } from 'vue'
import { conectarEnVivo, type EstadoEnVivo, type OpcionesEnVivo } from '@/api/en-vivo'
import { mensajeDeError } from '@/api/errores'
import type { TableroReunion } from '@/api/tipos'
import { config } from '@/app/config'
import { useRefresco } from '@/composables/useRefresco'
import { tablero as pedirTablero, urlEnVivo } from './api'

/** `consulta`: sin socket, se actualiza por consultas periódicas. */
export type Conexion = EstadoEnVivo | 'consulta'

export const TEXTO_CONEXION: Record<Conexion, string> = {
  conectando: 'Conectando…',
  conectado: 'En vivo',
  reconectando: 'Reconectando…',
  cerrado: 'Sin conexión en vivo',
  consulta: 'Se actualiza cada pocos segundos',
}

/**
 * Aplica un mensaje del socket: se acepta solo si es un tablero de **esta** reunión y no es más
 * viejo que el actual (los mensajes pueden llegar tras una consulta más reciente).
 */
export function aplicarTablero(actual: TableroReunion | null, mensaje: unknown, reunionId: string): TableroReunion | null {
  if (typeof mensaje !== 'object' || mensaje === null) return actual
  const t = mensaje as Partial<TableroReunion>
  if (!t.reunion || t.reunion.id !== reunionId || !t.quorum || typeof t.generado_en !== 'string' || !Array.isArray(t.preguntas_abiertas)) return actual
  if (actual && Date.parse(t.generado_en) < Date.parse(actual.generado_en)) return actual
  return t as TableroReunion
}

export interface OpcionesTablero {
  /** Cada cuánto se consulta sin socket (ms). */
  cada?: number
  /** Para pruebas: el constructor del socket. */
  crear?: OpcionesEnVivo['crear']
}

export function useTableroEnVivo(entidadId: () => string, reunionId: () => string, opciones: OpcionesTablero = {}) {
  const tablero = ref<TableroReunion | null>(null)
  const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
  const error = ref<string | null>(null)
  const conexion = ref<Conexion>('consulta')
  const usaSocket = !config().modoDemo && (opciones.crear !== undefined || typeof WebSocket !== 'undefined')
  let socket: { cerrar: () => void } | null = null

  const enVivo = computed(() => conexion.value === 'conectado')

  async function recargar() {
    const id = entidadId()
    const reunion = reunionId()
    if (!id || !reunion) return
    try {
      tablero.value = aplicarTablero(tablero.value, await pedirTablero(id, reunion), reunion)
      error.value = null
      estado.value = 'listo'
    } catch (e) {
      error.value = mensajeDeError(e)
      if (estado.value !== 'listo') estado.value = 'error'
    }
  }

  function conectar() {
    socket?.cerrar()
    socket = null
    const reunion = reunionId()
    if (!usaSocket || !entidadId() || !reunion) {
      conexion.value = 'consulta'
      return
    }
    socket = conectarEnVivo(urlEnVivo(entidadId(), reunion), {
      crear: opciones.crear,
      alMensaje: (m) => {
        tablero.value = aplicarTablero(tablero.value, m, reunion)
        if (tablero.value) estado.value = 'listo'
      },
      alEstado: (e) => (conexion.value = e),
    })
  }

  useRefresco(
    async () => {
      if (!enVivo.value && estado.value === 'listo') await recargar()
    },
    { cada: opciones.cada ?? (usaSocket ? 5_000 : 3_000) },
  )

  watch(
    () => [entidadId(), reunionId()],
    () => {
      tablero.value = null
      estado.value = 'cargando'
      void recargar()
      conectar()
    },
    { immediate: true },
  )

  onScopeDispose(() => socket?.cerrar())

  return { tablero, estado, error, conexion, enVivo, recargar }
}
