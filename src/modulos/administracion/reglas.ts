/** Reglas y textos de la gestión administrativa (funciones puras). */
import type {
  Audiencia,
  ClaseActivo,
  Comunicado,
  EstadoActivo,
  EstadoComunicado,
  EstadoOrden,
  EstadoTicket,
  FinalidadTratamiento,
  Frecuencia,
  MomentoEvidencia,
  OrdenTrabajo,
  PlanMantenimiento,
  TipoArchivoActivo,
  TipoAudiencia,
  TipoMovimiento,
  TipoOrden,
  UnidadPlazo,
} from '@/api/tipos'
import { accionesPermitidas, puedeAprobar } from '@/composables/reglas'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'

// Tickets ------------------------------------------------------------------------------------

export const ESTADO_TICKET: Record<EstadoTicket, { texto: string; tono: Tono }> = {
  abierto: { texto: 'Abierto', tono: 'info' },
  en_revision: { texto: 'En revisión', tono: 'info' },
  asignado: { texto: 'Asignado', tono: 'info' },
  en_progreso: { texto: 'En progreso', tono: 'info' },
  en_espera_tercero: { texto: 'Esperando a un tercero', tono: 'aviso' },
  en_espera_solicitante: { texto: 'Esperando al solicitante', tono: 'aviso' },
  resuelto: { texto: 'Resuelto', tono: 'exito' },
  cerrado: { texto: 'Cerrado', tono: 'neutro' },
  reabierto: { texto: 'Reabierto', tono: 'aviso' },
  rechazado: { texto: 'Rechazado', tono: 'neutro' },
  duplicado: { texto: 'Duplicado', tono: 'neutro' },
}

/** Texto del botón que lleva a cada estado (el detalle trae cuáles le corresponden a la cuenta). */
export const ACCION_TICKET: Record<EstadoTicket, string> = {
  abierto: 'Abrir',
  en_revision: 'Revisar',
  asignado: 'Marcar asignado',
  en_progreso: 'Empezar a atender',
  en_espera_tercero: 'Esperar a un tercero',
  en_espera_solicitante: 'Pedir información',
  resuelto: 'Resolver',
  cerrado: 'Cerrar',
  reabierto: 'Reabrir',
  rechazado: 'Rechazar',
  duplicado: 'Marcar duplicado',
}

/** Estados que exigen motivo: es la respuesta pública o lo que se pide al solicitante. */
export const pideMotivo = (hacia: EstadoTicket) => hacia === 'resuelto' || hacia === 'rechazado' || hacia === 'en_espera_solicitante'

/** Etiqueta del campo de motivo según el estado al que se pasa. */
export function etiquetaMotivo(hacia: EstadoTicket): string {
  if (hacia === 'resuelto') return 'Respuesta al solicitante'
  if (hacia === 'en_espera_solicitante') return 'Qué necesita del solicitante'
  if (hacia === 'rechazado') return 'Motivo del rechazo'
  return 'Motivo (opcional)'
}

/** Estados que siguen pendientes (cuentan en la bandeja). */
export const ticketPendiente = (e: EstadoTicket) => !['resuelto', 'cerrado', 'rechazado', 'duplicado'].includes(e)

export const UNIDAD_PLAZO: Record<UnidadPlazo, string> = { horas: 'horas', horas_habiles: 'horas hábiles', dias_habiles: 'días hábiles' }

// Comunicados --------------------------------------------------------------------------------

export const ESTADO_COMUNICADO: Record<EstadoComunicado, { texto: string; tono: Tono }> = {
  borrador: { texto: 'Borrador', tono: 'neutro' },
  programado: { texto: 'Programado', tono: 'info' },
  enviado: { texto: 'Enviado', tono: 'exito' },
  anulado: { texto: 'Anulado', tono: 'neutro' },
}

export type AccionComunicado = 'editar' | 'publicar' | 'retirar' | 'anular'

const BOTONES_COMUNICADO = {
  borrador: ['editar', 'publicar', 'anular'],
  programado: ['retirar', 'anular'],
} as const satisfies Partial<Record<EstadoComunicado, readonly AccionComunicado[]>>

/** Lo enviado no se anula ni se edita; un programado se retira (vuelve a borrador). */
export const accionesComunicado = (e: EstadoComunicado) => accionesPermitidas<EstadoComunicado, AccionComunicado>(e, BOTONES_COMUNICADO)

export const FINALIDAD: Record<Extract<FinalidadTratamiento, 'administracion' | 'comunicaciones'>, { texto: string; ayuda: string }> = {
  administracion: {
    texto: 'Administración de la copropiedad',
    ayuda: 'Llega a toda la audiencia: avisos de la convivencia, cortes de servicios, asambleas.',
  },
  comunicaciones: {
    texto: 'Comunicaciones generales',
    ayuda: 'Solo a quienes autorizaron recibir comunicaciones (Ley 1581): boletines, eventos, campañas.',
  },
}

export const TIPO_AUDIENCIA: Record<TipoAudiencia, string> = {
  todos: 'Toda la copropiedad',
  propietarios: 'Propietarios',
  residentes: 'Residentes',
  agrupaciones: 'Torres o etapas',
  bienes: 'Bienes privados',
  roles: 'Roles',
}

/** ¿La audiencia está completa? Las de lista exigen al menos un elegido. */
export const audienciaCompleta = (a: Audiencia) => !['agrupaciones', 'bienes', 'roles'].includes(a.tipo) || (a.ids?.length ?? 0) > 0

