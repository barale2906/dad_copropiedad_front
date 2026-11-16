import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HudBoton from '@/hud/componentes/HudBoton.vue'

const montar = (props: Record<string, unknown>) =>
  mount(HudBoton, { props, slots: { default: 'Seguir' }, global: { stubs: { RouterLink: RouterLinkStub } } })

describe('HudBoton', () => {
  it('sin destino es un botón con su tipo', () => {
    const w = montar({ tipo: 'submit' })
    expect(w.element.tagName).toBe('BUTTON')
    expect(w.attributes('type')).toBe('submit')
    expect(w.text()).toBe('Seguir')
  })

  it('cargando se deshabilita y lo anuncia', () => {
    const w = montar({ cargando: true })
    expect(w.attributes('disabled')).toBeDefined()
    expect(w.attributes('aria-busy')).toBe('true')
  })

  it('con destino es un enlace a esa ruta', () => {
    const w = montar({ a: { name: 'inicio' }, variante: 'secundario' })
    const enlace = w.getComponent(RouterLinkStub)
    expect(enlace.props('to')).toEqual({ name: 'inicio' })
    expect(enlace.classes()).toContain('secundario')
    expect(w.find('button').exists()).toBe(false)
  })
})
