/** Reglas y textos de la portería (funciones puras). */
import type {
  EstadoCredencial,
  EstadoVisita,
  EventoVisita,
  OrigenAutorizacionAcceso,
  ResultadoAcceso,
  ResultadoLlamada,
  SentidoAcceso,
  TipoCredencial,
  TipoDispositivoAcceso,
  TipoEventoVisita,
  TipoNovedadMinuta,
  TipoPuntoAcceso,
  Visita,
} from '@/api/tipos'
import { accionesPermitidas } from '@/composables/reglas'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'

export const ESTADO_VISITA: Record<EstadoVisita, { texto: string; tono: Tono }> = {
  anunciada: { texto: 'Avisando al residente', tono: 'info' },
  requiere_llamada: { texto: 'Llamar al residente', tono: 'peligro' },
  autorizada: { texto: 'Autorizada', tono: 'exito' },
  rechazada: { texto: 'Rechazada', tono: 'neutro' },
  sin_respuesta: { texto: 'Sin respuesta', tono: 'aviso' },
  ingresada: { texto: 'Adentro', tono: 'info' },
  finalizada: { texto: 'Salió', tono: 'neutro' },
  vencida: { texto: 'Vencida', tono: 'neutro' },
  cancelada: { texto: 'Cancelada', tono: 'neutro' },
}

export type AccionVisita = 'contactos' | 'llamada' | 'ingreso' | 'salida' | 'cancelar'

/** Botones de la portería según el estado de la visita (guía §6). */
const BOTONES = {
  anunciada: ['cancelar'],
  requiere_llamada: ['contactos', 'llamada', 'cancelar'],
  autorizada: ['ingreso', 'cancelar'],
  ingresada: ['salida'],
} as const satisfies Partial<Record<EstadoVisita, readonly AccionVisita[]>>

export function accionesDeVisita(estado: EstadoVisita): readonly AccionVisita[] {
  return accionesPermitidas<EstadoVisita, AccionVisita>(estado, BOTONES)
}

/** Visitas que siguen abiertas para la portería (el turno las muestra). */
export const visitaAbierta = (v: Pick<Visita, 'estado'>) =>
  ['anunciada', 'requiere_llamada', 'autorizada', 'ingresada', 'sin_respuesta'].includes(v.estado)

/** Orden del turno: primero lo que exige acción (llamar, decidir, dejar pasar), luego lo demás. */
const PRIORIDAD: Partial<Record<EstadoVisita, number>> = { requiere_llamada: 0, sin_respuesta: 1, autorizada: 2, anunciada: 3, ingresada: 4 }
export function ordenarTurno<T extends Pick<Visita, 'estado' | 'creada_en'>>(lista: T[]): T[] {
  return [...lista].sort((a, b) => (PRIORIDAD[a.estado] ?? 9) - (PRIORIDAD[b.estado] ?? 9) || a.creada_en.localeCompare(b.creada_en))
}

/**
 * Tiempo transcurrido desde el anuncio («hace 3 min»). El escalamiento lo hace el backend y no
 * expone un «próximo aviso»: la portería ve cuánto lleva esperando.
 */
export function transcurrido(desde: string, ahora: Date = new Date()): string {
  const min = Math.max(0, Math.floor((ahora.getTime() - Date.parse(desde)) / 60_000))
  if (min < 1) return 'hace menos de 1 min'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  return `hace ${h} h ${min % 60} min`
}

const EVENTO: Record<TipoEventoVisita, string> = {
  anunciada: 'Anunciada en portería',
  preautorizada: 'Pre-autorizada por el residente',
  aviso_enviado: 'Aviso enviado',
  autorizada: 'Autorizada',
  rechazada: 'Rechazada',
  escalada_llamada: 'Nadie respondió: hay que llamar',
  llamada: 'Llamada registrada',
  ingreso: 'Ingresó',
  salida: 'Salió',
  vencida: 'Venció',
  cancelada: 'Cancelada',
}

/** Texto de un evento de la línea de tiempo (nivel 1 = responsable; 2 = todos los residentes). */
export function textoEvento(e: Pick<EventoVisita, 'tipo' | 'nivel' | 'destinatarios' | 'canal'>): string {
  if (e.tipo === 'aviso_enviado') {
    const a = e.nivel && e.nivel > 1 ? `a todos los residentes${e.destinatarios ? ` (${e.destinatarios})` : ''}` : 'al responsable del bien'
    return `Aviso enviado ${a}${e.canal ? ` por ${e.canal}` : ''}`
  }
  return EVENTO[e.tipo]
}

