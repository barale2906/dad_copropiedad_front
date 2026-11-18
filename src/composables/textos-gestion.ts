/** Textos de las PQRS que comparten el portal del residente y la administración. */
import type { PrioridadTicket, TipoTicket } from '@/api/tipos'

export const TIPO_TICKET: Record<TipoTicket, string> = {
  peticion: 'Petición',
  queja: 'Queja',
  reclamo: 'Reclamo',
  sugerencia: 'Sugerencia',
  felicitacion: 'Felicitación',
  solicitud_mantenimiento: 'Solicitud de mantenimiento',
  solicitud_administrativa: 'Solicitud administrativa',
  solicitud_documentos: 'Solicitud de documentos',
  reporte_convivencia: 'Reporte de convivencia',
}

export const PRIORIDAD_TICKET: Record<PrioridadTicket, { texto: string; tono: 'peligro' | 'aviso' | 'info' | 'neutro' }> = {
  urgente: { texto: 'Urgente', tono: 'peligro' },
  alta: { texto: 'Alta', tono: 'aviso' },
  media: { texto: 'Media', tono: 'info' },
  baja: { texto: 'Baja', tono: 'neutro' },
}
