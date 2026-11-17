import { describe, expect, it } from 'vitest'
import type { ArbolAgrupaciones, BienPrivado } from '@/api/tipos'
import { aplanarArbol, opcionesAgrupacion } from '@/modulos/unidades/bienes'
import { camposDePropuesta, normalizarPlaca } from '@/modulos/unidades/censo'
import { coeficienteValido, revisar, textoDiferencia } from '@/modulos/unidades/coeficientes'
import { sumasPorClase, validarTitulares } from '@/modulos/unidades/titulares'

describe('coeficientes', () => {
  it('suma en texto decimal y da la diferencia frente a 1', () => {
    const r = revisar(['0.1', '0.2', '0.7'])
    expect(r).toEqual({ suma: '1', diferencia: '0', valido: true, invalidas: [] })
    const r2 = revisar(['0.1', '0.2', '0.6999'])
    expect(r2.valido).toBe(false)
    expect(r2.diferencia).toBe('0.0001')
  })

  it('marca las filas inválidas y no las suma', () => {
    const r = revisar(['0.5', 'abc', '1.5', '', '0.5'])
    expect(r.invalidas).toEqual([1, 2, 3])
    expect(r.suma).toBe('1')
    expect(r.valido).toBe(false)
    expect(coeficienteValido(' 0.025 ')).toBe(true)
    expect(coeficienteValido('-0.1')).toBe(false)
  })

  it('describe si falta, sobra o suma exactamente 1', () => {
    expect(textoDiferencia('0')).toBe('Suma exactamente 1')
    expect(textoDiferencia('0.0001')).toBe('Falta 0,0001')
    expect(textoDiferencia('-0.0002')).toBe('Sobra 0,0002')
  })
})

describe('titulares', () => {
  const t = (tipo: 'propietario' | 'nudo_propietario' | 'usufructuario', porcentaje: string, es_representante = false) => ({ tipo, porcentaje, es_representante })

  it('suma por clase de derecho', () => {
    expect(sumasPorClase([t('propietario', '50'), t('propietario', '50,5'), t('usufructuario', '100')])).toEqual({
      'propiedad plena': '100.5',
      usufructo: '100',
    })
  })

  it('exige 100 % por clase y un solo representante', () => {
    expect(validarTitulares([t('propietario', '60', true), t('propietario', '40')])).toEqual([])
    expect(validarTitulares([t('nudo_propietario', '100', true), t('usufructuario', '100')])).toEqual([])
    expect(validarTitulares([t('propietario', '60', true), t('propietario', '30')])[0]).toContain('suman 90 %')
    expect(validarTitulares([t('propietario', '100')])).toEqual(['Marque exactamente un representante del bien.'])
    expect(validarTitulares([t('propietario', '0', true)]).join(' ')).toContain('entre 0 y 100')
    expect(validarTitulares([])).toEqual(['Agregue al menos un titular.'])
  })
})

describe('censo', () => {
  it('normaliza la placa', () => {
    expect(normalizarPlaca(' abc-12d ')).toBe('ABC12D')
  })

  it('muestra los datos de una propuesta con nombres legibles, sin ids', () => {
    expect(
      camposDePropuesta({ calidad: 'tenedor', es_responsable: true, persona_id: 'x', persona: { nombre: 'Ana', documento: '1', correo: null } }),
    ).toEqual([
      { campo: 'Calidad', valor: 'Arrendatario o tenedor' },
      { campo: 'Responsable del bien', valor: 'Sí' },
      { campo: 'Nombre', valor: 'Ana' },
      { campo: 'Documento', valor: '1' },
      { campo: 'Correo', valor: '—' },
    ])
    expect(camposDePropuesta({ placa: 'XYZ', otro_campo: 3, lista: [1] })).toEqual([
      { campo: 'Placa', valor: 'XYZ' },
      { campo: 'otro_campo', valor: '3' },
      { campo: 'lista', valor: '…' },
    ])
  })
})

describe('árbol de agrupaciones', () => {
  const b = (codigo: string) => ({ id: codigo, codigo }) as BienPrivado
  const nodo = (id: string, nombre: string, orden: number, bienes: BienPrivado[], hijas: ArbolAgrupaciones['agrupaciones'] = []) => ({
    agrupacion: { id, tipo: 'edificio' as const, nombre, codigo: id, orden },
    bienes_privados: bienes,
    hijas,
  })
  const arbol: ArbolAgrupaciones = {
    agrupaciones: [nodo('e2', 'Etapa 2', 2, []), nodo('e1', 'Etapa 1', 1, [], [nodo('t1', 'Torre 1', 1, [b('T1-101')], [nodo('i1', 'Interior A', 1, [b('A-1')])])])],
    sin_agrupacion: [b('L-1')],
  }

  it('aplana en orden con la ruta y deja lo suelto al final', () => {
    expect(aplanarArbol(arbol).map((g) => [g.ruta, g.nivel, g.bienes.length])).toEqual([
      ['Etapa 1', 0, 0],
      ['Etapa 1 › Torre 1', 1, 1],
      ['Etapa 1 › Torre 1 › Interior A', 2, 1],
      ['Etapa 2', 0, 0],
      ['Sin agrupación', 0, 1],
    ])
  })

  it('las opciones de padre excluyen el tercer nivel', () => {
    expect(opcionesAgrupacion(arbol).length).toBe(4)
    expect(opcionesAgrupacion(arbol, true).map((o) => o.etiqueta)).toEqual(['Etapa 1', 'Etapa 1 › Torre 1', 'Etapa 2'])
  })
})
