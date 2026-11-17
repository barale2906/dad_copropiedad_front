/** Textos y reglas de la suscripción de la entidad con la plataforma (funciones puras). */
import type { Corte, EstadoCorte, EstadoSuscripcion, Suscripcion } from '@/api/tipos'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'

export const ESTADO_SUSCRIPCION: Record<EstadoSuscripcion, { texto: string; tono: Tono }> = {
  activa: { texto: 'Activa', tono: 'exito' },
  suspendida: { texto: 'Suspendida', tono: 'peligro' },
  terminada: { texto: 'Terminada', tono: 'neutro' },
}

/** La entidad solo ve cortes aprobados (por facturar), facturados y pagados. */
export const ESTADO_CORTE: Record<EstadoCorte, { texto: string; tono: Tono }> = {
  borrador: { texto: 'En revisión', tono: 'neutro' },
  aprobado: { texto: 'Por facturar', tono: 'info' },
  facturado: { texto: 'Por pagar', tono: 'aviso' },
  pagado: { texto: 'Pagada', tono: 'exito' },
  descartado: { texto: 'Descartada', tono: 'neutro' },
}

/** «Mensual», «Cada 3 meses» o «Por evento» (`ciclo_meses` nulo). */
export function textoCiclo(meses: number | null | undefined): string {
  if (!meses) return 'Por evento'
  if (meses === 1) return 'Mensual'
  if (meses === 12) return 'Anual'
  return `Cada ${meses} meses`
}

/** Suma días a una fecha `YYYY-MM-DD` (calendario, sin zonas). */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Último día incluido de un periodo cuyo `hasta` es excluyente. */
export const ultimoDia = (hastaExcluido: string) => sumarDias(hastaExcluido, -1)

/** Fecha en que termina la prueba gratuita, o `null` si no tiene. */
export function finDePrueba(s: Pick<Suscripcion, 'inicio' | 'dias_prueba'>): string | null {
  return s.dias_prueba > 0 ? sumarDias(s.inicio, s.dias_prueba) : null
}

/** ¿El corte facturado ya venció sin pagarse? (`hoy` en `YYYY-MM-DD`, zona de la entidad). */
export function corteVencido(c: Pick<Corte, 'estado' | 'vencimiento'>, hoy: string): boolean {
  return c.estado === 'facturado' && !!c.vencimiento && c.vencimiento < hoy
}
