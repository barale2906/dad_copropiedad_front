/** Reglas y textos de las asambleas (funciones puras). El backend decide; aquí solo se anticipa y se muestra. */
import type {
  AccionPregunta,
  AccionReunion,
  Asistente,
  BaseComputo,
  CanalVoto,
  CargoEleccion,
  CoincidenciaMesa,
  ConvocatoriaReunion,
  EfectoMora,
  EstadoActa,
  EstadoPoder,
  EstadoPregunta,
  EstadoPunto,
  EstadoReunion,
  Modalidad,
  MotivoSalida,
  NuevaPregunta,
  PasoActa,
  Pregunta,
  ReglaMayoria,
  TipoDocumentoReunion,
  TipoPregunta,
  TipoReunion,
  TipoVoto,
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

// Preguntas y votación --------------------------------------------------------------------

export const ESTADO_PREGUNTA: Record<EstadoPregunta, { texto: string; tono: Tono }> = {
  borrador: { texto: 'En borrador', tono: 'neutro' },
  abierta: { texto: 'Votación abierta', tono: 'info' },
  cerrada: { texto: 'Cerrada', tono: 'exito' },
  anulada: { texto: 'Anulada', tono: 'neutro' },
}

export const TIPO_PREGUNTA: Record<TipoPregunta, string> = {
  si_no: 'Sí o no',
  seleccion_unica: 'Una opción',
  seleccion_multiple: 'Varias opciones',
  eleccion: 'Elección por planchas',
}

export const TIPO_VOTO: Record<TipoVoto, string> = {
  nominal: 'Nominal (el acta dice qué votó cada bien)',
  reservado: 'Reservado (solo se publican los totales)',
}

export const CARGO_ELECCION: Record<CargoEleccion, string> = {
  presidente_asamblea: 'Presidente de la asamblea',
  secretario_asamblea: 'Secretario de la asamblea',
  comision_verificadora: 'Comisión verificadora del acta',
  consejero: 'Consejo de administración',
  revisor_fiscal: 'Revisor fiscal',
  comite_convivencia: 'Comité de convivencia',
}

/** Cargos cuya elección crea roles en la copropiedad (los de la asamblea solo quedan en el acta). */
export const CARGOS_CON_ROL: readonly CargoEleccion[] = ['consejero', 'revisor_fiscal', 'comite_convivencia']

export const CANAL_VOTO: Record<CanalVoto, string> = { web: 'Papeleta web', whatsapp: 'WhatsApp', presencial: 'Mesa', rotulo: 'Rótulo' }

export const ACCION_PREGUNTA: Record<AccionPregunta, string> = { abrir: 'Abrir la votación', cerrar: 'Cerrar la votación', anular: 'Anular' }

export type MayoriaElegible = 'simple' | 'calificada_70' | 'personalizada'

export const MAYORIA: Record<MayoriaElegible, string> = {
  simple: 'Mayoría simple de los presentes (art. 45)',
  calificada_70: 'Calificada: 70 % de la copropiedad (art. 46)',
  personalizada: 'Umbral del reglamento',
}

/** «Mayoría simple…» o «60 % de los presentes» para una regla del contrato. */
export function textoRegla(r: ReglaMayoria): string {
  if (r.regla === 'personalizada') return `${r.porcentaje ?? '?'} % ${r.sobre === 'total' ? 'de la copropiedad' : 'de los presentes'}`
  return MAYORIA[r.regla as MayoriaElegible] ?? r.regla
}

export type AccionSobrePregunta = AccionPregunta | 'editar' | 'eliminar'

/**
 * Botones de una pregunta (backend: borrador → abierta → cerrada; anular desde borrador o
 * abierta). Se edita en borrador mientras la reunión no termine; se abre con la asamblea instalada.
 */
export function accionesPregunta(
  p: Pick<Pregunta, 'estado'>,
  reunion: EstadoReunion,
  q: QuienConduce,
): AccionSobrePregunta[] {
  const r: AccionSobrePregunta[] = []
  const viva = reunion !== 'cerrada' && reunion !== 'cancelada'
  if (p.estado === 'borrador' && viva && (q.convocar || q.conducir)) r.push('editar', 'eliminar')
  if (p.estado === 'borrador' && reunion === 'instalada' && q.conducir) r.push('abrir')
  if (p.estado === 'abierta' && q.conducir) r.push('cerrar', 'anular')
  return r
}

/** Máximo de opciones que se eligen al votar (1 salvo selección múltiple). */
export const maximoSelecciones = (p: Pick<Pregunta, 'tipo' | 'max_selecciones'>) =>
  p.tipo === 'seleccion_multiple' ? Math.max(1, p.max_selecciones) : 1

/** ¿La selección del voto es válida? Devuelve el problema en palabras o `null`. */
export function problemaSeleccion(p: Pick<Pregunta, 'tipo' | 'max_selecciones' | 'opciones'>, elegidas: string[]): string | null {
  if (!elegidas.length) return 'Elija una opción.'
  const max = maximoSelecciones(p)
  if (elegidas.length > max) return `Elija como máximo ${max} opciones.`
  const blanco = p.opciones.find((o) => o.en_blanco)
  if (blanco && elegidas.length > 1 && elegidas.includes(blanco.id)) return 'El voto en blanco va solo.'
  return null
}

export interface OpcionBorrador {
  texto: string
  /** `nombre` vacío: integrante ya guardado (el contrato solo devuelve su id). */
  candidatos: { id: string; nombre: string }[]
}

export const opcionVacia = (): OpcionBorrador => ({ texto: '', candidatos: [] })

/** Borrador de una pregunta para el formulario (lo que se edita antes de enviarla). */
export interface BorradorPregunta {
  enunciado: string
  tipo: TipoPregunta
  tipo_voto: TipoVoto
  base: BaseComputo | ''
  mayoria: MayoriaElegible
  umbral: string
  sobre: 'presentes' | 'total'
  /** En elecciones, cada opción es una plancha o candidato con sus integrantes (personas de la PH). */
  opciones: OpcionBorrador[]
  con_abstencion: boolean
  max_selecciones: number
  cupos: number
  cargo: CargoEleccion | ''
  con_blanco: boolean
  punto_id: string
  temporizador: string
}

export function borradorVacio(): BorradorPregunta {
  return {
    enunciado: '', tipo: 'si_no', tipo_voto: 'nominal', base: '', mayoria: 'simple', umbral: '', sobre: 'presentes',
    opciones: [opcionVacia(), opcionVacia()], con_abstencion: true, max_selecciones: 2, cupos: 1, cargo: '', con_blanco: true, punto_id: '', temporizador: '',
  }
}

/** Lleva una pregunta del backend al formulario. */
export function borradorDe(p: Pregunta): BorradorPregunta {
  const opciones = p.opciones.filter((o) => !o.en_blanco).sort((a, b) => a.orden - b.orden).map((o) => ({ texto: o.texto, candidatos: o.candidatos.map((id) => ({ id, nombre: '' })) }))
  return {
    enunciado: p.enunciado, tipo: p.tipo, tipo_voto: p.tipo_voto, base: p.base_computo,
    mayoria: (p.regla_mayoria.regla as MayoriaElegible) ?? 'simple', umbral: p.regla_mayoria.porcentaje ?? '',
    sobre: p.regla_mayoria.sobre === 'total' ? 'total' : 'presentes',
    opciones: p.tipo === 'si_no' ? [opcionVacia(), opcionVacia()] : opciones, con_abstencion: p.tipo === 'si_no' ? p.opciones.length > 2 : true,
    max_selecciones: Math.max(2, p.max_selecciones), cupos: p.cupos ?? 1, cargo: p.cargo ?? '',
    con_blanco: p.opciones.some((o) => o.en_blanco), punto_id: p.punto_id ?? '',
    temporizador: p.temporizador_segundos == null ? '' : String(p.temporizador_segundos),
  }
}

/**
 * Valida el formulario con las reglas del backend (`validar_definicion`) y arma la petición.
 * Devuelve el problema en palabras o la petición lista.
 */
export function peticionPregunta(b: BorradorPregunta): { error: string } | { datos: NuevaPregunta } {
  const enunciado = b.enunciado.trim()
  if (!enunciado) return { error: 'Escriba la pregunta.' }
  const opciones = b.opciones.map((o) => ({ ...o, texto: o.texto.trim() })).filter((o) => o.texto)
  if (b.tipo !== 'si_no') {
    if (opciones.length < (b.tipo === 'eleccion' ? 1 : 2)) return { error: b.tipo === 'eleccion' ? 'Agregue al menos una plancha o candidato.' : 'Escriba al menos dos opciones.' }
    if (new Set(opciones.map((o) => o.texto.toLowerCase())).size !== opciones.length) return { error: 'Las opciones no pueden repetirse.' }
  }
  if (b.tipo === 'seleccion_multiple' && (b.max_selecciones < 2 || b.max_selecciones > opciones.length)) {
    return { error: `En selección múltiple se eligen de 2 a ${opciones.length} opciones.` }
  }
  if (b.tipo === 'eleccion' && b.cupos < 1) return { error: 'Indique cuántos cupos se eligen.' }
  if (b.mayoria === 'personalizada' && !/^\d{1,3}(\.\d+)?$/.test(b.umbral.trim())) return { error: 'Escriba el umbral del reglamento (por ejemplo, 60).' }
  if (b.mayoria === 'personalizada' && (comparar(b.umbral.trim(), '0') <= 0 || comparar(b.umbral.trim(), '100') > 0)) return { error: 'El umbral va de más de 0 a 100 %.' }
  const temporizador = b.temporizador.trim()
  if (temporizador && !/^\d+$/.test(temporizador)) return { error: 'El temporizador va en segundos enteros (0 = sin temporizador).' }
  const eleccion = b.tipo === 'eleccion'
  return {
    datos: {
      enunciado,
      tipo: b.tipo,
      tipo_voto: b.tipo_voto,
      base_computo: b.base || null,
      regla_mayoria: eleccion ? null : b.mayoria === 'personalizada' ? { regla: 'personalizada', porcentaje: b.umbral.trim(), sobre: b.sobre } : { regla: b.mayoria },
      max_selecciones: b.tipo === 'seleccion_multiple' ? b.max_selecciones : null,
      cupos: eleccion ? b.cupos : null,
      cargo: eleccion && b.cargo ? b.cargo : null,
      opciones: b.tipo === 'si_no' ? undefined : [...opciones.map((o) => ({ texto: o.texto, candidatos: eleccion ? o.candidatos.map((c) => c.id) : undefined })), ...(eleccion && b.con_blanco ? [{ texto: 'Voto en blanco', en_blanco: true }] : [])],
      con_abstencion: b.tipo === 'si_no' ? b.con_abstencion : undefined,
      punto_id: b.punto_id || null,
      temporizador_segundos: temporizador ? Number(temporizador) : null,
    },
  }
}

// Acta ---------------------------------------------------------------------------------------

export const ESTADO_ACTA: Record<EstadoActa, { texto: string; tono: Tono }> = {
  pendiente: { texto: 'Por generar', tono: 'neutro' },
  generada: { texto: 'Generada', tono: 'info' },
  aprobada: { texto: 'Aprobada', tono: 'exito' },
  publicada: { texto: 'Publicada', tono: 'exito' },
}

export type PasoDelActa = 'generar' | PasoActa

/**
 * Qué sigue con el acta (Ley 675, art. 47): generar el PDF (y regenerarlo mientras no se
 * apruebe) → subir el escaneo firmado → aprobar (comisión verificadora) → publicar.
 */
export function pasosActa(r: { estado: EstadoReunion; acta_estado: EstadoActa; acta_firmada_archivo_id?: string | null }): PasoDelActa[] {
  if (r.estado !== 'cerrada') return []
  if (r.acta_estado === 'pendiente') return ['generar']
  if (r.acta_estado === 'generada') return r.acta_firmada_archivo_id ? ['aprobar', 'firmada', 'generar'] : ['firmada', 'generar']
  if (r.acta_estado === 'aprobada') return ['publicar']
  return []
}
