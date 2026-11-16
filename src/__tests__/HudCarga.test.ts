import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HudCarga from '@/hud/componentes/HudCarga.vue'

describe('HudCarga', () => {
  it('se anuncia como estado con el mensaje por defecto', () => {
    const w = mount(HudCarga)
    expect(w.attributes('role')).toBe('status')
    expect(w.text()).toContain('Preparando su espacio de trabajo')
  })

  it('acepta un mensaje propio y la ilustración es decorativa', () => {
    const w = mount(HudCarga, { props: { mensaje: 'Abriendo la maqueta…' } })
    expect(w.text()).toContain('Abriendo la maqueta…')
    expect(w.get('svg').attributes('aria-hidden')).toBe('true')
  })
})