/** Resumen de la entrega: «120 de 150 lo leyeron (80 %)». */
export function resumenLectura(r: { destinatarios: number; leidos: number }): string {
  if (!r.destinatarios) return 'Aún sin destinatarios'
  const pct = Math.round((r.leidos / r.destinatarios) * 100)
  return `${r.leidos} de ${r.destinatarios} lo leyeron (${pct} %)`
}

/** ¿El comunicado se puede editar todavía? */
export const editable = (c: Pick<Comunicado, 'estado'>) => c.estado === 'borrador'

// Mantenimiento ------------------------------------------------------------------------------

export const ESTADO_ORDEN: Record<EstadoOrden, { texto: string; tono: Tono }> = {
  programada: { texto: 'Programada', tono: 'info' },
  en_ejecucion: { texto: 'En ejecución', tono: 'aviso' },
  ejecutada: { texto: 'Ejecutada: falta verificar', tono: 'aviso' },
  verificada: { texto: 'Verificada', tono: 'exito' },
  cancelada: { texto: 'Cancelada', tono: 'neutro' },
}

export const TIPO_ORDEN: Record<TipoOrden, string> = { preventivo: 'Preventivo', correctivo: 'Correctivo', urgente: 'Urgente' }

export const MOMENTO_EVIDENCIA: Record<MomentoEvidencia, string> = { antes: 'Antes', despues: 'Después', soporte: 'Soporte' }

export type AccionOrden = 'iniciar' | 'ejecutar' | 'verificar' | 'cancelar' | 'evidencias'

export interface QuienOpera {
  cuentaId: string | null
  planificar: boolean
  ejecutar: boolean
  verificar: boolean
}

/**
 * Botones de una orden para la cuenta: iniciar y ejecutar quien planifica o la tiene asignada;
 * verificar con el permiso y **otra cuenta** que la que la ejecutó (cuatro ojos); cancelar
 * quien planifica, mientras no haya terminado.
 */
export function accionesOrden(o: Pick<OrdenTrabajo, 'estado' | 'asignado' | 'ejecutada_por'>, q: QuienOpera): AccionOrden[] {
  const propia = !!q.cuentaId && o.asignado?.cuenta_id === q.cuentaId
  const ejecuta = q.planificar || (propia && q.ejecutar)
  const r: AccionOrden[] = []
  if (o.estado === 'programada' && ejecuta) r.push('iniciar')
  if (o.estado === 'en_ejecucion' && ejecuta) r.push('ejecutar', 'evidencias')
  if (o.estado === 'ejecutada' && q.verificar && puedeAprobar([o.ejecutada_por], q.cuentaId)) r.push('verificar')
  if ((o.estado === 'programada' || o.estado === 'en_ejecucion') && q.planificar) r.push('cancelar')
  return r
}

/** ¿La orden está atrasada? (programada para antes de hoy y sin terminar). */
export const ordenAtrasada = (o: Pick<OrdenTrabajo, 'estado' | 'programada_para'>, hoy: string) =>
  (o.estado === 'programada' || o.estado === 'en_ejecucion') && o.programada_para < hoy

const FRECUENCIA: Record<Frecuencia, [string, string]> = { dias: ['día', 'días'], semanas: ['semana', 'semanas'], meses: ['mes', 'meses'] }

/** «Cada 3 meses» / «Cada semana». */
export function textoRecurrencia(r: PlanMantenimiento['recurrencia']): string {
  const [uno, varios] = FRECUENCIA[r.frecuencia]
  return r.intervalo === 1 ? `Cada ${uno}` : `Cada ${r.intervalo} ${varios}`
}

export const OPCIONES_FRECUENCIA: { valor: Frecuencia; etiqueta: string }[] = [
  { valor: 'dias', etiqueta: 'Días' },
  { valor: 'semanas', etiqueta: 'Semanas' },
  { valor: 'meses', etiqueta: 'Meses' },
]

/** «Cada 12 meses». */
export const textoPeriodicidad = (meses: number) => (meses === 1 ? 'Cada mes' : `Cada ${meses} meses`)

// Inventario ---------------------------------------------------------------------------------

export const CLASE_ACTIVO: Record<ClaseActivo, string> = { equipo: 'Equipo', herramienta: 'Herramienta', mobiliario: 'Mobiliario', dotacion: 'Dotación' }

export const ESTADO_ACTIVO: Record<EstadoActivo, { texto: string; tono: Tono }> = {
  operativo: { texto: 'Operativo', tono: 'exito' },
  con_falla: { texto: 'Con falla', tono: 'aviso' },
  en_reparacion: { texto: 'En reparación', tono: 'aviso' },
  fuera_de_servicio: { texto: 'Fuera de servicio', tono: 'peligro' },
  dado_de_baja: { texto: 'Dado de baja', tono: 'neutro' },
}

/** Estados a los que se cambia a mano (la baja va por un movimiento con soporte). */
export const ESTADOS_EDITABLES: EstadoActivo[] = ['operativo', 'con_falla', 'en_reparacion', 'fuera_de_servicio']

export const TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  traslado: 'Traslado',
  prestamo: 'Préstamo',
  devolucion: 'Devolución',
  baja: 'Baja definitiva',
}

/** Movimientos que exigen a dónde va el activo. */
export const pideDestino = (t: TipoMovimiento) => t === 'traslado' || t === 'prestamo'

export const TIPO_ARCHIVO_ACTIVO: Record<TipoArchivoActivo, string> = { manual: 'Manual', foto: 'Foto', factura: 'Factura', garantia: 'Garantía', otro: 'Otro' }
