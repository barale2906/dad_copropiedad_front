import { beforeEach, describe, expect, it, vi } from 'vitest'

const tokens = (n: number) => ({
  sesion_id: 's',
  token_acceso: `acceso-${n}`,
  acceso_expira_en: new Date(Date.now() + 30 * 60_000).toISOString(),
  token_renovacion: `renovacion-${n}`,
  expira_maximo_en: new Date(Date.now() + 86_400_000).toISOString(),
})

describe('renovación de tokens', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('varias peticiones simultáneas renuevan una sola vez', async () => {
    localStorage.setItem('dad.sesion.renovacion', 'renovacion-0')
    const m = await import('@/api/tokens')
    let llamadas = 0
    m.configurarTokens({
      apiUrl: 'http://api',
      transporte: async () => {
        llamadas++
        await new Promise((r) => setTimeout(r, 10))
        return new Response(JSON.stringify(tokens(1)), { status: 200 })
      },
    })
    const r = await Promise.all([m.renovar(), m.renovar(), m.renovar()])
    expect(r).toEqual([true, true, true])
    expect(llamadas).toBe(1)
    expect(m.tokenAcceso()).toBe('acceso-1')
    expect(localStorage.getItem('dad.sesion.renovacion')).toBe('renovacion-1')
  })

  it('un 401 al renovar cierra la sesión y avisa', async () => {
    localStorage.setItem('dad.sesion.renovacion', 'renovacion-0')
    const m = await import('@/api/tokens')
    const cerrada = vi.fn()
    m.alCerrarSesion(cerrada)
    m.configurarTokens({
      apiUrl: 'http://api',
      transporte: async () => new Response('{}', { status: 401 }),
    })
    expect(await m.renovar()).toBe(false)
    expect(m.haySesion()).toBe(false)
    expect(cerrada).toHaveBeenCalledOnce()
    expect(localStorage.getItem('dad.sesion.renovacion')).toBeNull()
  })

  it('envía el token de renovación guardado', async () => {
    localStorage.setItem('dad.sesion.renovacion', 'renovacion-7')
    const m = await import('@/api/tokens')
    let cuerpo: unknown = null
    m.configurarTokens({
      apiUrl: 'http://api',
      transporte: async (req) => {
        cuerpo = await req.json()
        return new Response(JSON.stringify(tokens(8)), { status: 200 })
      },
    })
    await m.renovar()
    expect(cuerpo).toEqual({ token_renovacion: 'renovacion-7' })
  })
})
