import { beforeEach, describe, expect, it, vi } from 'vitest'

const API = 'http://api.prueba'

const tokens = (n: number) => ({
  sesion_id: 's',
  token_acceso: `acceso-${n}`,
  acceso_expira_en: new Date(Date.now() + 30 * 60_000).toISOString(),
  token_renovacion: `renovacion-${n}`,
  expira_maximo_en: new Date(Date.now() + 86_400_000).toISOString(),
})

const json = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } })

/** Módulos frescos (estado de tokens limpio) con un transporte simulado. */
async function preparar(transporte: (r: Request) => Promise<Response>) {
  vi.resetModules()
  const cliente = await import('@/api/cliente')
  const t = await import('@/api/tokens')
  cliente.iniciarCliente(API, transporte)
  return { ...cliente, ...t }
}

describe('cliente HTTP', () => {
  beforeEach(() => localStorage.clear())

  it('renueva antes de pedir si solo hay token de renovación y envía Authorization', async () => {
    localStorage.setItem('dad.sesion.renovacion', 'renovacion-0')
    const vistas: string[] = []
    const { api, exigir } = await preparar(async (r) => {
      vistas.push(`${r.method} ${new URL(r.url).pathname} ${r.headers.get('Authorization') ?? '-'}`)
      if (r.url.endsWith('/renovar')) return json(tokens(1))
      return json([])
    })
    await exigir(api().GET('/api/v1/yo/entidades'))
    expect(vistas).toEqual([
      'POST /api/v1/auth/sesion/renovar -',
      'GET /api/v1/yo/entidades Bearer acceso-1',
    ])
  })

  it('ante un 401 renueva una vez y repite la petición', async () => {
    let llamadasEntidades = 0
    const { api, exigir, guardarTokens } = await preparar(async (r) => {
      if (r.url.endsWith('/renovar')) return json(tokens(2))
      llamadasEntidades++
      return r.headers.get('Authorization') === 'Bearer acceso-2'
        ? json([{ entidad_id: 'e' }])
        : json({ error: { codigo: 'no_autenticado', mensaje: 'Vencido' } }, 401)
    })
    guardarTokens(tokens(1))
    const r = await exigir(api().GET('/api/v1/yo/entidades'))
    expect(r).toEqual([{ entidad_id: 'e' }])
    expect(llamadasEntidades).toBe(2)
  })

  it('si la renovación también falla, devuelve el 401 y cierra la sesión', async () => {
    const { api, exigir, guardarTokens, haySesion } = await preparar(async () =>
      json({ error: { codigo: 'no_autenticado', mensaje: 'Inicie sesión.' } }, 401),
    )
    guardarTokens(tokens(1))
    await expect(exigir(api().GET('/api/v1/yo/entidades'))).rejects.toMatchObject({
      codigo: 'no_autenticado',
    })
    expect(haySesion()).toBe(false)
  })

  it('no agrega Authorization al iniciar sesión', async () => {
    let autorizacion: string | null = 'sin-ver'
    const { api, exigir, guardarTokens } = await preparar(async (r) => {
      autorizacion = r.headers.get('Authorization')
      return json({ resultado: 'sesion', tokens: tokens(3), entidades: [] })
    })
    guardarTokens(tokens(1))
    await exigir(api().POST('/api/v1/auth/sesion', { body: { identificador: 'a', contrasena: 'b' } }))
    expect(autorizacion).toBeNull()
  })

  it('errores de red → ErrorApi con código «red»', async () => {
    const { api, exigir } = await preparar(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(exigir(api().GET('/api/v1/yo/entidades'))).rejects.toMatchObject({ codigo: 'red', estado: 0 })
  })

  it('cada petición lleva un X-Request-Id distinto', async () => {
    const ids: (string | null)[] = []
    const { api } = await preparar(async (r) => {
      ids.push(r.headers.get('X-Request-Id'))
      return json([])
    })
    await api().GET('/api/v1/yo/entidades')
    await api().GET('/api/v1/yo/entidades')
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('idempotencia() genera una clave por acción y respeta la dada', async () => {
    const { idempotencia } = await preparar(async () => json({}))
    expect(idempotencia('clave-1')).toEqual({ 'Idempotency-Key': 'clave-1' })
    expect(idempotencia()['Idempotency-Key']).not.toBe(idempotencia()['Idempotency-Key'])
  })
})
