import { onScopeDispose } from 'vue'
import { useRefresco } from '@/composables/useRefresco'
import { registrarEventos } from './api'
import { acumular, type Pendientes, tomarLote } from './reglas'

/**
 * Impresiones y clics de las piezas publicitarias, enviados **en lote** cada 20 s (con la pestaña
 * visible) y al salir de la vista. Nunca bloquea la interfaz: si un envío falla, se descarta (son
 * métricas, no datos de la persona). Una impresión cuenta una vez por pieza mientras la vista vive.
 */
export function useEventosPiezas(entidadId: () => string) {
  const pendientes: Pendientes = new Map()
  const vistas = new Set<string>()

  function enviar(): Promise<void> {
    const lote = tomarLote(pendientes)
    if (lote.length === 0) return Promise.resolve()
    return registrarEventos(entidadId(), lote).catch(() => undefined)
  }

  function impresion(creativoId: string) {
    if (vistas.has(creativoId)) return
    vistas.add(creativoId)
    acumular(pendientes, creativoId, 'impresion')
  }

  function clic(creativoId: string) {
    acumular(pendientes, creativoId, 'clic')
  }

  useRefresco(enviar, { cada: 20_000, alVolver: false })
  onScopeDispose(() => void enviar())

  return { impresion, clic, enviar }
}
