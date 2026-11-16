import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Component } from 'vue'
import HudFecha from '@/hud/componentes/HudFecha.vue'
import HudSelectorGenerico from '@/hud/componentes/HudSelector.vue'

/** Componente genérico: `mount` no infiere `V`, se monta sin él. */
const HudSelector = HudSelectorGenerico as Component

describe('HudSelector', () => {
  it('ofrece las opciones, la vacía y actualiza el modelo', async () => {
    const w = mount(HudSelector, {
      props: {
        etiqueta: 'Estado',
        vacio: 'Todos',
        opciones: [
          { valor: 'aprobada', etiqueta: 'Aprobada' },
          { valor: 'anulada', etiqueta: 'Anulada', deshabilitada: true },
        ],
        modelValue: '',
        'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v }),
      },
    })
    expect(w.findAll('option').map((o) => o.text())).toEqual(['Todos', 'Aprobada', 'Anulada'])
    expect(w.findAll('option')[2]!.attributes('disabled')).toBeDefined()
    expect(w.get('label').attributes('for')).toBe(w.get('select').attributes('id'))
    await w.get('select').setValue('aprobada')
    expect(w.props('modelValue')).toBe('aprobada')
  })

  it('muestra el error asociado al campo', () => {
    const w = mount(HudSelector, { props: { etiqueta: 'E', opciones: [], modelValue: '', error: 'Elija uno.' } })
    expect(w.get('select').attributes('aria-invalid')).toBe('true')
    expect(w.get('[role="alert"]').text()).toBe('Elija uno.')
  })
})

describe('HudFecha', () => {
  it('usa fecha o fecha y hora según la prop', async () => {
    const w = mount(HudFecha, {
      props: { etiqueta: 'Desde', modelValue: '', 'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v }) },
    })
    expect(w.get('input').attributes('type')).toBe('date')
    await w.get('input').setValue('2026-11-16')
    expect(w.props('modelValue')).toBe('2026-11-16')
    await w.setProps({ conHora: true, minimo: '2026-11-01T00:00' })
    expect(w.get('input').attributes('type')).toBe('datetime-local')
    expect(w.get('input').attributes('min')).toBe('2026-11-01T00:00')
  })
})
