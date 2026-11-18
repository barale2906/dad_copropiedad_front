import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CuentaContable } from '@/api/tipos'
import SelectorCuenta from '@/hud/componentes/SelectorCuenta.vue'
import EditorComprobante from '@/modulos/contabilidad/componentes/EditorComprobante.vue'
import { comprobanteVacio } from '@/modulos/contabilidad/reglas'

const OPCIONES = [
  { codigo: '110505', nombre: 'Caja general' },
  { codigo: '111005', nombre: 'Bancos moneda nacional' },
  { codigo: '513530', nombre: 'Energía eléctrica' },
]

describe('SelectorCuenta', () => {
  it('filtra por código o nombre (sin tildes) y elige con el teclado', async () => {
    const w = mount(SelectorCuenta, { props: { modelValue: '', opciones: OPCIONES, 'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v }) } })
    const input = w.get('input[role="combobox"]')
    await input.trigger('focus')
    expect(input.attributes('aria-expanded')).toBe('true')
    await input.setValue('energia')
    expect(w.findAll('[role="option"]').map((o) => o.text())).toEqual(['513530 Energía eléctrica'])
    await input.setValue('11')
    expect(w.findAll('[role="option"]')).toHaveLength(2)
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(input.attributes('aria-activedescendant')).toMatch(/-1$/)
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('elegido')?.[0]).toEqual(['111005'])
    expect(w.props('modelValue')).toBe('111005')
    expect((input.element as HTMLInputElement).value).toBe('111005 · Bancos moneda nacional')
  })

  it('F2 abre la lista, Escape la cierra y al salir acepta un código exacto', async () => {
    const w = mount(SelectorCuenta, { props: { modelValue: '', opciones: OPCIONES, etiqueta: 'Cuenta 1', etiquetaOculta: true, 'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v }) } })
    expect(w.get('label').classes()).toContain('solo-lector')
    const input = w.get('input')
    await input.trigger('keydown', { key: 'F2' })
    expect(input.attributes('aria-expanded')).toBe('true')
    await input.trigger('keydown', { key: 'Escape' })
    expect(input.attributes('aria-expanded')).toBe('false')
    await input.setValue('9999')
    expect(w.text()).toContain('Ninguna cuenta coincide.')
    await input.trigger('blur')
    expect(w.props('modelValue')).toBe('')
    await input.setValue('110505')
    await input.trigger('blur')
    expect(w.props('modelValue')).toBe('110505')
  })
})

describe('EditorComprobante', () => {
  beforeEach(() => setActivePinia(createPinia()))
  const cuenta = (codigo: string): CuentaContable => ({
    id: codigo, codigo, nombre: `Cuenta ${codigo}`, naturaleza: 'debito', nivel: 'subcuenta', acepta_movimiento: true, exige_tercero: false, exige_centro_costo: false, activa: true,
  })
  const montar = () => {
    const modelo = comprobanteVacio('2026-11-18', 'CC')
    modelo.descripcion = 'Prueba'
    modelo.lineas[0]!.cuenta = '110505'
    modelo.lineas[0]!.debito = '1500.50'
    modelo.lineas[1]!.cuenta = '513530'
    const w = mount(EditorComprobante, {
      props: {
        modelValue: modelo, 'onUpdate:modelValue': (v: typeof modelo) => w.setProps({ modelValue: v }), entidadId: 'e', tipos: [{ id: 't', codigo: 'CC', nombre: 'Contabilidad', manual: true, activo: true }],
        cuentas: [cuenta('110505'), cuenta('513530')], centros: [],
      },
      attachTo: document.body,
    })
    const actual = () => w.props('modelValue') as typeof modelo
    return { w, actual }
  }

  it('muestra totales y diferencia en vivo y cuadra con «=»', async () => {
    const { w, actual } = montar()
    expect(w.get('[aria-label="Totales del comprobante"]').text()).toContain('Faltan $ 1.500,50 en créditos')
    const credito = w.get('[data-linea="1"] [data-campo="credito"] input')
    await credito.trigger('focusin')
    await credito.trigger('keydown', { key: '=' })
    expect(actual().lineas[1]?.credito).toBe('1500.5')
    expect(w.get('[role="status"]').text()).toBe('Cuadra')
    expect(w.find('[aria-label="Pendientes del comprobante"]').exists()).toBe(false)
    w.unmount()
  })

  it('atajos: nueva línea, duplicar, quitar, guardar, previsualizar y contabilizar', async () => {
    const { w, actual } = montar()
    const raiz = w.get('.editor')
    const primera = w.get('[data-linea="0"] [data-campo="debito"] input')
    await primera.trigger('focusin')
    await raiz.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(actual().lineas).toHaveLength(3)
    await w.get('[data-linea="0"] [data-campo="debito"] input').trigger('focusin')
    await raiz.trigger('keydown', { key: 'd', ctrlKey: true })
    expect(actual().lineas.map((l) => l.cuenta)).toEqual(['110505', '110505', '', '513530'])
    await w.get('[data-linea="2"] [data-campo="debito"] input').trigger('focusin')
    await raiz.trigger('keydown', { key: 'Delete', ctrlKey: true })
    expect(actual().lineas).toHaveLength(3)
    await raiz.trigger('keydown', { key: 's', ctrlKey: true })
    await raiz.trigger('keydown', { key: 'p', altKey: true })
    await raiz.trigger('keydown', { key: 'Enter', ctrlKey: true, shiftKey: true })
    expect(w.emitted('guardar')).toHaveLength(1)
    expect(w.emitted('previsualizar')).toHaveLength(1)
    expect(w.emitted('contabilizar')).toHaveLength(1)
    expect(w.get('[aria-label="Pendientes del comprobante"]').text()).toContain('no suman lo mismo')
    await raiz.trigger('keydown', { key: '?' })
    expect(document.body.textContent).toContain('Atajos de teclado')
    w.unmount()
  })
})
