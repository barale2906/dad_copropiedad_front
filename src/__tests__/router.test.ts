import { describe, expect, it } from 'vitest'
import { existeEnElMapa, router } from '@/app/router'

const ID = '01930000-0000-7000-8000-000000000001'

describe('rutas de módulo', () => {
  it('acepta una sección del mapa, con o sin acción válida', () => {
    expect(existeEnElMapa(router.resolve(`/e/${ID}/zonas-comunes`))).toBe(true)
    expect(existeEnElMapa(router.resolve(`/e/${ID}/zonas-comunes/reservar`))).toBe(true)
  })

  it('rechaza una sección o una acción que no existen', () => {
    expect(existeEnElMapa(router.resolve(`/e/${ID}/inventado`))).toBe(false)
    expect(existeEnElMapa(router.resolve(`/e/${ID}/zonas-comunes/inventada`))).toBe(false)
    // La sección retirada del catálogo tampoco existe.
    expect(existeEnElMapa(router.resolve(`/e/${ID}/publicidad`))).toBe(false)
  })

  it('las demás rutas no se validan contra el mapa', () => {
    expect(existeEnElMapa(router.resolve('/entidades'))).toBe(true)
  })

  it('cualquier dirección desconocida va a «no encontrado»', () => {
    expect(router.resolve('/no/existe').name).toBe('no-encontrado')
  })
})
