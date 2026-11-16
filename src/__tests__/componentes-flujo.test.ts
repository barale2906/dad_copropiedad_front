import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { SECCIONES } from '@/escena/mapa-modulos'
import AvisoAuditado from '@/hud/componentes/AvisoAuditado.vue'
import FlujoDosPasos from '@/hud/componentes/FlujoDosPasos.vue'
import HudAdjuntos from '@/hud/componentes/HudAdjuntos.vue'
import ModuloNoDisponible from '@/pantallas/componentes/ModuloNoDisponible.vue'
import { conConfig } from './ayudantes'

describe('HudAdjuntos', () => {
  it('lista, abre, quita y sube', async () => {
    const w = mount(HudAdjuntos, { props: { adjuntos: [{ id: 'a1', nombre: 'acta.pdf' }] } })
    await w.get('.abrir').trigger('click')
    expect(w.emitted('abrir')).toEqual([['a1']])
    await w.get('.quitar').trigger('click')
    expect(w.emitted('quitar')).toEqual([['a1']])
    const input = w.get('input[type="file"]')
    const archivo = new File(['x'], 'foto.png')
    Object.defineProperty(input.element, 'files', { value: [archivo] })
    await input.trigger('change')
    expect(w.emitted('subir')).toEqual([[[archivo]]])
  })

  it('en solo lectura no permite subir ni quitar', () => {
    const w = mount(HudAdjuntos, { props: { adjuntos: [], soloLectura: true } })
    expect(w.text()).toContain('Sin adjuntos.')
    expect(w.find('input').exists()).toBe(false)
  })
})

describe('FlujoDosPasos', () => {
  const montar = (paso: 'editar' | 'revisar' | 'hecho', props = {}) =>
    mount(FlujoDosPasos, {
      props: { paso, 'onUpdate:paso': (p: string) => w.setProps({ paso: p as typeof paso }), ...props },
      slots: { formulario: 'FORM', 'vista-previa': 'PREVIA', hecho: 'LISTO' },
    })
  let w: ReturnType<typeof montar>

  it('en «editar» pide la vista previa', async () => {
    w = montar('editar')
    expect(w.text()).toContain('FORM')
    expect(w.get('[aria-current="step"]').text()).toContain('Datos')
    await w.get('form').trigger('submit')
    expect(w.emitted('previsualizar')).toHaveLength(1)
  })

  it('en «revisar» confirma o vuelve a editar', async () => {
    w = montar('revisar', { accion: 'Causar intereses' })
    expect(w.text()).toContain('PREVIA')
    const botones = w.findAll('button')
    await botones.at(-1)!.trigger('click')
    expect(w.emitted('confirmar')).toHaveLength(1)
    await botones[0]!.trigger('click')
    expect(w.props('paso')).toBe('editar')
  })

  it('bloqueado no deja confirmar', () => {
    w = montar('revisar', { bloqueado: true })
    expect(w.findAll('button').at(-1)!.attributes('disabled')).toBeDefined()
  })

  it('en «hecho» ofrece empezar otra', async () => {
    w = montar('hecho')
    expect(w.text()).toContain('LISTO')
    await w.get('button').trigger('click')
    expect(w.emitted('reiniciar')).toHaveLength(1)
  })
})

describe('AvisoAuditado', () => {
  it('avisa qué se va a ver y confirma', async () => {
    const w = mount(AvisoAuditado, { props: { que: 'los contactos de la visita', abierto: true }, attachTo: document.body })
    expect(w.text()).toContain('los contactos de la visita')
    await w.findAll('button').at(-1)!.trigger('click')
    expect(w.emitted('confirmar')).toHaveLength(1)
    w.unmount()
  })
})

describe('ModuloNoDisponible', () => {
  it('sin contratar ofrece el contacto comercial de la configuración', async () => {
    await conConfig({ contactoComercial: 'ventas@dad.co' })
    const w = mount(ModuloNoDisponible, { props: { estado: 'no_contratada', seccion: SECCIONES.porteria! } })
    expect(w.text()).toContain('no está contratado')
    expect(w.get('a').attributes('href')).toMatch(/^mailto:ventas@dad\.co\?subject=Contratar%20Porter/)
  })

  it('sin contacto configurado remite a DAD', async () => {
    await conConfig({ contactoComercial: '' })
    const w = mount(ModuloNoDisponible, { props: { estado: 'no_contratada', seccion: SECCIONES.porteria! } })
    expect(w.text()).toContain('comuníquese con DAD')
  })

  it('sin acceso explica a quién pedirlo', () => {
    const w = mount(ModuloNoDisponible, { props: { estado: 'sin_acceso', seccion: SECCIONES.porteria! } })
    expect(w.text()).toContain('administrador de su entidad')
  })
})
