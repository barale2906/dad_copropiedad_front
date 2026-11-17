/** Reglas y textos de las reservas (funciones puras). */
import type { DestinoCobro, EstadoPago, EstadoReserva, PoliticaReserva, Reserva } from '@/api/tipos'
import { accionesPermitidas } from '@/composables/reglas'
import { comparar, porcentajeDe } from '@/formato/decimales'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'

export const ESTADO_RESERVA: Record<EstadoReserva, { texto: string; tono: Tono }> = {
  solicitada: { texto: 'Pendiente de aprobación', tono: 'aviso' },
  aprobada: { texto: 'Confirmada', tono: 'exito' },
  rechazada: { texto: 'Rechazada', tono: 'peligro' },
  en_curso: { texto: 'En curso', tono: 'info' },
  finalizada: { texto: 'Finalizada', tono: 'neutro' },
  con_novedad: { texto: 'Con novedad', tono: 'peligro' },
  cancelada: { texto: 'Cancelada', tono: 'neutro' },
  no_asistio: { texto: 'No asistió', tono: 'neutro' },
}

export const ESTADO_PAGO: Record<EstadoPago, { texto: string; tono: Tono } | null> = {
  no_aplica: null,
  pendiente: { texto: 'Pago pendiente', tono: 'aviso' },
  pagado: { texto: 'Pagada', tono: 'exito' },
  exonerado: { texto: 'Exonerada', tono: 'info' },
}

export type AccionReserva = 'aprobar' | 'rechazar' | 'cancelar' | 'entregar' | 'no_asistio' | 'recibir'

/** Ciclo: solicitada → aprobada → en_curso → finalizada | con_novedad (guía §6). */
const BOTONES = {
  solicitada: ['aprobar', 'rechazar', 'cancelar'],
  aprobada: ['entregar', 'no_asistio', 'cancelar'],
  en_curso: ['recibir'],
} as const satisfies Partial<Record<EstadoReserva, readonly AccionReserva[]>>

export function accionesDeReserva(estado: EstadoReserva): readonly AccionReserva[] {
  return accionesPermitidas<EstadoReserva, AccionReserva>(estado, BOTONES)
}

/** ¿Se puede registrar el pago a mano? Solo con cobro `manual` y pago pendiente. */
export function admitePagoManual(r: Pick<Reserva, 'estado_pago' | 'estado'>, destino: DestinoCobro | undefined): boolean {
  return destino === 'manual' && r.estado_pago === 'pendiente' && !['rechazada', 'cancelada'].includes(r.estado)
}

/** ¿Se puede crear su factura? Cobro `factura`, valor positivo y reserva aprobada o posterior. */
export function admiteFactura(r: Pick<Reserva, 'estado' | 'valor' | 'estado_pago'>, destino: DestinoCobro | undefined): boolean {
  return (
    destino === 'factura' &&
    r.estado_pago === 'pendiente' &&
    comparar(r.valor, '0') > 0 &&
    ['aprobada', 'en_curso', 'finalizada', 'con_novedad'].includes(r.estado)
  )
}

/**
 * Penalidad que se cobraría al cancelar ahora (texto decimal), o `null` si aún está dentro del
 * plazo sin penalidad o la política no tiene penalidad. El backend la aplica; esto solo avisa.
 */
export function penalidadAlCancelar(
  r: Pick<Reserva, 'inicio' | 'valor'>,
  p: Pick<PoliticaReserva, 'cancelacion_sin_penalidad_horas' | 'penalidad_porcentaje'>,
  ahora: Date = new Date(),
): string | null {
  const horasQueFaltan = (Date.parse(r.inicio) - ahora.getTime()) / 3_600_000
  if (horasQueFaltan >= p.cancelacion_sin_penalidad_horas) return null
  if (comparar(p.penalidad_porcentaje, '0') <= 0 || comparar(r.valor, '0') <= 0) return null
  return porcentajeDe(r.valor, p.penalidad_porcentaje)
}

/** Las reservas se muestran de la más próxima a la más lejana; las cerradas, al final. */
export function ordenarReservas(lista: Reserva[]): Reserva[] {
  const abierta = (r: Reserva) => ['solicitada', 'aprobada', 'en_curso'].includes(r.estado)
  return [...lista].sort((a, b) => Number(abierta(b)) - Number(abierta(a)) || a.inicio.localeCompare(b.inicio))
}
