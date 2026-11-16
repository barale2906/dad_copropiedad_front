import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import HudCargarMas from '@/hud/componentes/HudCargarMas.vue'
import HudFiltros from '@/hud/componentes/HudFiltros.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudTablaGenerica from '@/hud/componentes/HudTabla.vue'

/** Componente genérico: `mount` no infiere `T`, se monta sin él. */
const HudTabla = HudTablaGenerica as Component

const FILAS = [
  { id: 'a', nombre: 'Salón', valor: '100' },
  { id: 'b', nombre: 'Piscina', valor: null },
]
const COLUMNAS = [
  { clave: 'nombre', titulo: 'Nombre', ordenable: true },
  { clave: 'valor', titulo: 'Valor', alinear: 'fin' as const },
]

describe('HudTabla', () => {
  it('dibuja filas y columnas, con el título de la columna en cada celda (tarjetas en móvil)', () => {
    const w = mount(HudTabla, { props: { filas: FILAS, columnas: COLUMNAS, clave: 'id', titulo: 'Recursos' } })
    expect(w.get('caption').text()).toBe('Recursos')
    expect(w.findAll('tbody tr')).toHaveLength(2)
    const celdas = w.findAll('tbody tr')[1]!.findAll('td')
    expect(celdas[0]!.attributes('data-titulo')).toBe('Nombre')
    expect(celdas[1]!.text()).toBe('—')
  })

  it('usa el slot de la celda', () => {
    const w = mount(HudTabla, {
      props: { filas: FILAS, columnas: COLUMNAS, clave: 'id', titulo: 'Recursos' },
      slots: { 'celda-nombre': '<strong>{{ params.fila.nombre.toUpperCase() }}</strong>' },
    })
    expect(w.get('tbody strong').text()).toBe('SALÓN')
  })

  it('ordena por columna y lo anuncia con aria-sort', async () => {
    const w = mount(HudTabla, {
      props: { filas: FILAS, columnas: COLUMNAS, clave: 'id', titulo: 'R', orden: { clave: 'nombre', direccion: 'desc' } },
    })
    expect(w.get('th[aria-sort]').attributes('aria-sort')).toBe('descending')
    await w.get('th button').trigger('click')
    expect(w.emitted('ordenar')).toEqual([['nombre']])
  })

  it('selecciona filas y todas', async () => {
    const w = mount(HudTabla, {
      props: {
        filas: FILAS,
        columnas: COLUMNAS,
        clave: 'id',
        titulo: 'R',
        seleccionable: true,
        seleccion: [],
        'onUpdate:seleccion': (v: string[]) => w.setProps({ seleccion: v }),
      },
    })
    const marcas = w.findAll('input[type="checkbox"]')
    await marcas[1]!.trigger('change')
    expect(w.props('seleccion')).toEqual(['a'])
    await marcas[0]!.trigger('change')
    expect(w.props('seleccion')).toEqual(['a', 'b'])
    await w.findAll('input[type="checkbox"]')[0]!.trigger('change')
    expect(w.props('seleccion')).toEqual([])
  })
})

describe('HudCargarMas', () => {
  it('solo aparece si hay más y emite al pulsar', async () => {
    expect(mount(HudCargarMas, { props: { hayMas: false } }).find('button').exists()).toBe(false)
    const w = mount(HudCargarMas, { props: { hayMas: true } })
    await w.get('button').trigger('click')
    expect(w.emitted('cargar')).toHaveLength(1)
  })

  it('con infinito carga al ver el final', () => {
    let alVer: (e: { isIntersecting: boolean }[]) => void = () => {}
    const observe = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(f: typeof alVer) {
          alVer = f
        }
        observe = observe
        disconnect() {}
      },
    )
    const w = mount(HudCargarMas, { props: { hayMas: true, infinito: true } })
    expect(observe).toHaveBeenCalled()
    alVer([{ isIntersecting: true }])
    expect(w.emitted('cargar')).toHaveLength(1)
    vi.unstubAllGlobals()
  })
})

describe('HudFiltros', () => {
  it('muestra los filtros aplicados como chips que se pueden quitar', async () => {
    const w = mount(HudFiltros, {
      props: { activos: [{ clave: 'estado', etiqueta: 'Estado: aprobada' }] },
      slots: { default: '<input aria-label="Buscar">' },
    })
    expect(w.get('.alternar').text()).toContain('(1)')
    await w.get('.chip').trigger('click')
    expect(w.emitted('quitar')).toEqual([['estado']])
    await w.get('.limpiar').trigger('click')
    expect(w.emitted('limpiar')).toHaveLength(1)
    await w.get('.alternar').trigger('click')
    expect(w.get('.alternar').attributes('aria-expanded')).toBe('true')
  })
})

describe('HudInsignia', () => {
  it('aplica el tono y conserva el texto', () => {
    const w = mount(HudInsignia, { props: { tono: 'peligro' }, slots: { default: 'Vencida' } })
    expect(w.classes()).toContain('peligro')
    expect(w.text()).toBe('Vencida')
  })
})
