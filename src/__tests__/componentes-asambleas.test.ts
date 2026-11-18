import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HudPasos from '@/hud/componentes/HudPasos.vue'
import LectorQr from '@/hud/componentes/LectorQr.vue'
import MedidorQuorum from '@/hud/componentes/MedidorQuorum.vue'

describe('MedidorQuorum', () => {
  const base = { porcentajeCoeficiente: '42.5', unidadesPresentes: 17, unidadesTotal: 40, asistentes: 12 }

  it('sin quórum muestra cuánto falta y marca el umbral', () => {
    const w = mount(MedidorQuorum, { props: { ...base, hayQuorum: false, umbral: '50' } })
    expect(w.text()).toContain('42,50 %')
    expect(w.get('[role="status"]').text()).toBe('Falta quórum (más del 50 %)')
    expect(w.get('[role="meter"]').attributes('aria-valuenow')).toBe('42.5')
    expect(w.get('.relleno').attributes('style')).toContain('width: 42.5%')
    expect(w.get('.umbral').attributes('style')).toContain('left: 50%')
    expect(w.text()).toContain('17 de 40 unidades · 12 asistentes')
  })

  it('con quórum lo dice y en segunda convocatoria no hay umbral', () => {
    const w = mount(MedidorQuorum, { props: { ...base, asistentes: 1, hayQuorum: true, umbral: null } })
    expect(w.get('[role="status"]').text()).toBe('Hay quórum')
    expect(w.find('.umbral').exists()).toBe(false)
    expect(w.classes()).toContain('ok')
    expect(w.text()).toContain('1 asistente')
  })
})

describe('HudPasos', () => {
  const pasos = [{ id: 'a', texto: 'Datos' }, { id: 'b', texto: 'Orden' }, { id: 'c', texto: 'Convocar' }]

  it('marca el paso actual y no deja saltar adelante', async () => {
    const w = mount(HudPasos, { props: { pasos, actual: 'b' } })
    const botones = w.findAll('button')
    expect(botones[1]!.attributes('aria-current')).toBe('step')
    expect(botones[2]!.attributes('disabled')).toBeDefined()
    await botones[0]!.trigger('click')
    expect(w.emitted('ir')).toEqual([['a']])
  })

  it('libre: se puede ir a cualquier paso', () => {
    const w = mount(HudPasos, { props: { pasos, actual: 'a', libre: true } })
    expect(w.findAll('button')[2]!.attributes('disabled')).toBeUndefined()
  })
})

describe('LectorQr con otros formatos', () => {
  it('lee rótulos Code 128 desde el teclado con su propia ayuda', async () => {
    const w = mount(LectorQr, { props: { etiqueta: 'Código del rótulo', formatos: ['code_128'], ayuda: 'Pase el rótulo.' } })
    expect(w.text()).toContain('Pase el rótulo.')
    await w.get('input').setValue('ASM-0007')
    await w.get('form').trigger('submit')
    expect(w.emitted('leido')).toEqual([['ASM-0007']])
  })
})
