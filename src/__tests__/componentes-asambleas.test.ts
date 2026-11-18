import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Escrutinio } from '@/api/tipos'
import EscrutinioPregunta from '@/hud/componentes/EscrutinioPregunta.vue'
import HudPasos from '@/hud/componentes/HudPasos.vue'
import LectorQr from '@/hud/componentes/LectorQr.vue'
import MedidorQuorum from '@/hud/componentes/MedidorQuorum.vue'
import EditorPregunta from '@/modulos/asambleas/componentes/EditorPregunta.vue'

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

describe('EscrutinioPregunta', () => {
  const conteo = (unidades: number) => ({ coeficiente: (unidades * 0.025).toFixed(8), unidades })
  const base: Escrutinio = {
    base_computo: 'coeficiente', habilitados: conteo(20), total: conteo(40), votantes: conteo(16), sin_votar: conteo(4),
    opciones: [
      { opcion_id: 'si', texto: 'Sí', en_blanco: false, votos: conteo(12), porcentaje_coeficiente: '60.0000', porcentaje_unidades: '60.0000', aprobada: true, aprobada_en_otra_base: false, cupos: null },
      { opcion_id: 'no', texto: 'No', en_blanco: false, votos: conteo(4), porcentaje_coeficiente: '20.0000', porcentaje_unidades: '20.0000', aprobada: null, aprobada_en_otra_base: null, cupos: null },
    ],
    decision: { decision: 'aprobada' }, advertencia_unidades: false,
  }

  it('nominal: decisión, barras por opción en la base y la otra base', () => {
    const w = mount(EscrutinioPregunta, { props: { escrutinio: base } })
    expect(w.text()).toContain('Aprobada')
    expect(w.text()).toContain('Por coeficiente')
    const opciones = w.get('ul[aria-label="Resultados por opción"]').findAll('li')
    expect(opciones).toHaveLength(2)
    expect(opciones[0]?.text()).toContain('60,00 %')
    expect(opciones[0]?.text()).toContain('12 unidades · alcanza la mayoría · en la otra base no la alcanzaría')
    expect(opciones[0]?.classes()).toContain('ganadora')
    expect(opciones[0]?.get('.relleno').attributes('style')).toContain('width: 60%')
    expect(w.text()).toContain('Votaron 16 de 20 bienes habilitados (80,0 % del coeficiente)')
    expect(w.text()).not.toContain('reservada')
  })

  it('reservada y abierta: aclara que solo hay totales y que el resultado es parcial', () => {
    const w = mount(EscrutinioPregunta, { props: { escrutinio: base, reservada: true, abierta: true, etiqueta: 'Parcial' } })
    expect(w.text()).toContain('Votación abierta: resultado parcial')
    expect(w.text()).toContain('Votación reservada: solo se publican los totales.')
    expect(w.find('ul[aria-label="Parcial"]').exists()).toBe(true)
  })

  it('por unidades advierte el riesgo legal; en elecciones muestra los cupos', () => {
    const w = mount(EscrutinioPregunta, {
      props: {
        escrutinio: {
          ...base, base_computo: 'unidades', advertencia_unidades: true,
          decision: { decision: 'reparto', cociente: '8', empate: false, sin_asignar: 0, cupos: [{ opcion_id: 'si', por_cociente: 2, por_residuo: 0, residuo: '0' }] },
        },
      },
    })
    expect(w.text()).toContain('la Ley 675 exige coeficientes')
    expect(w.text()).toContain('Por unidades')
    expect(w.text()).toContain('30,000000 % del coeficiente · alcanza la mayoría')
    expect(w.text()).toContain('2 cupos')
    expect(w.text()).toContain('0 cupos')
  })
})

describe('EditorPregunta', () => {
  it('valida antes de enviar y emite la petición lista', async () => {
    const w = mount(EditorPregunta, { props: { entidadId: 'ph' } })
    await w.get('form').trigger('submit')
    expect(w.get('[role="alert"]').text()).toBe('Escriba la pregunta.')
    expect(w.emitted('guardar')).toBeUndefined()
    await w.get('textarea').setValue('¿Aprueba el presupuesto?')
    await w.get('input[type="checkbox"]').setValue(false)
    await w.get('form').trigger('submit')
    expect(w.emitted('guardar')?.[0]?.[0]).toMatchObject({ enunciado: '¿Aprueba el presupuesto?', tipo: 'si_no', con_abstencion: false })
  })

  it('en una elección pide planchas y cupos, y muestra el error del backend', async () => {
    const w = mount(EditorPregunta, { props: { entidadId: 'ph', error: 'La reunión ya terminó.' } })
    expect(w.get('[role="alert"]').text()).toBe('La reunión ya terminó.')
    await w.get('select').setValue('eleccion')
    expect(w.text()).toContain('Planchas o candidatos')
    expect(w.text()).toContain('Cupos a proveer')
    await w.get('textarea').setValue('Consejo')
    const planchas = w.findAll('input').filter((i) => i.attributes('type') !== 'checkbox')
    await planchas[0]?.setValue('Plancha 1')
    await w.get('form').trigger('submit')
    expect(w.emitted('guardar')?.[0]?.[0]).toMatchObject({ tipo: 'eleccion', cupos: 1, opciones: [{ texto: 'Plancha 1' }, { texto: 'Voto en blanco', en_blanco: true }] })
  })
})
