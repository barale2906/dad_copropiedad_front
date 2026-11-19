import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { LineaLibros, MovimientoExtracto } from '@/api/tipos'
import MapeoColumnas from '@/hud/componentes/MapeoColumnas.vue'
import ConciliadorDosColumnas from '@/modulos/tesoreria/componentes/ConciliadorDosColumnas.vue'

const CAMPOS = [
  { clave: 'fecha', etiqueta: 'Fecha', obligatorio: true },
  { clave: 'valor', etiqueta: 'Valor' },
]

describe('MapeoColumnas', () => {
  it('con encabezados elige de una lista y avisa columnas repetidas', async () => {
    const w = mount(MapeoColumnas, { props: { modelValue: {}, campos: CAMPOS, columnas: ['Fecha', 'Monto'], 'onUpdate:modelValue': (v: Record<string, string>) => w.setProps({ modelValue: v }) } })
    const selects = w.findAll('select')
    expect(selects).toHaveLength(2)
    expect(w.text()).toContain('Valor (opcional)')
    await selects[0]!.setValue('Fecha')
    expect(w.props('modelValue')).toEqual({ fecha: 'Fecha' })
    await selects[1]!.setValue('Fecha')
    expect(w.get('[role="status"]').text()).toContain('«Fecha» está elegida para más de un campo')
  })

  it('sin encabezados pide escribir el nombre de la columna', async () => {
    const w = mount(MapeoColumnas, { props: { modelValue: { fecha: 'F' }, campos: CAMPOS, 'onUpdate:modelValue': (v: Record<string, string>) => w.setProps({ modelValue: v }) } })
    const campos = w.findAll('input')
    expect(campos).toHaveLength(2)
    expect((campos[0]!.element as HTMLInputElement).value).toBe('F')
    await campos[1]!.setValue('Valor COP')
    expect(w.props('modelValue')).toEqual({ fecha: 'F', valor: 'Valor COP' })
  })
})

describe('ConciliadorDosColumnas', () => {
  const mov = (id: string, valor: string): MovimientoExtracto => ({ id, extracto_id: 'e', orden: 1, fecha: '2026-11-10', descripcion: `Mov ${id}`, valor, estado: 'pendiente' })
  const lin = (c: string, valor: string): LineaLibros => ({ comprobante_id: c, orden: 1, tipo: 'RC', numero: 1, fecha: '2026-11-10', descripcion: `Lib ${c}`, valor })

  it('marca con el teclado, muestra la diferencia y concilia solo si cuadra', async () => {
    const w = mount(ConciliadorDosColumnas, { props: { movimientos: [mov('m1', '100'), mov('m2', '50')], lineas: [lin('c1', '150'), lin('c2', '-10')] } })
    const [ext, lib] = w.findAll('[role="listbox"]')
    expect(w.get('[role="status"]').text()).toBe('Marque partidas de las dos columnas')
    await ext!.trigger('keydown', { key: ' ' })
    await ext!.trigger('keydown', { key: 'ArrowDown' })
    await ext!.trigger('keydown', { key: 'Enter' })
    expect(ext!.findAll('[aria-selected="true"]')).toHaveLength(2)
    expect(ext!.attributes('aria-activedescendant')).toMatch(/-m-1$/)
    await lib!.trigger('keydown', { key: 'End' })
    await lib!.trigger('keydown', { key: ' ' })
    expect(w.get('[role="status"]').text()).toBe('Diferencia $ 160,00')
    const boton = w.findAll('button').find((b) => b.text() === 'Conciliar lo marcado')!
    expect(boton.attributes('disabled')).toBeDefined()
    await lib!.trigger('keydown', { key: ' ' })
    await lib!.trigger('keydown', { key: 'Home' })
    await lib!.trigger('keydown', { key: ' ' })
    expect(w.get('[role="status"]').text()).toBe('Suman lo mismo: puede conciliar')
    await boton.trigger('click')
    expect(w.emitted('conciliar')?.[0]).toEqual([['m1', 'm2'], [{ comprobante_id: 'c1', orden: 1 }]])
    expect(w.findAll('[aria-selected="true"]')).toHaveLength(0)
  })

  it('sobre el movimiento activo ofrece partida conciliatoria y recibo (solo créditos)', async () => {
    const w = mount(ConciliadorDosColumnas, { props: { movimientos: [mov('m1', '75000'), mov('m2', '-20')], lineas: [] } })
    expect(w.text()).toContain('No hay líneas pendientes en libros.')
    await w.findAll('button').find((b) => b.text().startsWith('Crear recibo'))!.trigger('click')
    expect(w.emitted('recibo')?.[0]?.[0]).toMatchObject({ id: 'm1' })
    await w.findAll('[role="listbox"]')[0]!.trigger('keydown', { key: 'ArrowDown' })
    expect(w.findAll('button').some((b) => b.text().startsWith('Crear recibo'))).toBe(false)
    await w.findAll('button').find((b) => b.text().startsWith('Marcar como partida'))!.trigger('click')
    expect(w.emitted('partida')?.[0]).toEqual([expect.objectContaining({ id: 'm2' }), true])
  })
})
