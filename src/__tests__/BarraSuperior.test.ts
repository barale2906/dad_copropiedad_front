import { mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntidadDeLaCuenta } from '@/api/tipos'
import BarraSuperior from '@/pantallas/componentes/BarraSuperior.vue'
import { conCapacidades, ENTIDAD_PH, prepararConDemo } from './ayudantes'

vi.mock('vue-router', () => ({ useRouter: () => ({ replace: vi.fn() }) }))

function montar(entidad: Partial<EntidadDeLaCuenta> = {}) {
  const e = { ...ENTIDAD_PH, ...entidad }
  conCapacidades({ tipo: e.tipo, modulos: [], permisos: [] }, e)
  return mount(BarraSuperior, { global: { stubs: { RouterLink: RouterLinkStub } } })
}

describe('BarraSuperior', () => {
  beforeEach(() => prepararConDemo())

  it('muestra el tipo y el nombre de la entidad, sin aviso si está activa', () => {
    const w = montar()
    expect(w.text()).toContain('Propiedad horizontal')
    expect(w.text()).toContain('Conjunto de prueba')
    expect(w.find('.aviso-estado').exists()).toBe(false)
  })

  it('reconoce la entidad de la plataforma', () => {
    expect(montar({ tipo: 'plataforma' }).text()).toContain('Plataforma')
  })

  it('avisa si la entidad está en configuración', () => {
    const w = montar({ estado: 'en_configuracion' })
    expect(w.text()).toContain('En configuración')
    expect(w.text()).toContain('aún está en configuración')
  })

  it('avisa si la entidad está suspendida y qué hacer', () => {
    const w = montar({ estado: 'suspendida' })
    expect(w.get('.aviso-estado').attributes('data-estado')).toBe('suspendida')
    expect(w.text()).toContain('Comuníquese con DAD')
  })

  it('avisa la suspensión que informan las capacidades aunque el listado diga activa', () => {
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [], entidad_suspendida: true })
    const w = mount(BarraSuperior, { global: { stubs: { RouterLink: RouterLinkStub } } })
    expect(w.get('.aviso-estado').attributes('data-estado')).toBe('suspendida')
    expect(w.text()).toContain('solo puede consultar')
  })
})
