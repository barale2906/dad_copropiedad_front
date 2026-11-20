import { describe, expect, it } from 'vitest'
import { existeEnElMapa, router } from '@/app/router'

const ID = '01930000-0000-7000-8000-000000000001'

describe('rutas de módulo', () => {
  it('acepta una sección del mapa, con o sin acción válida', () => {
    expect(existeEnElMapa(router.resolve(`/e/${ID}/zonas-comunes`))).toBe(true)
    expect(existeEnElMapa(router.resolve(`/e/${ID}/zonas-comunes/reservar`))).toBe(true)
  })

  it('admite el detalle de un recurso dentro de la acción', () => {
    const r = router.resolve(`/e/${ID}/entidad/roles/abc`)
    expect(r.name).toBe('modulo')
    expect(r.params).toMatchObject({ seccion: 'entidad', accion: 'roles', id: 'abc' })
    expect(existeEnElMapa(r)).toBe(true)
    expect(existeEnElMapa(router.resolve(`/e/${ID}/entidad/inventada/abc`))).toBe(false)
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

describe('rutas públicas', () => {
  it('papeleta, directorio, pantalla, comercio y verificación son externas', () => {
    for (const ruta of [`/papeleta/${ID}`, `/directorio/${ID}`, `/pantalla/${ID}`, '/comercio', `/verificar/${ID}`]) {
      expect(router.resolve(ruta).meta.externa, ruta).toBe(true)
    }
  })
})
