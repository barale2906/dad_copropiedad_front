/**
 * Reglas de la auditoría (funciones puras). La auditoría nunca trae datos personales: quien
 * actuó se muestra como «Usted», «Sistema» u «Otra cuenta», sin pedir su nombre.
 */
import type { EventoAuditado } from '@/api/tipos'
import { aUtc } from '@/formato/fechas'
import type { FiltrosAuditoria } from './api'
import { sumarDias } from './suscripcion'

type Tono = 'exito' | 'aviso' | 'peligro' | 'neutro'

const RESULTADO: Record<string, { texto: string; tono: Tono }> = {
  ok: { texto: 'Correcto', tono: 'exito' },
  rechazado: { texto: 'Rechazado', tono: 'aviso' },
  error: { texto: 'Error', tono: 'peligro' },
}

export const resultadoVisible = (r: string) => RESULTADO[r] ?? { texto: r, tono: 'neutro' as const }

export function textoActor(actorId: string | null | undefined, miCuentaId: string | null): string {
  if (!actorId) return 'Sistema'
  return actorId === miCuentaId ? 'Usted' : 'Otra cuenta'
}

/** Detalle del evento para mostrar, o `null` si viene vacío. */
export function detalleLegible(detalle: EventoAuditado['detalle']): string | null {
  return Object.keys(detalle).length ? JSON.stringify(detalle, null, 2) : null
}

/** Lo que se elige en la pantalla (fechas de calendario en la zona de la entidad). */
export interface FiltrosPantalla {
  accion: string
  desde: string
  hasta: string
  soloMias: boolean
}

/**
 * Filtros de la pantalla → consulta: los días se toman completos en la zona de la entidad
 * (`hasta` incluye todo ese día).
 */
export function aConsulta(f: FiltrosPantalla, zona: string, miCuentaId: string | null): FiltrosAuditoria {
  return {
    accion: f.accion.trim() || undefined,
    actorId: f.soloMias && miCuentaId ? miCuentaId : undefined,
    desde: f.desde ? aUtc(`${f.desde}T00:00`, zona) : undefined,
    hasta: f.hasta ? aUtc(`${sumarDias(f.hasta, 1)}T00:00`, zona) : undefined,
  }
}
