import { describe, expect, it } from 'vitest'
import { coeficiente, comparar, esDecimal, leerDecimal, moneda, porcentaje, restar, sumar } from '@/formato/decimales'
import { aLocal, aUtc, fecha, fechaCalendario, fechaHora, hora, hoyEn } from '@/formato/fechas'

const normal = (s: string) => s.replace(/\s/g, ' ')

describe('fechas', () => {
  it('una fecha de calendario no se corre de día con la zona', () => {
    // Medianoche UTC del 1 de noviembre es el 31 de octubre en Bogotá; la fecha de calendario no se corre.
    expect(fechaCalendario('2026-11-01')).toBe(fecha('2026-11-01T17:00:00Z', 'America/Bogota'))
    expect(fechaCalendario('2026-11-01')).toContain('1')
    expect(() => fechaCalendario('01/11/2026')).toThrow(RangeError)
  })

  it('el día de hoy depende de la zona de la entidad', () => {
    const casiMedianoche = new Date('2026-11-17T03:30:00Z')
    expect(hoyEn('America/Bogota', casiMedianoche)).toBe('2026-11-16')
    expect(hoyEn('UTC', casiMedianoche)).toBe('2026-11-17')
  })

  it('muestra en la zona de la entidad, no en la del navegador', () => {
    // 03:00 UTC del 17 es todavía el 16 en Bogotá (UTC-5).
    expect(fecha('2026-11-17T03:00:00Z', 'America/Bogota')).toContain('16')
    expect(fecha('2026-11-17T03:00:00Z', 'Asia/Tokyo')).toContain('17')
  })

  it('incluye la hora local', () => {
    expect(normal(fechaHora('2026-11-16T15:04:05Z', 'America/Bogota'))).toMatch(/10:04/)
  })

  it('formatea horas de pared sin convertir zonas', () => {
    expect(normal(hora('14:30:00'))).toMatch(/2:30/)
    expect(normal(hora('08:05'))).toMatch(/8:05/)
  })

  it('convierte la hora local de la entidad a UTC', () => {
    expect(aUtc('2026-11-16T10:00', 'America/Bogota')).toBe('2026-11-16T15:00:00Z')
    expect(aUtc('2026-07-01T09:30:15', 'Europe/Madrid')).toBe('2026-07-01T07:30:15Z')
  })

  it('convierte un instante UTC a la hora local del formulario, y vuelve igual', () => {
    expect(aLocal('2026-11-16T15:00:00Z', 'America/Bogota')).toBe('2026-11-16T10:00')
    expect(aLocal('2026-11-17T04:30:00Z', 'America/Bogota')).toBe('2026-11-16T23:30')
    expect(aLocal('2026-07-01T07:30:00Z', 'Europe/Madrid')).toBe('2026-07-01T09:30')
    expect(aUtc(aLocal('2026-03-29T01:30:00Z', 'Europe/Madrid'), 'Europe/Madrid')).toBe('2026-03-29T01:30:00Z')
  })

  it('rechaza entradas inválidas', () => {
    expect(() => fecha('no es fecha', 'America/Bogota')).toThrow(RangeError)
    expect(() => hora('25h')).toThrow(RangeError)
    expect(() => aUtc('16/11/2026', 'America/Bogota')).toThrow(RangeError)
  })
})

describe('decimales', () => {
  it('formatea montos al estilo colombiano', () => {
    expect(moneda('150000.5')).toBe('$ 150.000,50')
    expect(moneda('0')).toBe('$ 0,00')
    expect(moneda('-1234567.891')).toBe('-$ 1.234.567,89')
    expect(moneda('999', 0)).toBe('$ 999')
  })

  it('formatea porcentajes y coeficientes', () => {
    expect(porcentaje('19')).toBe('19,00 %')
    expect(coeficiente('0.00523000')).toBe('0,523000 %')
  })

  it('suma y resta sin perder precisión', () => {
    expect(sumar('0.1', '0.2')).toBe('0.3')
    expect(sumar()).toBe('0')
    expect(restar('100.00', '0.01')).toBe('99.99')
    expect(sumar('0.00000001', '0.00000002')).toBe('0.00000003')
  })

  it('compara textos decimales', () => {
    expect(comparar('10', '9.99')).toBe(1)
    expect(comparar('1.0', '1')).toBe(0)
    expect(comparar('-1', '0')).toBe(-1)
  })

  it('valida el formato del backend', () => {
    expect(esDecimal('12.50')).toBe(true)
    expect(esDecimal('12,50')).toBe(false)
    expect(() => moneda('abc')).toThrow(RangeError)
  })

  it('lee lo que escribe el usuario', () => {
    expect(leerDecimal('1.234.567,5')).toBe('1234567.5')
    expect(leerDecimal('$ 1.000')).toBe('1000')
    expect(leerDecimal('1234.56')).toBe('1234.56')
    expect(leerDecimal('1.5')).toBe('1.5')
    expect(leerDecimal('')).toBeNull()
    expect(leerDecimal('12,345')).toBeNull()
    expect(leerDecimal('doce')).toBeNull()
  })
})
