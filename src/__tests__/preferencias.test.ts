import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { usePreferencias } from '@/stores/preferencias'

describe('preferencias del navegador', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('por omisión no es un equipo de portería', () => {
    expect(usePreferencias().turnoAlEntrar).toBe(false)
  })

  it('recuerda que el equipo abre el turno al entrar', async () => {
    usePreferencias().turnoAlEntrar = true
    await nextTick()
    setActivePinia(createPinia())
    expect(usePreferencias().turnoAlEntrar).toBe(true)
    expect(usePreferencias().vista).toBe('maqueta')
  })

  it('un valor guardado dañado vuelve a los predeterminados', () => {
    localStorage.setItem('dad.preferencias', '{no es json')
    expect(usePreferencias().turnoAlEntrar).toBe(false)
  })
})
