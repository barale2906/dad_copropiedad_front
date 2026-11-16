import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { ErrorApi } from '@/api/errores'
import { useAccion } from '@/composables/useAccion'
import { useEntidad } from '@/stores/entidad'
import { conCapacidades, prepararConDemo } from './ayudantes'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const falla = (estado: number, codigo: ErrorApi['codigo'], reintentarEn: number | null = null) =>
  new ErrorApi(estado, codigo, `Error ${codigo}`, 'req-1', reintentarEn)

function crear<R>(fn: (clave: string) => Promise<R>, opciones = {}) {
  const alcance = effectScope()
  const accion = alcance.run(() => useAccion(fn, opciones))!
  return { accion, alcance }
}

describe('useAccion', () => {
  beforeEach(() => {
    prepararConDemo()
    push.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('reutiliza la clave de idempotencia al reintentar y la cambia tras el éxito', async () => {
    const claves: string[] = []
    let fallar = true
    const { accion } = crear(async (clave) => {
      claves.push(clave)
      if (fallar) throw falla(422, 'validacion')
      return 'ok'
    })
    expect(await accion.ejecutar()).toEqual({ ok: false })
    expect(accion.error.value).toBe('Error validacion')
    fallar = false
    expect(await accion.ejecutar()).toEqual({ ok: true, valor: 'ok' })
    await accion.ejecutar()
    expect(claves[0]).toBe(claves[1])
    expect(claves[2]).not.toBe(claves[1])
    expect(accion.error.value).toBeNull()
  })

  it('no ejecuta dos veces mientras espera', async () => {
    let liberar: () => void = () => {}
    const fn = vi.fn(() => new Promise<void>((ok) => (liberar = ok)))
    const { accion } = crear(fn)
    const primera = accion.ejecutar()
    expect(accion.cargando.value).toBe(true)
    await accion.ejecutar()
    liberar()
    await primera
    expect(fn).toHaveBeenCalledTimes(1)
    expect(accion.cargando.value).toBe(false)
  })

  it('sin permiso refresca las capacidades de la entidad', async () => {
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] })
    const refrescar = vi.spyOn(useEntidad(), 'refrescar').mockResolvedValue()
    const { accion } = crear(() => Promise.reject(falla(403, 'sin_permiso')))
    await accion.ejecutar()
    expect(refrescar).toHaveBeenCalled()
    expect(accion.codigo.value).toBe('sin_permiso')
  })

  it('un conflicto de estado avisa para recargar el recurso', async () => {
    const alConflicto = vi.fn()
    const { accion } = crear(() => Promise.reject(falla(409, 'conflicto_estado')), { alConflicto })
    await accion.ejecutar()
    expect(alConflicto).toHaveBeenCalled()
  })

  it('sin segundo factor lleva a Mi cuenta', async () => {
    const { accion } = crear(() => Promise.reject(falla(403, 'segundo_factor_requerido')))
    await accion.ejecutar()
    expect(push).toHaveBeenCalledWith({ name: 'cuenta', hash: '#segundo-factor' })
    expect(accion.error.value).toContain('segundo factor')
  })

  it('con idempotencia reusada la próxima acción usa otra clave', async () => {
    const claves: string[] = []
    const { accion } = crear(async (clave) => {
      claves.push(clave)
      throw falla(422, 'idempotencia_reusada')
    })
    await accion.ejecutar()
    await accion.ejecutar()
    expect(claves[0]).not.toBe(claves[1])
  })

  it('demasiadas peticiones bloquea con cuenta regresiva', async () => {
    vi.useFakeTimers()
    const fn = vi.fn(() => Promise.reject(falla(429, 'demasiadas_peticiones', 3)))
    const { accion, alcance } = crear(fn)
    await accion.ejecutar()
    expect(accion.segundosEspera.value).toBe(3)
    await accion.ejecutar()
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(3000)
    await flushPromises()
    expect(accion.segundosEspera.value).toBe(0)
    alcance.stop()
  })

  it('un error que no es de la API se muestra con un mensaje genérico', async () => {
    const { accion } = crear(() => Promise.reject(new Error('x')))
    await accion.ejecutar()
    expect(accion.error.value).toBe('Ocurrió un error inesperado.')
    expect(accion.codigo.value).toBeNull()
    accion.reiniciar()
    expect(accion.error.value).toBeNull()
  })

  it('una acción sin respuesta también termina bien', async () => {
    const { accion } = crear(() => Promise.resolve(undefined))
    expect(await accion.ejecutar()).toEqual({ ok: true, valor: undefined })
  })

  it('avisa el éxito con el resultado', async () => {
    const alExito = vi.fn()
    const { accion } = crear(() => Promise.resolve(7), { alExito })
    await accion.ejecutar()
    expect(alExito).toHaveBeenCalledWith(7)
  })
})
