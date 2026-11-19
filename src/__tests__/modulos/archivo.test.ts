import { describe, expect, it } from 'vitest'
import type { Permiso } from '@/api/tipos'
import { aConsulta, clasificacionesVisibles, nombreTipo, puedeAbrir, tamanoLegible } from '@/modulos/archivo/archivo'

describe('reglas del archivo', () => {
  it('muestra el tamaño en la unidad adecuada', () => {
    expect(tamanoLegible(512)).toBe('512 B')
    expect(tamanoLegible(1536)).toBe('1,5 KB')
    expect(tamanoLegible(5 * 1024 * 1024)).toBe('5 MB')
    expect(tamanoLegible(3 * 1024 ** 4)).toBe('3.072 GB')
    expect(nombreTipo('application/pdf')).toBe('PDF')
  })

  it('los personales y sensibles exigen el permiso de datos personales', () => {
    const con = (...ps: Permiso[]) => (p: Permiso) => ps.includes(p)
    expect(puedeAbrir('interno', con('archivos.ver'))).toBe(true)
    expect(puedeAbrir('personal', con('archivos.ver'))).toBe(false)
    expect(puedeAbrir('sensible', con('archivos.ver', 'archivos.personales.ver'))).toBe(true)
    expect(puedeAbrir('publico', con('archivos.subir'))).toBe(false)
  })
})

describe('filtros del archivo', () => {
  const con = (...ps: Permiso[]) => (p: Permiso) => ps.includes(p)

  it('toma los días completos en la zona de la entidad y omite lo vacío', () => {
    expect(aConsulta({ clasificacion: '', q: '  ', desde: '', hasta: '' }, 'America/Bogota')).toEqual({
      clasificacion: undefined, q: undefined, desde: undefined, hasta: undefined,
    })
    expect(aConsulta({ clasificacion: 'personal', q: ' acta ', desde: '2026-11-01', hasta: '2026-11-30' }, 'America/Bogota')).toEqual({
      clasificacion: 'personal',
      q: 'acta',
      desde: '2026-11-01T05:00:00Z',
      hasta: '2026-12-01T05:00:00Z',
    })
  })

  it('sin el permiso de datos personales solo ofrece público e interno', () => {
    expect(clasificacionesVisibles(con('archivos.ver'))).toEqual(['publico', 'interno'])
    expect(clasificacionesVisibles(con('archivos.ver', 'archivos.personales.ver'))).toEqual(['publico', 'interno', 'personal', 'sensible'])
  })
})
