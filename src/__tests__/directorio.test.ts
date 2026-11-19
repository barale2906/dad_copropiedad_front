import { describe, expect, it } from 'vitest'
import { enlacePublico } from '@/api/enlaces'
import type { CategoriaDirectorio } from '@/api/tipos'
import { numero } from '@/formato/decimales'
import {
  calificacionLegible,
  distanciaLegible,
  enlaceCorreo,
  enlaceSeguro,
  enlaceTelefono,
  enlaceWhatsapp,
} from '@/formato/directorio'
import { acumular, categoriaPrincipal, opcionesCategorias, type Pendientes, tomarLote } from '@/modulos/directorio/reglas'

const cat = (codigo: string, nombre: string, padre: string | null = null, extra: Partial<CategoriaDirectorio> = {}): CategoriaDirectorio => ({
  codigo, nombre, padre, sinonimos: [], restringida: false, activa: true, ...extra,
})

describe('enlaces de contacto', () => {
  it('arma tel: y wa.me solo con números válidos', () => {
    expect(enlaceTelefono('+57 (300) 123-4567')).toBe('tel:+573001234567')
    expect(enlaceTelefono('llame ya')).toBeNull()
    expect(enlaceTelefono(null)).toBeNull()
    expect(enlaceWhatsapp('573001234567')).toBe('https://wa.me/573001234567')
    expect(enlaceWhatsapp('573001234567', 'Busco costurera')).toBe('https://wa.me/573001234567?text=Busco%20costurera')
    expect(enlaceWhatsapp('12')).toBeNull()
  })

  it('el correo debe parecer un correo', () => {
    expect(enlaceCorreo('ventas@rosa.co')).toBe('mailto:ventas@rosa.co')
    expect(enlaceCorreo('no es correo')).toBeNull()
    expect(enlaceCorreo(undefined)).toBeNull()
  })

  it('el sitio web solo se enlaza con http o https', () => {
    expect(enlaceSeguro('https://rosa.co')).toBe('https://rosa.co/')
    expect(enlaceSeguro('http://rosa.co/a?b=1')).toBe('http://rosa.co/a?b=1')
    expect(enlaceSeguro('javascript:alert(1)')).toBeNull()
    expect(enlaceSeguro('rosa.co')).toBeNull()
    expect(enlaceSeguro(null)).toBeNull()
  })
})

describe('textos del directorio', () => {
  it('distancia en metros bajo 1 km y en km con un decimal', () => {
    expect(distanciaLegible('0.35')).toBe('a 350 m')
    expect(distanciaLegible('1.24')).toBe('a 1,2 km')
    expect(distanciaLegible('12')).toBe('a 12,0 km')
    expect(distanciaLegible(null)).toBeNull()
    expect(distanciaLegible('lejos')).toBeNull()
  })

  it('calificación y números con coma decimal', () => {
    expect(calificacionLegible('4.5')).toBe('4,5')
    expect(calificacionLegible('5')).toBe('5,0')
    expect(numero('1250.4', 0)).toBe('1.250')
    expect(numero('0.5', 1)).toBe('0,5')
  })
})

describe('enlacePublico', () => {
  it('pone el token en el fragmento y escapa los datos', () => {
    expect(enlacePublico('directorio', 'abc', 'tok-1', 'https://web.dad.co/')).toBe('https://web.dad.co/directorio/abc#t=tok-1')
    expect(enlacePublico('papeleta', 'a/b', 't k', 'https://web.dad.co')).toBe('https://web.dad.co/papeleta/a%2Fb#t=t%20k')
  })

  it('sin origen usa el de la web actual', () => {
    expect(enlacePublico('pantalla', 'x', 'y')).toBe(`${window.location.origin}/pantalla/x#t=y`)
  })
})

describe('categorías', () => {
  const lista = [
    cat('oficios', 'Oficios'),
    cat('costura', 'Costura', 'oficios'),
    cat('carpinteria', 'Carpintería', 'oficios'),
    cat('hogar', 'Hogar'),
    cat('licores', 'Licores', 'hogar', { restringida: true }),
    cat('vieja', 'Vieja', 'hogar', { activa: false }),
    cat('huerfana', 'Huérfana', 'sin-rama'),
  ]

  it('ordena ramas y subcategorías, sin restringidas ni inactivas', () => {
    expect(opcionesCategorias(lista).map((o) => o.etiqueta)).toEqual([
      'Todas las categorías',
      'Hogar',
      'Huérfana',
      'Oficios',
      '— Carpintería',
      '— Costura',
    ])
  })

  it('nombra la categoría principal (o deja el código si no la conoce)', () => {
    expect(categoriaPrincipal(['costura', 'oficios'], lista)).toBe('Costura')
    expect(categoriaPrincipal(['nueva'], lista)).toBe('nueva')
    expect(categoriaPrincipal([], lista)).toBeUndefined()
  })
})

describe('lote de eventos de las piezas', () => {
  it('acumula por pieza, topa en 100 y vacía al tomar', () => {
    const p: Pendientes = new Map()
    acumular(p, 'a', 'impresion')
    acumular(p, 'a', 'clic')
    for (let i = 0; i < 150; i++) acumular(p, 'b', 'impresion')
    expect(tomarLote(p)).toEqual([
      { creativo_id: 'a', impresiones: 1, clics: 1 },
      { creativo_id: 'b', impresiones: 100, clics: 0 },
    ])
    expect(p.size).toBe(0)
    expect(tomarLote(p)).toEqual([])
  })
})
