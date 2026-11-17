/** Reglas y textos de la protección de datos personales (Ley 1581 de 2012). Funciones puras. */
import type {
  AutorizacionTratamiento,
  EstadoSolicitudTitular,
  FinalidadTratamiento,
  MedioAutorizacion,
  SolicitudTitular,
  TipoSolicitudTitular,
} from '@/api/tipos'
import { accionesPermitidas } from '@/composables/reglas'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'

export const TIPO_SOLICITUD: Record<TipoSolicitudTitular, string> = {
  consulta: 'Consulta',
  actualizacion: 'Actualización',
  rectificacion: 'Rectificación',
  supresion: 'Supresión',
  revocatoria: 'Revocatoria',
}

export const ESTADO_SOLICITUD: Record<EstadoSolicitudTitular, { texto: string; tono: Tono }> = {
  radicada: { texto: 'Radicada', tono: 'info' },
  en_tramite: { texto: 'En trámite', tono: 'aviso' },
  respondida: { texto: 'Respondida', tono: 'exito' },
}

export const FINALIDAD: Record<FinalidadTratamiento, { texto: string; ayuda: string }> = {
  administracion: { texto: 'Administración', ayuda: 'Gestión de la copropiedad: cobros, censo, asambleas.' },
  comunicaciones: { texto: 'Comunicaciones', ayuda: 'Avisos y comunicados por correo o WhatsApp.' },
  control_acceso: { texto: 'Control de acceso', ayuda: 'Ingresos, visitas y correspondencia en portería.' },
  publicidad: { texto: 'Publicidad', ayuda: 'Ofertas de comercios del directorio.' },
}

export const MEDIO: Record<MedioAutorizacion, string> = {
  web: 'Web',
  app: 'Aplicación',
  whatsapp: 'WhatsApp',
  escrito: 'Documento escrito',
}

/** Botones de una solicitud según su estado (guía §6). */
const BOTONES = {
  radicada: ['tramitar', 'prorrogar', 'responder'],
  en_tramite: ['prorrogar', 'responder'],
} as const satisfies Partial<Record<EstadoSolicitudTitular, readonly string[]>>

export type AccionSolicitud = (typeof BOTONES)[keyof typeof BOTONES][number]

/** Acciones de la solicitud: la prórroga es única (no se ofrece si ya se prorrogó). */
export function accionesDeSolicitud(s: Pick<SolicitudTitular, 'estado' | 'prorrogada_hasta'>): readonly AccionSolicitud[] {
  return accionesPermitidas<EstadoSolicitudTitular, AccionSolicitud>(s.estado, BOTONES).filter(
    (a) => a !== 'prorrogar' || !s.prorrogada_hasta,
  )
}

/**
 * Plazo para mostrar: lo calcula el backend en días hábiles de Colombia
 * (`dias_habiles_restantes`: 0 = vence hoy o venció; `null` si ya se respondió).
 */
export function plazoVisible(s: Pick<SolicitudTitular, 'estado' | 'dias_habiles_restantes'>): { texto: string; tono: Tono } {
  if (s.estado === 'respondida') return { texto: 'Respondida', tono: 'neutro' }
  const n = s.dias_habiles_restantes
  if (n === null || n === undefined) return { texto: 'Sin plazo', tono: 'neutro' }
  if (n <= 0) return { texto: 'Vence hoy o venció', tono: 'peligro' }
  if (n === 1) return { texto: 'Queda 1 día hábil', tono: 'aviso' }
  return { texto: `Quedan ${n} días hábiles`, tono: n <= 3 ? 'aviso' : 'info' }
}

/** Fecha límite vigente: la prórroga, si la hay. */
export const venceEl = (s: Pick<SolicitudTitular, 'vence_el' | 'prorrogada_hasta'>) => s.prorrogada_hasta ?? s.vence_el

/** Finalidades autorizadas hoy (las revocadas no cuentan). */
export function finalidadesVigentes(autorizaciones: AutorizacionTratamiento[]): FinalidadTratamiento[] {
  return [...new Set(autorizaciones.filter((a) => !a.revocada_en).map((a) => a.finalidad))]
}
