import { describe, expect, it } from 'vitest'
import type { Modulo, Permiso } from '@/api/tipos'
import { estadoDeSecciones, estadoSeccion, SECCIONES } from '@/escena/mapa-modulos'
import { seccionesDe, ZONAS } from '@/escena/plantillas/zonas'

const consulta = (modulos: Modulo[], permisos: Permiso[]) => ({
  tieneModulo: (m: Modulo) => modulos.includes(m),
  tienePermiso: (p: Permiso) => permisos.includes(p),
})

describe('mapa de módulos', () => {
  it('toda zona apunta a secciones existentes', () => {
    for (const zonas of Object.values(ZONAS)) {
      for (const z of zonas) for (const s of z.secciones) expect(SECCIONES[s], `${z.id}→${s}`).toBeDefined()
    }
  })

  it('la oficina no muestra secciones exclusivas de la PH', () => {
    for (const s of seccionesDe('oficina')) expect(SECCIONES[s]!.soloPH).toBeFalsy()
  })

  it('sección sin módulo contratado queda apagada aunque haya permisos', () => {
    const c = consulta([], ['reservas.crear'])
    expect(estadoSeccion(SECCIONES['zonas-comunes']!, c)).toBe('no_contratada')
  })

  it('módulo contratado sin permisos → sin acceso', () => {
    const c = consulta(['bienes_comunes'], [])
    expect(estadoSeccion(SECCIONES['zonas-comunes']!, c)).toBe('sin_acceso')
  })

  it('una zona está activa si alguna de sus secciones lo está', () => {
    const c = consulta(['asambleas'], ['asambleas.ver'])
    // Salón social: zonas comunes (no contratada) + asambleas (activa).
    expect(estadoDeSecciones(['zonas-comunes', 'asambleas'], c)).toBe('activa')
    expect(estadoDeSecciones(['zonas-comunes'], c)).toBe('no_contratada')
  })

  it('las secciones próximas siempre están apagadas', () => {
    expect(estadoSeccion(SECCIONES.nomina!, consulta([], []))).toBe('proximamente')
  })
})
