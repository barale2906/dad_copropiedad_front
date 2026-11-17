import { mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { limpiar } from '@/api/tokens'
import InicioView from '@/modulos/mi/vistas/InicioView.vue'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

vi.mock('vue-router', () => ({ useRoute: () => ({ params: { entidadId: 'x' } }), useRouter: () => ({ push: vi.fn() }) }))

describe('Mi hogar', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('residente', 'x')
    await useEntidad().entrar('01930000-0000-7000-8000-000000000001')
  })

  it('todas las tarjetas terminan de cargar aunque lleguen en paralelo', async () => {
    const w = mount(InicioView, { global: { stubs: { RouterLink: RouterLinkStub } } })
    await vi.waitFor(() => expect(w.text()).not.toContain('…'), { timeout: 4000 })
    expect(w.text()).toContain('T1-101')
    expect(w.text()).toContain('En mora')
    expect(w.text()).toContain('Esperan su respuesta')
    expect(w.text()).toContain('Por recoger en portería')
    expect(w.text()).toContain('Sin leer')
    w.unmount()
  })
})
