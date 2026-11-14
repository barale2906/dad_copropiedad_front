import { mount, RouterLinkStub } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { ZONAS } from '@/escena/plantillas/zonas'
import PanelZona from '@/pantallas/componentes/PanelZona.vue'
import { conCapacidades, prepararConDemo } from './ayudantes'

const zona = (id: string) => ZONAS.conjunto.find((z) => z.id === id)!

function montar(id: string) {
  return mount(PanelZona, {
    props: { zona: zona(id) },
    global: { stubs: { RouterLink: RouterLinkStub } },
    attachTo: document.body,
  })
}

describe('PanelZona', () => {
  beforeEach(() => prepararConDemo())

  it('muestra solo las acciones permitidas, con la zona preseleccionada en la ruta', () => {
    conCapacidades({
      tipo: 'propiedad_horizontal',
      modulos: ['bienes_comunes'],
      permisos: ['reservas.crear', 'bienes_comunes.ver'],
    })
    const w = montar('piscina')
    const enlaces = w.findAllComponents(RouterLinkStub)
    expect(enlaces.map((e) => e.text())).toEqual([
      expect.stringContaining('Reservar'),
      expect.stringContaining('Disponibilidad'),
      expect.stringContaining('Reglas y tarifas'),
    ])
    expect(enlaces[0]!.props('to')).toMatchObject({
      name: 'modulo',
      params: { seccion: 'zonas-comunes', accion: 'reservar' },
      query: { zona: 'piscina', origen: 'piscina' },
    })
    w.unmount()
  })

  it('sin el módulo contratado no ofrece acciones y lo indica', () => {
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: ['acceso.registrar'] })
    const w = montar('porteria')
    expect(w.findAllComponents(RouterLinkStub)).toHaveLength(0)
    expect(w.text()).toContain('Módulo no contratado')
    w.unmount()
  })

  it('en una zona con varias secciones muestra cada una con su estado', () => {
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: ['asambleas'], permisos: ['asambleas.ver'] })
    const w = montar('salon-social')
    expect(w.text()).toContain('Zona · Disponible')
    expect(w.text()).toContain('Asambleas')
    expect(w.text()).toContain('Módulo no contratado')
    w.unmount()
  })

  it('Escape y el botón cerrar emiten «cerrar»', async () => {
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] })
    const w = montar('torres')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.get('button[aria-label="Cerrar"]').trigger('click')
    expect(w.emitted('cerrar')).toHaveLength(2)
    w.unmount()
  })
})
