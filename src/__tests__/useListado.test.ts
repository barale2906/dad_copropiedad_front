import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { ErrorApi } from '@/api/errores'
import { type Pagina, useListado } from '@/composables/useListado'

const pagina = (datos: number[], siguiente: string | null = null): Pagina<number> => ({ datos, siguiente })

function crear<F>(...args: Parameters<typeof useListado<number, F>>) {
  const alcance = effectScope()
  const listado = alcance.run(() => useListado<number, F>(...args))!
  return { listado, alcance }
}

describe('useListado', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('carga la primera página y luego las siguientes por cursor', async () => {
    const consultar = vi.fn(async (despues?: string) => (despues ? pagina([3], null) : pagina([1, 2], 'c2')))
    const { listado } = crear(consultar)
    expect(listado.estado.value).toBe('cargando')
    await flushPromises()
    expect(listado.filas.value).toEqual([1, 2])
    expect(listado.hayMas.value).toBe(true)
    await listado.cargarMas()
    expect(consultar).toHaveBeenLastCalledWith('c2', undefined)
    expect(listado.filas.value).toEqual([1, 2, 3])
    expect(listado.hayMas.value).toBe(false)
    await listado.cargarMas()
    expect(consultar).toHaveBeenCalledTimes(2)
  })

  it('sin resultados queda vacío', async () => {
    const { listado } = crear(async () => pagina([]))
    await flushPromises()
    expect(listado.estado.value).toBe('vacio')
  })

  it('un error deja el mensaje y la referencia, y recargar lo reintenta', async () => {
    let fallar = true
    const { listado } = crear(async () => {
      if (fallar) throw new ErrorApi(500, 'interno', 'Falló.', 'req-7')
      return pagina([1])
    })
    await flushPromises()
    expect(listado.estado.value).toBe('error')
    expect(listado.referencia.value).toBe('req-7')
    fallar = false
    await listado.recargar()
    expect(listado.estado.value).toBe('listo')
    expect(listado.error.value).toBeNull()
  })

  it('al cambiar los filtros espera el retardo y recarga desde el principio', async () => {
    const filtros = ref({ q: '' })
    const consultar = vi.fn(async (_d: string | undefined, f: { q: string }) => pagina(f.q ? [9] : [1, 2]))
    const { listado } = crear(consultar, { filtros, retardo: 300 })
    await flushPromises()
    filtros.value.q = 'a'
    await flushPromises()
    filtros.value.q = 'ab'
    await flushPromises()
    vi.advanceTimersByTime(299)
    expect(consultar).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    await flushPromises()
    expect(consultar).toHaveBeenCalledTimes(2)
    expect(consultar).toHaveBeenLastCalledWith(undefined, { q: 'ab' })
    expect(listado.filas.value).toEqual([9])
  })

  it('descarta una respuesta vieja si llega después de una más nueva', async () => {
    const resolvedores: ((p: Pagina<number>) => void)[] = []
    const { listado } = crear(() => new Promise<Pagina<number>>((ok) => resolvedores.push(ok)), {
      inmediato: false,
    })
    const vieja = listado.recargar()
    const nueva = listado.recargar()
    resolvedores[1]!(pagina([2]))
    await nueva
    resolvedores[0]!(pagina([1]))
    await vieja
    expect(listado.filas.value).toEqual([2])
  })

  it('al destruirse ignora lo que llegue después', async () => {
    let resolver: (p: Pagina<number>) => void = () => {}
    const { listado, alcance } = crear(() => new Promise<Pagina<number>>((ok) => (resolver = ok)))
    alcance.stop()
    resolver(pagina([1]))
    await flushPromises()
    expect(listado.filas.value).toEqual([])
  })
})
