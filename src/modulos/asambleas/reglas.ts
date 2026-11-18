/** Reglas y textos de las asambleas (funciones puras). El backend decide; aquí solo se anticipa y se muestra. */
import type {
  AccionReunion,
  Asistente,
  BaseComputo,
  CoincidenciaMesa,
  ConvocatoriaReunion,
  EfectoMora,
  EstadoPoder,
  EstadoPunto,
  EstadoReunion,
  Modalidad,
  MotivoSalida,
  TipoDocumentoReunion,
  TipoReunion,
} from '@/api/tipos'
import { comparar, sumar } from '@/formato/decimales'
import { sumarDias } from '@/formato/fechas'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'

export const ESTADO_REUNION: Record<EstadoReunion, { texto: string; tono: Tono }> = {
  borrador: { texto: 'En preparación', tono: 'neutro' },
  convocada: { texto: 'Convocada', tono: 'info' },
  en_registro: { texto: 'Registro abierto', tono: 'aviso' },
  instalada: { texto: 'Instalada', tono: 'exito' },
  suspendida: { texto: 'Suspendida', tono: 'aviso' },
  cerrada: { texto: 'Cerrada', tono: 'neutro' },
  cancelada: { texto: 'Cancelada', tono: 'neutro' },
}

export const TIPO_REUNION: Record<TipoReunion, string> = { ordinaria: 'Ordinaria', extraordinaria: 'Extraordinaria' }

export const MODALIDAD: Record<Modalidad, string> = { presencial: 'Presencial', virtual: 'Virtual', mixta: 'Mixta', escrita: 'Consulta por escrito' }

export const CONVOCATORIA: Record<ConvocatoriaReunion, string> = {
  primera: 'Primera convocatoria',
  segunda: 'Segunda convocatoria',
  derecho_propio: 'Por derecho propio',
}

export const BASE_COMPUTO: Record<BaseComputo, string> = { coeficiente: 'Por coeficiente', unidades: 'Por unidades (un voto por bien)' }

export const EFECTO_MORA: Record<EfectoMora, string> = {
  informativo: 'Solo se informa (votan y cuentan para el quórum)',
  sin_voto: 'No votan (sí cuentan para el quórum)',
  sin_voto_ni_quorum: 'No votan ni cuentan para el quórum',
}

export const ESTADO_PUNTO: Record<EstadoPunto, { texto: string; tono: Tono }> = {
  pendiente: { texto: 'Pendiente', tono: 'neutro' },
  en_curso: { texto: 'En curso', tono: 'info' },
  terminado: { texto: 'Terminado', tono: 'exito' },
  aplazado: { texto: 'Aplazado', tono: 'aviso' },
}

export const TIPO_DOCUMENTO: Record<TipoDocumentoReunion, string> = {
  estados_financieros: 'Estados financieros',
  presupuesto: 'Presupuesto',
  informe: 'Informe',
  reglamento: 'Reglamento',
  otro: 'Otro',
}

export const ESTADO_PODER: Record<EstadoPoder, { texto: string; tono: Tono }> = {
  pendiente: { texto: 'Por revisar', tono: 'aviso' },
  verificado: { texto: 'Verificado', tono: 'exito' },
  rechazado: { texto: 'Rechazado', tono: 'peligro' },
  revocado: { texto: 'Revocado', tono: 'neutro' },
}

export const MOTIVO_SALIDA: Record<MotivoSalida, string> = {
  se_retiro: 'Se retiró',
  delego_poder: 'Delegó su poder',
  problema_tecnico: 'Problema técnico',
  otro: 'Otro motivo',
}

export const ACCION_REUNION: Record<AccionReunion, string> = {
  abrir_registro: 'Abrir el registro',
  instalar: 'Instalar la asamblea',
  suspender: 'Suspender',
  reanudar: 'Reanudar',
  cerrar: 'Cerrar la asamblea',
  cancelar: 'Cancelar la reunión',
}

export interface QuienConduce {
  convocar: boolean
  conducir: boolean
}

/**
 * Botones de la reunión según su estado (el diagrama del backend: borrador → convocada →
 * en_registro → instalada ⇄ suspendida → cerrada; cancelar antes de instalar).
 */
