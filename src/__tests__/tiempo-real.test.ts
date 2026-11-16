import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { conectarEnVivo, type EstadoEnVivo } from '@/api/en-vivo'
import { guardarTokens, limpiar } from '@/api/tokens'
import { useRefresco } from '@/composables/useRefresco'

/** WebSocket falso: registra lo que se abre y permite simular eventos. */
class SocketFalso {
  static creados: SocketFalso[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  cerradoCon: number | null = null
  constructor(
    readonly url: string,
    readonly protocolos: string[],
  ) {
    SocketFalso.creados.push(this)
  }
  close(codigo: number) {
    this.cerradoCon = codigo
  }
}

const crear = (url: string, protocolos: string[]) => new SocketFalso(url, protocolos) as unknown as WebSocket

function conToken() {
  const ahora = Date.now()
  guardarTokens({
    sesion_id: 's',
    token_acceso: 'tok-1',
    acceso_expira_en: new Date(ahora + 600_000).toISOString(),
    token_renovacion: 'r',
    expira_maximo_en: new Date(ahora + 86_400_000).toISOString(),
  })
}

describe('conectarEnVivo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    SocketFalso.creados = []
    conToken()
  })
  afterEach(() => {
    vi.useRealTimers()
    limpiar(false)
  })

  it('envía el token como subprotocolo, no en la URL, y entrega los mensajes', async () => {
    const mensajes: unknown[] = []
    const estados: EstadoEnVivo[] = []
    conectarEnVivo('wss://api/en-vivo', { alMensaje: (d) => mensajes.push(d), alEstado: (e) => estados.push(e), crear })
    await vi.advanceTimersByTimeAsync(0)
    const s = SocketFalso.creados[0]!
    expect(s.url).toBe('wss://api/en-vivo')
    expect(s.protocolos).toEqual(['dad.v1', 'tok-1'])
    s.onopen?.()
    s.onmessage?.({ data: '{"quorum":"0.51"}' })
    s.onmessage?.({ data: 'no es json' })
    expect(mensajes).toEqual([{ quorum: '0.51' }])
    expect(estados).toEqual(['conectando', 'conectado'])
  })

  it('reconecta con espera creciente hasta el máximo', async () => {
    conectarEnVivo('wss://x', { alMensaje: () => {}, crear, esperaInicial: 100, esperaMaxima: 250 })
    await vi.advanceTimersByTimeAsync(0)
    SocketFalso.creados[0]!.onclose?.()
    await vi.advanceTimersByTimeAsync(99)
    expect(SocketFalso.creados).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(SocketFalso.creados).toHaveLength(2)
    SocketFalso.creados[1]!.onclose?.()
    await vi.advanceTimersByTimeAsync(200)
    expect(SocketFalso.creados).toHaveLength(3)
    SocketFalso.creados[2]!.onclose?.()
    await vi.advanceTimersByTimeAsync(249)
    expect(SocketFalso.creados).toHaveLength(3)
    await vi.advanceTimersByTimeAsync(1)
    expect(SocketFalso.creados).toHaveLength(4)
  })

  it('cerrar no reconecta', async () => {
    const conexion = conectarEnVivo('wss://x', { alMensaje: () => {}, crear })
    await vi.advanceTimersByTimeAsync(0)
    conexion.cerrar()
    expect(SocketFalso.creados[0]!.cerradoCon).toBe(1000)
    SocketFalso.creados[0]!.onclose?.()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(SocketFalso.creados).toHaveLength(1)
  })

  it('sin sesión no conecta', async () => {
    limpiar(false)
    const estados: EstadoEnVivo[] = []
    conectarEnVivo('wss://x', { alMensaje: () => {}, alEstado: (e) => estados.push(e), crear })
    await vi.advanceTimersByTimeAsync(0)
    expect(SocketFalso.creados).toHaveLength(0)
    expect(estados.at(-1)).toBe('cerrado')
  })
})

describe('useRefresco', () => {
  let visible: DocumentVisibilityState = 'visible'
  beforeEach(() => {
    vi.useFakeTimers()
    visible = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visible)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const cambiar = (v: DocumentVisibilityState) => {
    visible = v
    document.dispatchEvent(new Event('visibilitychange'))
  }

  it('refresca cada intervalo solo con la pestaña visible y al volver', async () => {
    const fn = vi.fn()
    const alcance = effectScope()
    alcance.run(() => useRefresco(fn, { cada: 1000 }))
    await vi.advanceTimersByTimeAsync(2000)
    expect(fn).toHaveBeenCalledTimes(2)
    cambiar('hidden')
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(2)
    cambiar('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(3)
    alcance.stop()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('no se encima si el refresco anterior no ha terminado, y tolera errores', async () => {
    let liberar: () => void = () => {}
    const fn = vi.fn(() => new Promise<void>((ok) => (liberar = ok)))
    const alcance = effectScope()
    const r = alcance.run(() => useRefresco(fn, { cada: 1000 }))!
    await vi.advanceTimersByTimeAsync(3000)
    expect(fn).toHaveBeenCalledTimes(1)
    liberar()
    await vi.advanceTimersByTimeAsync(0)
    fn.mockRejectedValueOnce(new Error('red'))
    await r.refrescar()
    expect(fn).toHaveBeenCalledTimes(2)
    alcance.stop()
  })
})
