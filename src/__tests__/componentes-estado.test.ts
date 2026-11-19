import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import ConfirmarConMotivo from '@/hud/componentes/ConfirmarConMotivo.vue'
import HudCampoMonto from '@/hud/componentes/HudCampoMonto.vue'
import HudDialogo from '@/hud/componentes/HudDialogo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudMonto from '@/hud/componentes/HudMonto.vue'

describe('HudEstado', () => {
  it('cargando se anuncia y dibuja el esqueleto', () => {
    const w = mount(HudEstado, { props: { estado: 'cargando', filas: 2 } })
    expect(w.attributes('role')).toBe('status')
    expect(w.findAll('.esqueleto')).toHaveLength(2)
  })

  it('vacío muestra el mensaje y la acción del slot', () => {
    const w = mount(HudEstado, {
      props: { estado: 'vacio', mensaje: 'Sin reservas.' },
      slots: { default: '<button>Crear</button>' },
    })
    expect(w.text()).toContain('Sin reservas.')
    expect(w.find('button').text()).toBe('Crear')
  })

  it('error muestra la referencia copiable y permite reintentar', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const w = mount(HudEstado, { props: { estado: 'error', mensaje: 'Falló.', referencia: 'req-9' } })
    expect(w.attributes('role')).toBe('alert')
    await w.get('.copiar').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('req-9')
    expect(w.get('.copiar').text()).toBe('Copiada')
    await w.findAll('button').at(-1)!.trigger('click')
    expect(w.emitted('reintentar')).toHaveLength(1)
  })
})

describe('HudDialogo', () => {
  it('se abre y cierra con el modelo, y Escape (close) lo sincroniza', async () => {
    const w = mount(HudDialogo, {
      props: { titulo: 'Título', abierto: false, 'onUpdate:abierto': (v: boolean) => w.setProps({ abierto: v }) },
      slots: { default: 'Contenido' },
      attachTo: document.body,
    })
    const dialogo = w.get('dialog').element as HTMLDialogElement
    await w.setProps({ abierto: true })
    await nextTick()
    expect(dialogo.open).toBe(true)
    expect(w.get('h2').text()).toBe('Título')
    dialogo.close()
    await nextTick()
    expect(w.props('abierto')).toBe(false)
    w.unmount()
  })
})

describe('ConfirmarConMotivo', () => {
  it('exige el motivo y lo emite recortado', async () => {
    const w = mount(ConfirmarConMotivo, {
      props: { titulo: 'Anular', accion: 'Anular factura', abierto: true },
      attachTo: document.body,
    })
    await w.get('form').trigger('submit')
    expect(w.emitted('confirmar')).toBeUndefined()
    expect(w.text()).toContain('Escriba el motivo')
    await w.get('textarea').setValue('  Error de digitación  ')
    await w.get('form').trigger('submit')
    expect(w.emitted('confirmar')).toEqual([['Error de digitación']])
    w.unmount()
  })

  it('dos confirmaciones en la misma pantalla: cada botón apunta a su propio formulario', () => {
    const props = { titulo: 'A', accion: 'Confirmar', abierto: true }
    // Las dos en la misma app, como en una vista (anular y nota crédito en el detalle de una factura).
    const w = mount(defineComponent({ render: () => [h(ConfirmarConMotivo, props), h(ConfirmarConMotivo, { ...props, titulo: 'B' })] }), { attachTo: document.body })
    const formularios = w.findAll('form').map((f) => f.attributes('id'))
    const botones = w.findAll('button[type="submit"]').map((b) => b.attributes('form'))
    expect(formularios).toHaveLength(2)
    expect(formularios[0]).toBeTruthy()
    expect(formularios[0]).not.toBe(formularios[1])
    expect(botones).toEqual(formularios)
    w.unmount()
  })
})

describe('montos', () => {
  it('HudMonto formatea y resalta los negativos', () => {
    expect(mount(HudMonto, { props: { valor: '1500' } }).text()).toBe('$ 1.500,00')
    expect(mount(HudMonto, { props: { valor: '-2' } }).classes()).toContain('negativo')
  })

  it('HudCampoMonto entrega texto decimal y avisa lo inválido', async () => {
    const w = mount(HudCampoMonto, {
      props: { etiqueta: 'Valor', modelValue: '', 'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v }) },
    })
    await w.get('input').setValue('1.234,5')
    expect(w.props('modelValue')).toBe('1234.5')
    await w.get('input').trigger('blur')
    expect((w.get('input').element as HTMLInputElement).value).toBe('$ 1.234,50')
    await w.get('input').setValue('doce')
    expect(w.props('modelValue')).toBe('')
    expect(w.text()).toContain('Escriba un monto válido')
  })
})