export function accionesReunion(estado: EstadoReunion, q: QuienConduce): AccionReunion[] {
  const r: AccionReunion[] = []
  if (estado === 'convocada' && q.conducir) r.push('abrir_registro')
  if (estado === 'en_registro' && q.conducir) r.push('instalar')
  if (estado === 'instalada' && q.conducir) r.push('suspender', 'cerrar')
  if (estado === 'suspendida' && q.conducir) r.push('reanudar', 'cerrar')
  if ((estado === 'borrador' || estado === 'convocada' || estado === 'en_registro') && q.convocar) r.push('cancelar')
  return r
}

/** ¿Se puede todavía editar la preparación? Tras convocar, el padrón y los datos de base quedan fijos. */
export const preparable = (e: EstadoReunion) => e === 'borrador'

/** Mesa de registro abierta: se registran asistentes desde que se abre el registro hasta el cierre. */
export const mesaAbierta = (e: EstadoReunion) => e === 'en_registro' || e === 'instalada' || e === 'suspendida'

/** Días mínimos de antelación al convocar (art. 39): 15 en ordinarias; las extraordinarias, el reglamento. */
export const ANTELACION_ORDINARIA_DIAS = 15

/** ¿Convocar hoy respeta la antelación legal? Fechas `YYYY-MM-DD` en la zona de la entidad. */
export function antelacionSuficiente(tipo: TipoReunion, hoy: string, fechaReunion: string): boolean {
  return tipo === 'ordinaria' ? fechaReunion >= sumarDias(hoy, ANTELACION_ORDINARIA_DIAS) : fechaReunion >= hoy
}

/**
 * Umbral de quórum para mostrar en el medidor (art. 45: más de la mitad en primera
 * convocatoria; en segunda o por derecho propio decide cualquier número). Lo decide el backend.
 */
export const umbralQuorum = (c: ConvocatoriaReunion): string | null => (c === 'primera' ? '50' : null)

/** Porcentaje de unidades presentes con un decimal, para el medidor. */
export function porcentajeUnidades(presentes: number, total: number): string {
  if (!total) return '0'
  return ((presentes / total) * 100).toFixed(1)
}

/** ¿El coeficiente presente supera el umbral? Solo para resaltar; la instalación la valida el backend. */
export const superaUmbral = (porcentaje: string, umbral: string | null) => umbral === null || comparar(porcentaje, umbral) > 0

/**
 * Bienes que se registran juntos al tocar una coincidencia: el bien buscado y los demás del
 * mismo representante que aún no están en ningún asistente.
 */
export function bienesDelRepresentante(c: CoincidenciaMesa, conocidas: CoincidenciaMesa[] = []): string[] {
  const ocupados = new Set(conocidas.filter((x) => x.asistente_actual).map((x) => x.bien_privado_id))
  return [...new Set([c.bien_privado_id, ...c.otros_bienes])].filter((b) => !ocupados.has(b))
}

/** Coeficiente total que representa un asistente (suma decimal exacta de sus bienes). */
export const coeficienteDe = (a: Pick<Asistente, 'bienes'>): string => sumar('0', ...a.bienes.map((b) => b.coeficiente))

/** Estado de una constancia de envío: el acuse de WhatsApp (Meta) manda sobre el estado del envío. */
export function estadoConstancia(c: { estado_envio: string; acuse?: string | null }): { texto: string; tono: Tono } {
  const acuse: Record<string, { texto: string; tono: Tono }> = {
    read: { texto: 'Leído', tono: 'exito' },
    delivered: { texto: 'Entregado', tono: 'exito' },
    sent: { texto: 'Enviado', tono: 'info' },
    failed: { texto: 'No llegó', tono: 'peligro' },
  }
  const envio: Record<string, { texto: string; tono: Tono }> = {
    pendiente: { texto: 'Pendiente', tono: 'neutro' },
    enviado: { texto: 'Enviado', tono: 'info' },
    fallido: { texto: 'No se pudo enviar', tono: 'peligro' },
  }
  return (c.acuse ? acuse[c.acuse] : undefined) ?? envio[c.estado_envio] ?? { texto: c.estado_envio, tono: 'neutro' }
}

/** ¿El envío llegó (entregado o leído)? */
export const constanciaEntregada = (c: { acuse?: string | null }) => c.acuse === 'delivered' || c.acuse === 'read'

/** «T1-101, T1-102 (poder), T2-302 (mora)»: los bienes que representa un asistente. */
export const resumenBienes = (a: Pick<Asistente, 'bienes'>) =>
  a.bienes.map((b) => `${b.codigo}${b.calidad === 'apoderado' ? ' (poder)' : ''}${b.moroso ? ' (mora)' : ''}`).join(', ')
