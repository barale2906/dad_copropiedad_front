import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import IlustracionPerdido from '@/hud/ilustraciones/IlustracionPerdido.vue'
import NoEncontradoView from '@/pantallas/NoEncontradoView.vue'
import { useSesion } from '@/stores/sesion'
import { conCapacidades, ENTIDAD_PH, prepararConDemo } from './ayudantes'

const Vacio = defineComponent({ render: () => null })

async function montar() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', name: 'no-encontrado', component: Vacio }],
  })
  await router.push('/algo/raro?x=1')
  const w = mount(NoEncontradoView, {
    global: { plugins: [router], stubs: { RouterLink: RouterLinkStub } },
  })
  await flushPromises()
  return w
}

const escenario = (w: Awaited<ReturnType<typeof montar>>) =>
  w.getComponent(IlustracionPerdido).props('escenario')

describe('NoEncontradoView', () => {
  beforeEach(() => prepararConDemo())

  it('sin sesión muestra la oficina, la dirección pedida y lleva al acceso', async () => {
    const w = await montar()
    expect(w.get('h1').text()).toBe('Esta página no existe')
    expect(w.text()).toContain('/algo/raro?x=1')
    expect(escenario(w)).toBe('oficina')
    expect(w.getComponent(RouterLinkStub).props('to')).toEqual({ name: 'ingresar' })
  })

  it('dentro de una PH muestra el conjunto y vuelve a su maqueta', async () => {
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] })
    const w = await montar()
    expect(escenario(w)).toBe('conjunto')
    expect(w.text()).toContain('Volver a la maqueta')
    expect(w.getComponent(RouterLinkStub).props('to')).toEqual({
      name: 'maqueta',
      params: { entidadId: ENTIDAD_PH.entidad_id },
    })
  })

  it('con sesión y sin entidad activa usa la última entidad y lleva al inicio', async () => {
    const sesion = useSesion()
    await sesion.iniciar('uno', 'x')
    localStorage.setItem('dad.entidad.ultima', sesion.entidades[0]!.entidad_id)
    const w = await montar()
    expect(escenario(w)).toBe('conjunto')
    expect(w.getComponent(RouterLinkStub).props('to')).toEqual({ name: 'inicio' })
  })
})
