import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Horario } from '@/api/tipos'
import EditorHorario from '@/modulos/entidad/componentes/EditorHorario.vue'

function montar(inicial: Horario) {
  const w = mount(EditorHorario, {
    props: { modelValue: inicial, 'onUpdate:modelValue': (h: Horario) => w.setProps({ modelValue: h }) },
  })
  return w
}
const ultimo = (w: ReturnType<typeof montar>) => w.emitted<[Horario]>('update:modelValue')!.at(-1)![0]
const boton = (w: ReturnType<typeof montar>, texto: string) => w.findAll('button').find((b) => b.text().includes(texto))!

describe('EditorHorario', () => {
  it('sin franjas avisa que no se atiende y agrega una de lunes por defecto', async () => {
    const w = montar({ franjas: [], excepciones: [] })
    expect(w.text()).toContain('no se atiende ningún día')
    await boton(w, 'Agregar franja').trigger('click')
    expect(ultimo(w).franjas).toEqual([{ dia: 1, inicio: '08:00:00', fin: '17:00:00', aplica_festivos: false }])
  })

  it('la franja nueva sigue al día siguiente con el mismo horario', async () => {
    const w = montar({ franjas: [{ dia: 7, inicio: '09:00:00', fin: '13:00:00' }] })
    await boton(w, 'Agregar franja').trigger('click')
    expect(ultimo(w).franjas![1]).toMatchObject({ dia: 1, inicio: '09:00:00', fin: '13:00:00' })
  })

  it('cambia el día, las horas y los festivos de una franja, y la quita', async () => {
    const w = montar({ franjas: [{ dia: 1, inicio: '08:00:00', fin: '12:00:00' }] })
    await w.get('select').setValue('3')
    expect(ultimo(w).franjas![0]!.dia).toBe(3)
    await w.findAll('input[type="time"]')[1]!.setValue('13:00')
    expect(ultimo(w).franjas![0]!.fin).toBe('13:00')
    await w.get('input[type="checkbox"]').setValue(true)
    expect(ultimo(w).franjas![0]!.aplica_festivos).toBe(true)
    await boton(w, 'Quitar la franja 1').trigger('click')
    expect(ultimo(w).franjas).toEqual([])
  })

  it('agrega una excepción, vacía las horas a null y la quita', async () => {
    const w = montar({ franjas: [], excepciones: [] })
    await boton(w, 'Agregar excepción').trigger('click')
    expect(ultimo(w).excepciones).toEqual([{ fecha: '', inicio: null, fin: null, motivo: null }])
    await w.get('input[type="date"]').setValue('2026-12-24')
    const horas = w.findAll('input[type="time"]')
    await horas[0]!.setValue('10:00')
    await horas[0]!.setValue('')
    expect(ultimo(w).excepciones![0]).toMatchObject({ fecha: '2026-12-24', inicio: null })
    await boton(w, 'Quitar la excepción 1').trigger('click')
    expect(ultimo(w).excepciones).toEqual([])
  })
})
