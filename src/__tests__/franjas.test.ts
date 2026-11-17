import { describe, expect, it } from 'vitest'
import { porcentajeDe } from '@/formato/decimales'
import { diaSemana, horaEn } from '@/formato/fechas'
import { dias, duraciones, iniciosPosibles, minutosEntre, porDia, sumarMinutos, textoDuracion } from '@/formato/franjas'

describe('franjas', () => {
  it('parte las franjas libres en inicios donde cabe la duración', () => {
    const franjas = [
      { inicio: '2026-11-17T13:00:00Z', fin: '2026-11-17T16:00:00Z' },
      { inicio: '2026-11-17T18:00:00Z', fin: '2026-11-17T19:00:00Z' },
    ]
    expect(iniciosPosibles(franjas, 60, 60)).toEqual([
      '2026-11-17T13:00:00Z',
      '2026-11-17T14:00:00Z',
      '2026-11-17T15:00:00Z',
      '2026-11-17T18:00:00Z',
    ])
    expect(iniciosPosibles(franjas, 30, 120)).toEqual(['2026-11-17T13:00:00Z', '2026-11-17T13:30:00Z', '2026-11-17T14:00:00Z'])
    expect(iniciosPosibles(franjas, 0, 60)).toEqual([])
  })

  it('lista las duraciones permitidas y las escribe', () => {
    expect(duraciones(60, 180, 60)).toEqual([60, 120, 180])
    expect(duraciones(45, 120, 30)).toEqual([60, 90, 120])
    expect(duraciones(0, 60, 30)).toEqual([30, 60])
    expect(textoDuracion(30)).toBe('30 min')
    expect(textoDuracion(60)).toBe('1 h')
    expect(textoDuracion(90)).toBe('1 h 30 min')
  })

  it('suma minutos y cuenta los días de una semana', () => {
    expect(sumarMinutos('2026-11-17T23:30:00Z', 60)).toBe('2026-11-18T00:30:00Z')
    expect(minutosEntre('2026-11-17T13:00:00Z', '2026-11-17T15:30:00Z')).toBe(150)
    expect(dias('2026-12-30', 3)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01'])
  })

  it('agrupa por día en la zona de la entidad, no en UTC', () => {
    const grupos = porDia(['2026-11-18T03:00:00Z', '2026-11-18T14:00:00Z'], (x) => x, 'America/Bogota')
    expect([...grupos.keys()]).toEqual(['2026-11-17', '2026-11-18'])
  })

  it('muestra la hora y el día en la zona dada', () => {
    expect(horaEn('2026-11-17T13:00:00Z', 'America/Bogota')).toMatch(/^8:00/)
    expect(diaSemana('2026-11-16')).toMatch(/lunes/)
  })

  it('calcula un porcentaje de un monto sin perder precisión', () => {
    expect(porcentajeDe('150000', '20')).toBe('30000.00')
    expect(porcentajeDe('0.10', '33.3')).toBe('0.03')
  })
})
