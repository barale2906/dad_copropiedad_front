import { beforeEach, describe, expect, it } from 'vitest'
import { useEntidad } from '@/stores/entidad'
import { conCapacidades, prepararConDemo } from './ayudantes'

describe('useEntidad', () => {
  beforeEach(() => prepararConDemo())

  it('sin capacidades no está en modo soporte', () => {
    expect(useEntidad().modoSoporte).toBe(false)
  })

  it('refleja el modo soporte que entregan las capacidades', () => {
    const e = conCapacidades({ tipo: 'empresa', modulos: [], permisos: [], modo_soporte: true })
    expect(e.modoSoporte).toBe(true)
    conCapacidades({ tipo: 'empresa', modulos: [], permisos: [] })
    expect(e.modoSoporte).toBe(false)
  })

  it('distingue la PH de la empresa y de la plataforma', () => {
    const e = conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] })
    expect(e.esPH).toBe(true)
    conCapacidades({ tipo: 'plataforma', modulos: [], permisos: [] })
    expect(e.esPH).toBe(false)
  })
})
