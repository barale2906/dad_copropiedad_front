/** Textos y reglas del portal del propietario y residente (funciones puras). */
import type {
  EstadoCuenta,
  EstadoTicket,
  EstadoVisita,
  Ticket,
  TipoTicket,
  Visita,
} from '@/api/tipos'
import { comparar } from '@/formato/decimales'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'

/** Tipos que ofrece el formulario del residente (en el orden más usado). */
export const TIPOS_PARA_RESIDENTE: TipoTicket[] = [
  'solicitud_mantenimiento',
  'peticion',
  'queja',
  'reclamo',
  'reporte_convivencia',
  'solicitud_documentos',
  'sugerencia',
  'felicitacion',
]

export const ESTADO_TICKET: Record<EstadoTicket, { texto: string; tono: Tono }> = {
  abierto: { texto: 'Radicada', tono: 'info' },
  en_revision: { texto: 'En revisión', tono: 'info' },
  asignado: { texto: 'Asignada', tono: 'info' },
  en_progreso: { texto: 'En atención', tono: 'aviso' },
  en_espera_tercero: { texto: 'Esperando a un tercero', tono: 'aviso' },
  en_espera_solicitante: { texto: 'Espera su respuesta', tono: 'peligro' },
  resuelto: { texto: 'Resuelta', tono: 'exito' },
  cerrado: { texto: 'Cerrada', tono: 'neutro' },
  reabierto: { texto: 'Reabierta', tono: 'aviso' },
  rechazado: { texto: 'Rechazada', tono: 'neutro' },
  duplicado: { texto: 'Duplicada', tono: 'neutro' },
}

/** Lo que el solicitante puede hacer con su solicitud ahora. */
export function accionesDelSolicitante(t: Pick<Ticket, 'estado' | 'encuesta' | 'reabrible_hasta'>, ahora = new Date()) {
  const terminada = t.estado === 'resuelto' || t.estado === 'cerrado'
  return {
    responder: !terminada && t.estado !== 'rechazado' && t.estado !== 'duplicado',
    calificar: terminada && !t.encuesta,
    cerrar: t.estado === 'resuelto',
    reabrir: t.estado === 'resuelto' && !!t.reabrible_hasta && Date.parse(t.reabrible_hasta) > ahora.getTime(),
  }
}

export const ESTADO_VISITA: Record<EstadoVisita, { texto: string; tono: Tono }> = {
  anunciada: { texto: 'Espera su respuesta', tono: 'peligro' },
  requiere_llamada: { texto: 'La portería lo llamará', tono: 'aviso' },
  autorizada: { texto: 'Autorizada', tono: 'exito' },
  rechazada: { texto: 'Rechazada', tono: 'neutro' },
  sin_respuesta: { texto: 'Sin respuesta', tono: 'neutro' },
  ingresada: { texto: 'Ingresó', tono: 'info' },
  finalizada: { texto: 'Salió', tono: 'neutro' },
  vencida: { texto: 'Vencida', tono: 'neutro' },
  cancelada: { texto: 'Cancelada', tono: 'neutro' },
}

/** ¿La visita anunciada espera que un residente la autorice o rechace? */
export const esperaRespuesta = (v: Pick<Visita, 'estado' | 'origen'>) =>
  v.origen === 'anuncio_porteria' && (v.estado === 'anunciada' || v.estado === 'requiere_llamada')

/** ¿La pre-autorización sigue vigente (se puede volver a compartir su QR)? */
export function qrVigente(v: Pick<Visita, 'origen' | 'estado' | 'ventana_hasta' | 'usos' | 'usos_permitidos'>, ahora = new Date()): boolean {
  return (
    v.origen === 'preautorizada' &&
    v.estado === 'autorizada' &&
    v.usos < v.usos_permitidos &&
    (!v.ventana_hasta || Date.parse(v.ventana_hasta) > ahora.getTime())
  )
}

/** Situación del bien en la cartera para la tarjeta y el encabezado. */
export function situacionCartera(e: Pick<EstadoCuenta, 'saldo' | 'vencido'>): { texto: string; tono: Tono } {
  if (comparar(e.vencido, '0') > 0) return { texto: 'En mora', tono: 'peligro' }
  if (comparar(e.saldo, '0') > 0) return { texto: 'Con saldo por pagar', tono: 'aviso' }
  return { texto: 'Al día', tono: 'exito' }
}
