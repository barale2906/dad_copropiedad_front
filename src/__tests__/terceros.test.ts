import { beforeEach, describe, expect, it } from 'vitest'
import { limpiar } from '@/api/tokens'
import { useSesion } from '@/stores/sesion'
import { useTercerosConocidos } from '@/stores/terceros'
import { conRespuesta, prepararConDemo } from './ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const tercero = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const PEDRO = tercero(5002)
const VIGILANCIA = tercero(5501)

describe('useTercerosConocidos', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('admin', 'x')
  })

  it('recuerda los vistos en la sesión y usa el texto por defecto para los demás', () => {
    const t = useTercerosConocidos()
    t.recordar([{ id: 'a', nombre: 'Ana' }, { id: 'b', nombre: '' }])
    expect(t.nombre('a')).toBe('Ana')
    expect(t.nombre('b')).toBe('Tercero')
    expect(t.nombre('c', 'Persona')).toBe('Persona')
    expect(t.nombre(null)).toBe('—')
  })

  it('resuelve en paralelo los que faltan, una sola vez por tercero', async () => {
    let pedidos = 0
    conRespuesta('GET', /\/terceros\/[^/]+$/, () => {
      pedidos++
      return Response.json({ persona_id: VIGILANCIA, tipo: 'juridica', nombre: 'Vigilancia Andina S.A.S.', fiscal: { responsabilidades: [] } })
    })
    const t = useTercerosConocidos()
    await t.resolver(PH, [VIGILANCIA, VIGILANCIA, null, undefined])
    await t.resolver(PH, [VIGILANCIA])
    expect(t.nombre(VIGILANCIA)).toBe('Vigilancia Andina S.A.S.')
    expect(pedidos).toBe(1)
  })

  it('con el backend simulado trae el nombre; si no existe no lo vuelve a pedir', async () => {
    const t = useTercerosConocidos()
    await Promise.all([t.resolver(PH, [PEDRO, 'no-existe']), t.resolver(PH, [PEDRO])])
    expect(t.nombre(PEDRO)).toBe('Pedro Pérez')
    expect(t.nombre('no-existe')).toBe('Tercero')
    let pedidos = 0
    conRespuesta('GET', /\/terceros\/[^/]+$/, () => {
      pedidos++
      return new Response(null, { status: 404 })
    })
    await t.resolver(PH, ['no-existe'])
    expect(pedidos).toBe(0)
  })

  it('no pide los ya conocidos y olvida lo de otra entidad al cambiar', async () => {
    const t = useTercerosConocidos()
    t.recordar([{ id: PEDRO, nombre: 'Pedro (buscado)' }])
    await t.resolver(PH, [PEDRO])
    expect(t.nombre(PEDRO)).toBe('Pedro (buscado)')
    await t.resolver('otra-entidad', [])
    expect(t.nombre(PEDRO)).toBe('Tercero')
  })
})
