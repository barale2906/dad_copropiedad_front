import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CalendarioFranjas from '@/hud/componentes/CalendarioFranjas.vue'

const ZONA = 'America/Bogota'
// 17 nov: 8:00–11:00 a. m. en Bogotá; 18 nov: 2:00–3:00 p. m.
const FRANJAS = [
  { inicio: '2026-11-17T13:00:00Z', fin: '2026-11-17T16:00:00Z' },
  { inicio: '2026-11-18T19:00:00Z', fin: '2026-11-18T20:00:00Z' },
]
const DIAS = ['2026-11-17', '2026-11-18', '2026-11-19']

function montar(props: Record<string, unknown> = {}) {
  return mount(CalendarioFranjas, { props: { dias: DIAS, franjas: FRANJAS, zona: ZONA, paso: 60, duracion: 60, modelValue: null, ...props } })
}

describe('CalendarioFranjas', () => {
  it('muestra los inicios posibles por día en la zona de la entidad', () => {
    const w = montar()
    const dias = w.findAll('section.dia')
    expect(dias).toHaveLength(3)
    expect(dias[0]!.findAll('button')).toHaveLength(3)
    expect(dias[0]!.text()).toMatch(/8:00/)
    expect(dias[1]!.findAll('button')).toHaveLength(1)
    expect(dias[2]!.text()).toContain('Sin franjas')
  })

  it('una duración más larga deja menos inicios', () => {
    const w = montar({ duracion: 120 })
    expect(w.findAll('section.dia')[0]!.findAll('button')).toHaveLength(2)
    expect(w.findAll('section.dia')[1]!.text()).toContain('Sin franjas')
  })

  it('elige con clic o teclado (son botones) y marca el elegido', async () => {
    const w = montar()
    const boton = w.findAll('button')[1]!
    await boton.trigger('click')
    const elegido = w.emitted('update:modelValue')?.[0]?.[0]
    expect(elegido).toBe('2026-11-17T14:00:00Z')
    await w.setProps({ modelValue: elegido as string })
    expect(w.findAll('button')[1]!.attributes('aria-pressed')).toBe('true')
    expect(w.findAll('button')[0]!.attributes('aria-pressed')).toBe('false')
  })

  it('en solo lectura muestra las franjas libres, sin botones', () => {
    const w = montar({ soloLectura: true })
    expect(w.findAll('button')).toHaveLength(0)
    expect(w.findAll('.libre')).toHaveLength(2)
    expect(w.findAll('.libre')[0]!.text()).toMatch(/8:00.*11:00/)
  })

  it('avisa si no hay franjas libres', () => {
    expect(montar({ franjas: [] }).text()).toContain('No hay franjas libres en estos días.')
  })
})
