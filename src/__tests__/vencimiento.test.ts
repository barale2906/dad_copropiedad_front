import { describe, expect, it } from 'vitest'
import { lapso, semaforoVencimiento, ventanaRestante } from '@/formato/vencimiento'

const ahora = new Date('2026-11-17T12:00:00Z')
const en = (min: number) => new Date(ahora.getTime() + min * 60_000).toISOString()

describe('lapso', () => {
  it('usa minutos y horas hasta un día; luego días', () => {
    expect(lapso(20_000)).toBe('menos de 1 min')
    expect(lapso(45 * 60_000)).toBe('45 min')
    expect(lapso(150 * 60_000)).toBe('2 h 30 min')
    expect(lapso(36 * 3_600_000)).toBe('2 días')
    expect(lapso(24 * 3_600_000)).toBe('1 día')
    expect(lapso(-5)).toBe('menos de 1 min')
  })
})

describe('semáforo de vencimiento', () => {
  it('vencido en rojo, por vencer en ámbar y a tiempo en verde', () => {
    expect(semaforoVencimiento(en(-90), false, ahora)).toEqual({ tono: 'peligro', texto: 'Vencido hace 1 h 30 min' })
    expect(semaforoVencimiento(en(120), false, ahora)).toEqual({ tono: 'aviso', texto: 'Vence en 2 h' })
    expect(semaforoVencimiento(en(3 * 24 * 60), false, ahora)).toEqual({ tono: 'exito', texto: 'Vence en 3 días' })
  })

  it('el dato «vencido» del backend manda sobre el reloj; sin plazo es neutro', () => {
    expect(semaforoVencimiento(en(60), true, ahora).tono).toBe('peligro')
    expect(semaforoVencimiento(null, false, ahora)).toEqual({ tono: 'neutro', texto: 'Sin plazo' })
    expect(semaforoVencimiento(undefined, true, ahora)).toEqual({ tono: 'peligro', texto: 'Vencido' })
  })
})

describe('ventana de 24 h de WhatsApp', () => {
  it('cuenta lo que queda desde el último mensaje del residente', () => {
    const v = ventanaRestante(en(-60), ahora)
    expect(v).toMatchObject({ abierta: true, texto: 'Quedan 23 h para responder', tono: 'exito' })
    expect(ventanaRestante(en(-23 * 60), ahora)).toMatchObject({ abierta: true, tono: 'aviso' })
  })

  it('pasadas las 24 h ya no se puede responder', () => {
    expect(ventanaRestante(en(-25 * 60), ahora)).toMatchObject({ abierta: false, restanteMs: 0 })
    expect(ventanaRestante(en(-24 * 60), ahora).abierta).toBe(false)
  })
})
