import { describe, expect, it } from 'vitest'
import type { EstadoEntidad } from '@/api/tipos'
import { avisoDeEstado, ESTADO_ENTIDAD } from '@/formato/textos-entidad'

describe('textos de la entidad', () => {
  it('una entidad activa no lleva aviso', () => {
    expect(avisoDeEstado('activa')).toBeNull()
  })

  it('toda entidad no activa lleva un aviso propio', () => {
    const estados: EstadoEntidad[] = ['en_configuracion', 'suspendida', 'retirada']
    const avisos = estados.map(avisoDeEstado)
    for (const a of avisos) expect(a).toMatch(/\.$/)
    expect(new Set(avisos).size).toBe(estados.length)
  })

  it('la suspendida dice qué hacer', () => {
    expect(avisoDeEstado('suspendida')).toContain('Comuníquese con DAD')
  })

  it('todo estado tiene su nombre', () => {
    expect(ESTADO_ENTIDAD.en_configuracion).toBe('En configuración')
  })
})
