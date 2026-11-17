import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import CapturaFirma from '@/hud/componentes/CapturaFirma.vue'
import CapturaFoto from '@/hud/componentes/CapturaFoto.vue'
import LectorQr from '@/hud/componentes/LectorQr.vue'
import SelectorPersona from '@/hud/componentes/SelectorPersona.vue'

/** Lienzo falso: jsdom no dibuja. */
function lienzoFalso() {
  const ctx = { beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn() }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,QUJD')
  return ctx
}

/** jsdom no trae PointerEvent: un MouseEvent con el nombre del evento basta para el lienzo. */
async function puntero(el: Element, tipo: string, x: number, y: number) {
  el.dispatchEvent(new MouseEvent(tipo, { clientX: x, clientY: y, bubbles: true, cancelable: true }))
  await nextTick()
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('CapturaFirma', () => {
  it('dibujar deja la firma en Base64 sin prefijo; borrar la limpia', async () => {
    const ctx = lienzoFalso()
    const w = mount(CapturaFirma, { props: { modelValue: '', 'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v }) } })
    const lienzo = w.get('canvas')
    expect(lienzo.attributes('role')).toBe('img')
    expect(w.get('button').attributes('disabled')).toBeDefined()
    await puntero(lienzo.element, 'pointerdown', 10, 10)
    await puntero(lienzo.element, 'pointermove', 40, 30)
    await puntero(lienzo.element, 'pointerup', 40, 30)
    expect(ctx.lineTo).toHaveBeenCalled()
    expect(w.props('modelValue')).toBe('QUJD')
    expect(w.text()).toContain('Firma lista')
    await w.get('button').trigger('click')
    expect(w.props('modelValue')).toBe('')
  })

  it('mover sin presionar no dibuja ni emite', async () => {
    const ctx = lienzoFalso()
    const w = mount(CapturaFirma, { props: { modelValue: '' } })
    await puntero(w.get('canvas').element, 'pointermove', 5, 5)
    await puntero(w.get('canvas').element, 'pointerup', 5, 5)
    expect(ctx.lineTo).not.toHaveBeenCalled()
    expect((w.emitted('update:modelValue') ?? []).some(([v]) => v)).toBe(false)
  })
})

describe('LectorQr', () => {
  it('el lector físico (o el teclado) envía el código al presionar Enter', async () => {
    const w = mount(LectorQr)
    const campo = w.get('input')
    await campo.setValue('  DAD1.abc  ')
    await w.get('form').trigger('submit')
    expect(w.emitted('leido')).toEqual([['DAD1.abc']])
    expect((campo.element as HTMLInputElement).value).toBe('')
  })

  it('vacío no envía; sin BarcodeDetector no ofrece la cámara', async () => {
    const w = mount(LectorQr)
    await w.get('form').trigger('submit')
    expect(w.emitted('leido')).toBeUndefined()
    expect(w.text()).not.toContain('Leer con la cámara')
  })

  it('con BarcodeDetector lee con la cámara y la apaga', async () => {
    const parar = vi.fn()
    vi.stubGlobal('BarcodeDetector', class {
      detect = vi.fn().mockResolvedValue([{ rawValue: 'DAD1.cam' }])
    })
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: parar }] }) } })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const w = mount(LectorQr)
    await w.findAll('button').find((b) => b.text().includes('cámara'))!.trigger('click')
    await vi.waitFor(() => expect(w.emitted('leido')).toEqual([['DAD1.cam']]))
    expect(parar).toHaveBeenCalled()
  })

  it('si la cámara falla avisa y deja el campo', async () => {
    vi.stubGlobal('BarcodeDetector', class {})
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error('no')) } })
    const w = mount(LectorQr)
    await w.findAll('button').find((b) => b.text().includes('cámara'))!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('No se pudo usar la cámara')
  })
})

describe('CapturaFoto', () => {
  it('sin cámara usa el selector del dispositivo y guarda la foto en Base64', async () => {
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined })
    const w = mount(CapturaFoto, { props: { modelValue: '', 'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v }) } })
    const selector = w.get('input[type="file"]')
    const clic = vi.spyOn(selector.element as HTMLInputElement, 'click')
    await w.get('button').trigger('click')
    expect(clic).toHaveBeenCalled()
    expect(selector.attributes('aria-label')).toBe('Foto: elegir un archivo')
    const archivo = new File(['abc'], 'f.png', { type: 'image/png' })
    Object.defineProperty(selector.element, 'files', { value: [archivo] })
    await selector.trigger('change')
    await vi.waitFor(() => expect(w.props('modelValue')).toBe(btoa('abc')))
    expect(w.find('img').attributes('alt')).toBe('Foto tomada')
    await w.findAll('button').find((b) => b.text().includes('Quitar'))!.trigger('click')
    expect(w.props('modelValue')).toBe('')
  })

  it('con cámara toma la foto del video y la apaga', async () => {
    lienzoFalso()
    const parar = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: parar }] }) } })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const w = mount(CapturaFoto, { props: { modelValue: '' } })
    await w.get('button').trigger('click')
    await flushPromises()
    await w.findAll('button').find((b) => b.text().includes('Tomar la foto'))!.trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['QUJD'])
    expect(parar).toHaveBeenCalled()
  })
})

describe('SelectorPersona', () => {
  it('busca desde 2 caracteres y emite la elegida', async () => {
    vi.useFakeTimers()
    const buscar = vi.fn().mockResolvedValue([{ id: '1', nombre: 'Marta', detalle: 'CC 52' }])
    const w = mount(SelectorPersona, { props: { buscar } })
    await w.get('input').setValue('m')
    vi.advanceTimersByTime(400)
    expect(buscar).not.toHaveBeenCalled()
    await w.get('input').setValue('mar')
    vi.advanceTimersByTime(400)
    await flushPromises()
    expect(buscar).toHaveBeenCalledWith('mar')
    await w.get('ul button').trigger('click')
    expect(w.emitted('elegir')?.[0]).toEqual([{ id: '1', nombre: 'Marta', detalle: 'CC 52' }])
    vi.useRealTimers()
  })

  it('avisa si no hay resultados o si falla', async () => {
    vi.useFakeTimers()
    const buscar = vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('x'))
    const w = mount(SelectorPersona, { props: { buscar } })
    await w.get('input').setValue('zz')
    vi.advanceTimersByTime(400)
    await flushPromises()
    expect(w.text()).toContain('Ninguna persona coincide')
    await w.get('input').setValue('zzz')
    vi.advanceTimersByTime(400)
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('No se pudo buscar')
    vi.useRealTimers()
  })
})
