import { beforeEach, describe, expect, it } from 'vitest'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import { haySesion, limpiar } from '@/api/tokens'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from './ayudantes'

describe('store de sesión', () => {
  beforeEach(() => {
    limpiar(false)
    prepararConDemo()
  })

  it('inicia sesión y ordena las entidades por nombre', async () => {
    const s = useSesion()
    expect(await s.iniciar('admin', 'x')).toBe('sesion')
    expect(s.estado).toBe('autenticado')
    expect(haySesion()).toBe(true)
    const nombres = s.entidades.map((e) => e.nombre)
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, 'es')))
  })

  it('credenciales vacías → ErrorApi con código', async () => {
    await expect(useSesion().iniciar('admin', '')).rejects.toMatchObject({
      codigo: 'credenciales_invalidas',
      estado: 401,
    })
  })

  it('segundo factor: pide el código y luego entra', async () => {
    const s = useSesion()
    expect(await s.iniciar('uno-2fa', 'x')).toBe('segundo_factor')
    expect(s.desafio).not.toBeNull()
    await expect(s.completarSegundoFactor('000000')).rejects.toBeInstanceOf(ErrorApi)
    await s.completarSegundoFactor('123456')
    expect(s.estado).toBe('autenticado')
    expect(s.entidades).toHaveLength(1)
  })

  it('restaura la sesión guardada tras una recarga', async () => {
    await useSesion().iniciar('empresa', 'x')
    prepararConDemoConservandoToken()
    const s = useSesion()
    await s.restaurar()
    expect(s.estado).toBe('autenticado')
    expect(s.entidades[0]?.tipo).toBe('empresa')
  })

  it('sin token guardado queda anónima', async () => {
    const s = useSesion()
    await s.restaurar()
    expect(s.estado).toBe('anonimo')
  })

  it('cerrar sesión limpia tokens y estado', async () => {
    const s = useSesion()
    await s.iniciar('admin', 'x')
    await s.cerrar()
    expect(s.estado).toBe('anonimo')
    expect(haySesion()).toBe(false)
  })

  it('entrar a una entidad carga sus capacidades', async () => {
    const s = useSesion()
    await s.iniciar('empresa', 'x')
    const e = useEntidad()
    await e.entrar(s.entidades[0]!.entidad_id)
    expect(e.esPH).toBe(false)
    expect(e.tieneModulo('contabilidad')).toBe(true)
    expect(e.tieneModulo('facturacion_electronica')).toBe(true)
    expect(e.ultima()).toBe(s.entidades[0]!.entidad_id)
  })

  it('el facturador entra a una empresa con factura electrónica y sin contabilidad', async () => {
    const s = useSesion()
    await s.iniciar('facturador', 'x')
    expect(s.entidades.map((x) => x.nombre)).toEqual(['Comercial Andina S.A.S.'])
    const e = useEntidad()
    await e.entrar(s.entidades[0]!.entidad_id)
    expect(e.tieneModulo('facturacion_electronica')).toBe(true)
    expect(e.tieneModulo('contabilidad')).toBe(false)
  })

  it('no permite entrar a una entidad ajena', async () => {
    await useSesion().iniciar('empresa', 'x')
    await expect(useEntidad().entrar('otra')).rejects.toThrow()
  })
})

describe('mensajes de error', () => {
  it('agrega la referencia en errores internos y el tiempo de espera en límites', () => {
    expect(mensajeDeError(new ErrorApi(500, 'interno', 'Falló.', 'req-1'))).toBe('Falló. (ref. req-1)')
    expect(mensajeDeError(new ErrorApi(429, 'demasiados_intentos', 'Bloqueada.', null, 900))).toContain(
      '15 min',
    )
    expect(mensajeDeError(new Error('x'))).toBe('Ocurrió un error inesperado.')
  })
})

/** Simula una recarga: Pinia nuevo, el token de renovación sigue en localStorage. */
function prepararConDemoConservandoToken() {
  const token = localStorage.getItem('dad.sesion.renovacion')
  prepararConDemo()
  if (token) localStorage.setItem('dad.sesion.renovacion', token)
}
