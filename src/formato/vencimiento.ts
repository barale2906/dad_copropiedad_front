/** Plazos y ventanas de tiempo (funciones puras): semáforo de vencimiento y ventana de 24 h. */
import { textoDuracion } from './franjas'

export type TonoPlazo = 'peligro' | 'aviso' | 'exito' | 'neutro'

const MIN = 60_000
const HORA = 60 * MIN

/** Tiempo legible: minutos y horas hasta un día; desde ahí, días. */
export function lapso(ms: number): string {
  const minutos = Math.max(0, Math.round(ms / MIN))
  if (minutos < 24 * 60) return minutos < 1 ? 'menos de 1 min' : textoDuracion(minutos)
  const dias = Math.round(minutos / (24 * 60))
  return `${dias} ${dias === 1 ? 'día' : 'días'}`
}

/**
 * Semáforo de un plazo: vencido (rojo), vence en menos de `alerta` (ámbar, 24 h por defecto),
 * a tiempo (verde) o sin plazo (neutro). `vencido` es el dato del backend: manda sobre el reloj.
 */
export function semaforoVencimiento(
  venceEn: string | null | undefined,
  vencido: boolean,
  ahora: Date = new Date(),
  alertaMs = 24 * HORA,
): { tono: TonoPlazo; texto: string } {
  if (!venceEn) return vencido ? { tono: 'peligro', texto: 'Vencido' } : { tono: 'neutro', texto: 'Sin plazo' }
  const resta = Date.parse(venceEn) - ahora.getTime()
  if (vencido || resta <= 0) return { tono: 'peligro', texto: `Vencido hace ${lapso(-resta)}` }
  if (resta <= alertaMs) return { tono: 'aviso', texto: `Vence en ${lapso(resta)}` }
  return { tono: 'exito', texto: `Vence en ${lapso(resta)}` }
}

/** Ventana de WhatsApp: se responde libre durante 24 h desde el último mensaje del residente. */
export const VENTANA_WHATSAPP_MS = 24 * HORA

export function ventanaRestante(
  ultimoEntrante: string,
  ahora: Date = new Date(),
): { abierta: boolean; restanteMs: number; texto: string; tono: TonoPlazo } {
  const restanteMs = Date.parse(ultimoEntrante) + VENTANA_WHATSAPP_MS - ahora.getTime()
  if (restanteMs <= 0) {
    return { abierta: false, restanteMs: 0, texto: 'La ventana de 24 h se cerró: ya no se puede responder por aquí.', tono: 'neutro' }
  }
  return {
    abierta: true,
    restanteMs,
    texto: `Quedan ${lapso(restanteMs)} para responder`,
    tono: restanteMs <= 2 * HORA ? 'aviso' : 'exito',
  }
}
