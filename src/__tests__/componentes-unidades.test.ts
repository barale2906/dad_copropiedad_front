import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SelectorBien from '@/hud/componentes/SelectorBien.vue'
import TablaErroresImportacion from '@/hud/componentes/TablaErroresImportacion.vue'
import EditorCoeficientes from '@/modulos/unidades/componentes/EditorCoeficientes.vue'

describe('EditorCoeficientes', () => {
  const bienes = Array.from({ length: 60 }, (_, i) => ({ id: `b${i}`, codigo: `T1-${String(i + 1).padStart(3, '0')}` }))
  const todos = (v: string) => Object.fromEntries(bienes.map((b) => [b.id, v]))

  function montar(valores: Record<string, string>, extra: Record<string, unknown> = {}) {
    return mount(EditorCoeficientes, { props: { bienes, modelValue: valores, porPagina: 25, ...extra } })
  }

  it('muestra la suma y la diferencia en vivo', async () => {
    const w = montar({ ...todos('0.016'), b0: '0.056' })
    expect(w.text()).toContain('Suma: 1')
    expect(w.text()).toContain('Suma exactamente 1')
    await w.setProps({ modelValue: todos('0.016') })
    expect(w.text()).toContain('Falta 0,04')
  })

  it('emite el cambio con punto decimal y marca los inválidos', async () => {
    const w = montar(todos('0.016'))
    await w.get('input[aria-label="Coeficiente de T1-001"]').setValue('0,02')
    expect(w.emitted<[Record<string, string>]>('update:modelValue')![0]![0].b0).toBe('0.02')
    await w.setProps({ modelValue: { ...todos('0.016'), b1: 'x' } })
    expect(w.get('input[aria-label="Coeficiente de T1-002"]').attributes('aria-invalid')).toBe('true')
    expect(w.text()).toContain('1 valores inválidos')
  })

  it('pagina y busca en el cliente', async () => {
    const w = montar(todos('0.016'))
    expect(w.findAll('tbody tr')).toHaveLength(25)
    expect(w.text()).toContain('Página 1 de 3')
    await w.findAll('button').find((b) => b.text() === 'Siguiente')!.trigger('click')
    expect(w.text()).toContain('T1-026')
    await w.get('input[type="search"]').setValue('T1-05')
    expect(w.findAll('tbody tr')).toHaveLength(10)
    expect(w.text()).not.toContain('Página')
  })

  it('en solo lectura no hay campos; resalta los faltantes', () => {
    const w = montar({ b0: '0.5' }, { soloLectura: true, faltantes: ['b1'] })
    expect(w.findAll('tbody input')).toHaveLength(0)
    expect(w.findAll('tbody tr')[1]!.classes()).toContain('falta')
  })
})

describe('TablaErroresImportacion', () => {
  it('ordena por fila y muestra la columna solo si alguna la trae', () => {
    const w = mount(TablaErroresImportacion, { props: { errores: [{ fila: 5, mensaje: 'B' }, { fila: 2, mensaje: 'A' }] } })
    expect(w.findAll('tbody th').map((x) => x.text())).toEqual(['2', '5'])
    expect(w.text()).not.toContain('Columna')
    const c = mount(TablaErroresImportacion, { props: { errores: [{ fila: 2, mensaje: 'A', columna: 'tipo' }], titulo: 'Errores' } })
    expect(c.text()).toContain('Columna')
    expect(c.text()).toContain('tipo')
    expect(c.get('h3').text()).toBe('Errores')
  })
})

describe('SelectorBien', () => {
  const propios = [
    { id: 'a', codigo: 'T1-101' },
    { id: 'b', codigo: 'T1-102' },
  ]

  it('con varios propios ofrece una lista; con uno lo muestra', async () => {
    const w = mount(SelectorBien, { props: { modelValue: '', propios } })
    expect(w.findAll('option')).toHaveLength(3)
    const uno = mount(SelectorBien, { props: { modelValue: 'a', propios: [propios[0]!] } })
    expect(uno.text()).toContain('Bien: T1-101')
  })

  it('busca con retardo, descarta respuestas viejas y emite el elegido', async () => {
    vi.useFakeTimers()
    const buscar = vi.fn(async (q: string) => [{ id: 'x', codigo: `R-${q}` }])
    const w = mount(SelectorBien, { props: { modelValue: '', buscar } })
    await w.get('input').setValue('t1')
    await w.get('input').setValue('t2')
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(buscar).toHaveBeenCalledTimes(1)
    expect(buscar).toHaveBeenCalledWith('t2')
    await w.get('ul button').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['x']])
    expect(w.emitted('elegido')).toEqual([[{ id: 'x', codigo: 'R-t2' }]])
    vi.useRealTimers()
  })

  it('avisa si nada coincide o si la búsqueda falla, y sin bienes muestra el texto', async () => {
    vi.useFakeTimers()
    const w = mount(SelectorBien, { props: { modelValue: '', buscar: async () => [] } })
    await w.get('input').setValue('zz')
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(w.text()).toContain('Ningún bien coincide.')
    const f = mount(SelectorBien, { props: { modelValue: '', buscar: () => Promise.reject(new Error('x')) } })
    await f.get('input').setValue('zz')
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(f.text()).toContain('No se pudo buscar')
    vi.useRealTimers()
    expect(mount(SelectorBien, { props: { modelValue: '', sinBienes: 'Sin bienes' } }).text()).toContain('Sin bienes')
  })
})
