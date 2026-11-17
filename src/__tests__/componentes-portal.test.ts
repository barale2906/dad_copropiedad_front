import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import QrCompartir from '@/hud/componentes/QrCompartir.vue'
import TarjetaResumen from '@/hud/componentes/TarjetaResumen.vue'

describe('TarjetaResumen', () => {
  it('muestra título, valor y detalle; con destino es un enlace', () => {
    const w = mount(TarjetaResumen, {
      props: { titulo: 'Mi saldo', valor: '$ 100', detalle: 'En mora', tono: 'peligro', a: { name: 'x' } },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    expect(w.text()).toContain('Mi saldo')
    expect(w.text()).toContain('$ 100')
    expect(w.findComponent(RouterLinkStub).exists()).toBe(true)
    expect(w.classes()).toContain('peligro')
  })

  it('sin destino es un bloque; cargando muestra el indicador', () => {
    const w = mount(TarjetaResumen, { props: { titulo: 'Paquetes', valor: '2', detalle: 'x', cargando: true } })
    expect(w.element.tagName).toBe('DIV')
    expect(w.text()).toContain('…')
    expect(w.text()).not.toContain('x')
    expect(w.attributes('aria-busy')).toBe('true')
  })
})

describe('QrCompartir', () => {
  it('dibuja el QR, ofrece WhatsApp con el mensaje y el texto del código', () => {
    const w = mount(QrCompartir, { props: { texto: 'DAD1.abc', mensaje: 'Hola Ana' } })
    expect(w.find('svg[role="img"]').exists()).toBe(true)
    expect(w.get('a.whatsapp').attributes('href')).toBe(`https://wa.me/?text=${encodeURIComponent('Hola Ana\nDAD1.abc')}`)
    expect(w.text()).toContain('DAD1.abc')
  })

  it('sin Web Share avisa y deja la alternativa', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined, canShare: undefined })
    const w = mount(QrCompartir, { props: { texto: 'DAD1.abc', mensaje: 'Hola' }, attachTo: document.body })
    await w.findAll('button').find((b) => b.text().includes('Compartir'))!.trigger('click')
    await vi.waitFor(() => expect(w.text()).toContain('no comparte imágenes'))
    vi.unstubAllGlobals()
    w.unmount()
  })

  it('con Web Share comparte el texto si no puede compartir la imagen', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, share, canShare: () => false })
    const w = mount(QrCompartir, { props: { texto: 'DAD1.abc', mensaje: 'Hola' }, attachTo: document.body })
    await w.findAll('button').find((b) => b.text().includes('Compartir'))!.trigger('click')
    await vi.waitFor(() => expect(share).toHaveBeenCalledWith({ text: 'Hola\nDAD1.abc' }))
    vi.unstubAllGlobals()
    w.unmount()
  })
})
