import { describe, expect, it } from 'vitest'
import { accionesPermitidas, puedeAprobar } from '@/composables/reglas'

describe('reglas comunes', () => {
  const BOTONES = { borrador: ['emitir', 'eliminar'], emitida: ['anular'] } as const

  it('ofrece los botones del estado y nada para estados sin botones', () => {
    expect(accionesPermitidas('borrador', BOTONES)).toEqual(['emitir', 'eliminar'])
    expect(accionesPermitidas<'borrador' | 'emitida' | 'anulada', string>('anulada', BOTONES)).toEqual([])
  })

  it('cuatro ojos: quien creó o ejecutó no aprueba', () => {
    expect(puedeAprobar(['a', null], 'b')).toBe(true)
    expect(puedeAprobar(['a', 'b'], 'b')).toBe(false)
    expect(puedeAprobar(['a'], null)).toBe(false)
  })
})
