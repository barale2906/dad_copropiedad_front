/**
 * Conexión en tiempo real por WebSocket (tablero de la asamblea, plan 08). El token va en el
 * subprotocolo (`['dad.v1', token]`), nunca en la URL; se reconecta con espera creciente y un
 * token vigente.
 */
import { renovar, tokenAcceso } from './tokens'

export type EstadoEnVivo = 'conectando' | 'conectado' | 'reconectando' | 'cerrado'

export interface OpcionesEnVivo {
  alMensaje: (datos: unknown) => void
  alEstado?: (estado: EstadoEnVivo) => void
  /** Espera inicial y máxima entre reintentos (ms). */
  esperaInicial?: number
  esperaMaxima?: number
  /** Para pruebas: el constructor de WebSocket. */
  crear?: (url: string, protocolos: string[]) => WebSocket
}

/** Conecta y devuelve `cerrar()`; los mensajes JSON se entregan ya interpretados. */
export function conectarEnVivo(url: string, opciones: OpcionesEnVivo): { cerrar: () => void } {
  const { alMensaje, alEstado, esperaInicial = 1000, esperaMaxima = 30_000 } = opciones
  const crear = opciones.crear ?? ((u: string, p: string[]) => new WebSocket(u, p))
  let socket: WebSocket | null = null
  let intento = 0
  let cerrado = false
  let temporizador: ReturnType<typeof setTimeout> | undefined

  async function abrir() {
    alEstado?.(intento === 0 ? 'conectando' : 'reconectando')
    let token = tokenAcceso()
    if (!token) {
      await renovar().catch(() => false)
      token = tokenAcceso()
    }
    if (cerrado) return
    if (!token) {
      alEstado?.('cerrado')
      return
    }
    socket = crear(url, ['dad.v1', token])
    socket.onopen = () => {
      intento = 0
      alEstado?.('conectado')
    }
    socket.onmessage = (e: MessageEvent) => {
      try {
        alMensaje(typeof e.data === 'string' ? JSON.parse(e.data) : e.data)
      } catch {
        // Mensaje ilegible: se ignora sin cortar la conexión.
      }
    }
    socket.onclose = () => {
      socket = null
      if (cerrado) {
        alEstado?.('cerrado')
        return
      }
      const espera = Math.min(esperaMaxima, esperaInicial * 2 ** intento)
      intento++
      alEstado?.('reconectando')
      temporizador = setTimeout(() => void abrir(), espera)
    }
  }

  void abrir()

  return {
    cerrar() {
      cerrado = true
      clearTimeout(temporizador)
      socket?.close(1000)
      alEstado?.('cerrado')
    },
  }
}
