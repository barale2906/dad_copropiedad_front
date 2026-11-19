import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Tercero } from '@/api/tipos'
import FormularioTercero from '@/hud/componentes/FormularioTercero.vue'
import SelectorTercero from '@/hud/componentes/SelectorTercero.vue'

describe('FormularioTercero', () => {
  it('crea con el dígito de verificación a la vista y valida los datos', async () => {
    const w = mount(FormularioTercero, { props: { nombreInicial: 'Jardines' } })
    const documento = w.findAll('input').find((i) => i.element.closest('.hud-campo')?.textContent?.includes('Documento'))!
    await documento.setValue('800197268')
    expect(w.text()).toContain('Dígito de verificación: 4.')
    const correo = w.get('input[type="email"]')
    await correo.setValue('mal')
    await w.get('form').trigger('submit')
    expect(w.get('[role="alert"]').text()).toBe('Revise el correo de facturación.')
    await correo.setValue('fe@jardines.co')
    await w.findAll('input[type="checkbox"]')[0]!.setValue(true)
    await w.get('form').trigger('submit')
    expect(w.emitted('crear')?.[0]?.[0]).toMatchObject({
      tipo: 'juridica', nombre: 'Jardines', tipo_documento: 'NIT', documento: '800197268', fiscal: { responsabilidades: ['O-13'], correo_facturacion: 'fe@jardines.co' },
    })
  })

  it('con un tercero solo edita los datos fiscales', async () => {
    const tercero = { persona_id: 'p', tipo: 'natural', nombre: 'Ana', tipo_documento: 'CC', documento: '1', fiscal: { regimen_iva: 'no_responsable', responsabilidades: [] } } as Tercero
    const w = mount(FormularioTercero, { props: { tercero } })
    expect(w.text()).not.toContain('Tipo de persona')
    await w.get('form').trigger('submit')
    expect(w.emitted('fiscal')?.[0]?.[0]).toMatchObject({ regimen_iva: 'no_responsable' })
  })
})

describe('SelectorTercero', () => {
  it('ofrece crear el tercero en línea y lo deja elegido', async () => {
    const crear = async () => ({ id: 'n', nombre: 'Nuevo S.A.S.', detalle: 'NIT 1' })
    const w = mount(SelectorTercero, {
      props: { modelValue: null, buscar: async () => [], crear, etiqueta: 'Proveedor', 'onUpdate:modelValue': (v: unknown) => w.setProps({ modelValue: v as null }) },
      attachTo: document.body,
    })
    await w.findAll('button').find((b) => b.text() === '¿No aparece? Crear proveedor')!.trigger('click')
    const formulario = document.body.querySelector('dialog form') as HTMLFormElement
    expect(formulario).not.toBeNull()
    const entradas = [...formulario.querySelectorAll('input:not([type="checkbox"])')] as HTMLInputElement[]
    entradas[0]!.value = '900111222'
    entradas[0]!.dispatchEvent(new Event('input'))
    entradas[1]!.value = 'Nuevo S.A.S.'
    entradas[1]!.dispatchEvent(new Event('input'))
    formulario.dispatchEvent(new Event('submit'))
    await flushPromises()
    expect(w.props('modelValue')).toEqual({ id: 'n', nombre: 'Nuevo S.A.S.', detalle: 'NIT 1' })
    expect(w.text()).toContain('Nuevo S.A.S.')
    w.unmount()
  })

  it('sin `crear` no ofrece crear', () => {
    const w = mount(SelectorTercero, { props: { modelValue: null, buscar: async () => [] } })
    expect(w.findAll('button').some((b) => b.text().startsWith('¿No aparece?'))).toBe(false)
  })
})
