import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import HudCodigoQr from '@/hud/componentes/HudCodigoQr.vue'
import SecretoUnaVez from '@/hud/componentes/SecretoUnaVez.vue'

describe('HudCodigoQr', () => {
  it('dibuja el código con su descripción accesible', () => {
    const w = mount(HudCodigoQr, { props: { texto: 'otpauth://totp/DAD:x?secret=ABC', descripcion: 'QR de prueba' } })
    expect(w.attributes('role')).toBe('img')
    expect(w.attributes('aria-label')).toBe('QR de prueba')
    expect(w.get('path').attributes('d')).toMatch(/^M\d+ \d+h1v1h-1z/)
  })

  it('cambia el dibujo si cambia el texto', async () => {
    const w = mount(HudCodigoQr, { props: { texto: 'uno' } })
    const antes = w.get('path').attributes('d')
    await w.setProps({ texto: 'otro texto más largo' })
    expect(w.get('path').attributes('d')).not.toBe(antes)
  })
})

describe('SecretoUnaVez', () => {
  it('muestra el secreto y lo copia', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const w = mount(SecretoUnaVez, { props: { valor: 'ABC123' } })
    expect(w.get('code').text()).toBe('ABC123')
    expect(w.text()).toContain('no se volverá a mostrar')
    await w.get('button').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('ABC123')
    expect(w.get('button').text()).toContain('Copiado')
  })

  it('si no puede copiar, pide hacerlo a mano', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } })
    const w = mount(SecretoUnaVez, { props: { valor: 'X' } })
    await w.get('button').trigger('click')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('cópielo a mano')
  })
})