export const RESULTADO_LLAMADA: Record<ResultadoLlamada, string> = {
  autorizo: 'Autorizó',
  rechazo: 'Rechazó',
  no_contesto: 'No contestó',
}

export const TIPO_NOVEDAD: Record<TipoNovedadMinuta, string> = {
  inicio_turno: 'Inicio de turno',
  entrega_turno: 'Entrega de turno',
  ronda: 'Ronda',
  novedad: 'Novedad',
  incidente: 'Incidente',
  otro: 'Otro',
}

export const RESULTADO_ACCESO: Record<ResultadoAcceso, { texto: string; tono: Tono }> = {
  permitido: { texto: 'Permitido', tono: 'exito' },
  denegado: { texto: 'Denegado', tono: 'peligro' },
  forzado: { texto: 'Forzado', tono: 'peligro' },
  manual: { texto: 'Manual', tono: 'info' },
}

export const SENTIDO: Record<SentidoAcceso, string> = { entrada: 'Entrada', salida: 'Salida', ambos: 'Entrada y salida' }

export const TIPO_CREDENCIAL: Record<TipoCredencial, string> = {
  tarjeta_rfid: 'Tarjeta',
  pin: 'PIN',
  qr_permanente: 'QR permanente',
  qr_temporal: 'QR temporal',
  placa: 'Placa',
  biometria_ref: 'Biometría',
  app_movil: 'App móvil',
}

/** Tipos que la portería emite a mano (la biometría exige consentimiento; la app la emite la app). */
export const TIPOS_EMITIBLES: TipoCredencial[] = ['tarjeta_rfid', 'pin', 'qr_permanente', 'placa']

/** ¿El tipo necesita que se escriba su valor? (tarjeta y placa sí; PIN y QR los genera el backend). */
export const pideValor = (t: TipoCredencial) => t === 'tarjeta_rfid' || t === 'placa'

export const ESTADO_CREDENCIAL: Record<EstadoCredencial, { texto: string; tono: Tono }> = {
  activa: { texto: 'Activa', tono: 'exito' },
  suspendida: { texto: 'Suspendida', tono: 'aviso' },
  revocada: { texto: 'Revocada', tono: 'neutro' },
  perdida: { texto: 'Perdida', tono: 'peligro' },
}

/** A qué estados puede pasar una credencial (revocada y perdida son definitivas). */
export function transicionesCredencial(e: EstadoCredencial): EstadoCredencial[] {
  if (e === 'activa') return ['suspendida', 'perdida', 'revocada']
  if (e === 'suspendida') return ['activa', 'revocada']
  return []
}

/** Solo se rotan los QR permanentes y los de la app. */
export const rotable = (t: TipoCredencial) => t === 'qr_permanente' || t === 'app_movil'

export const ORIGEN_AUTORIZACION: Record<OrigenAutorizacionAcceso, string> = {
  residencia: 'Residencia',
  propiedad: 'Propiedad',
  contrato: 'Contrato de servicio',
  reserva: 'Reserva',
  visita: 'Visita',
  manual: 'Manual',
}

export const TIPO_PUNTO: Record<TipoPuntoAcceso, string> = { peatonal: 'Peatonal', vehicular: 'Vehicular', mixto: 'Mixto', interno: 'Interno' }

export const TIPO_DISPOSITIVO: Record<TipoDispositivoAcceso, string> = {
  torniquete: 'Torniquete',
  talanquera: 'Talanquera',
  puerta: 'Puerta',
  lector_qr: 'Lector de QR',
  lector_rfid: 'Lector de tarjetas',
  teclado_pin: 'Teclado de PIN',
  biometrico_huella: 'Lector de huella',
  biometrico_facial: 'Reconocimiento facial',
  camara_lpr: 'Cámara de placas',
}

/** Texto de una alerta de acceso que llega como código (puente caído, intentos fallidos…). */
export function textoAlerta(tipo: string): string {
  const t: Record<string, string> = {
    puente_sin_latido: 'Un puente dejó de reportarse',
    intentos_fallidos: 'Intentos fallidos repetidos',
    puerta_forzada: 'Puerta forzada',
  }
  return t[tipo] ?? tipo.replace(/_/g, ' ')
}
