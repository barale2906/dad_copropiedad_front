import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import type { Archivo, Permiso } from '@/api/tipos'
import { nombreTipo, puedeAbrir, tamanoLegible } from '@/modulos/archivo/archivo'
import { useArchivoSubido } from '@/modulos/archivo/store'

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

describe('archivos subidos en la sesión', () => {
  it('se guardan por entidad, el más reciente primero', () => {
    setActivePinia(createPinia())
    const s = useArchivoSubido()
    const a = (id: string) => ({ id }) as Archivo
    s.agregar('e1', a('1'))
    s.agregar('e1', a('2'))
    s.agregar('e2', a('3'))
    expect(s.de('e1').map((x) => x.id)).toEqual(['2', '1'])
    expect(s.de('e2')).toHaveLength(1)
    expect(s.de('otra')).toEqual([])
  })
})
