import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Permiso, Rol } from '@/api/tipos'
import FormularioRol from '@/hud/componentes/FormularioRol.vue'

const ROLES = [
  { id: 'r1', codigo: 'contador', nombre: 'Contador', permisos: ['contabilidad.ver', 'cartera.ajustar'] },
] as Rol[]
const propios = (p: Permiso) => p !== 'cartera.ajustar'

async function abrir(props: Record<string, unknown> = {}) {
  const w = mount(FormularioRol, {
    props: { roles: ROLES, puedeOtorgar: propios, abierto: false, ...props },
    attachTo: document.body,
  })
  await w.setProps({ abierto: true })
  return w
}

describe('FormularioRol', () => {
  it('propone el código desde el nombre y emite el rol sin permisos', async () => {
    const w = await abrir()
    const [nombre, codigo] = w.findAll('input')
    await nombre!.setValue('Auxiliar de Cartera')
    expect((codigo!.element as HTMLInputElement).value).toBe('auxiliar_de_cartera')
    await w.get('form').trigger('submit')
    expect(w.emitted('enviar')).toEqual([
      [{ nombre: 'Auxiliar de Cartera', codigo: 'auxiliar_de_cartera', descripcion: null, permisos: [] }],
    ])
    w.unmount()
  })

  it('respeta el código que la persona escribe y lo valida', async () => {
    const w = await abrir()
    const [nombre, codigo] = w.findAll('input')
    await codigo!.setValue('Mal Código')
    await nombre!.setValue('Otro nombre')
    expect((codigo!.element as HTMLInputElement).value).toBe('Mal Código')
    await w.get('form').trigger('submit')
    expect(w.emitted('enviar')).toBeUndefined()
    expect(w.text()).toContain('letras minúsculas')
    w.unmount()
  })

  it('parte de otro rol y omite los permisos que la cuenta no tiene', async () => {
    const w = await abrir({ base: 'r1' })
    expect(w.text()).toContain('Se omitirán 1 permisos')
    await w.findAll('input')[0]!.setValue('Contador junior')
    await w.get('form').trigger('submit')
    expect(w.emitted<[{ permisos: Permiso[] }]>('enviar')![0]![0].permisos).toEqual(['contabilidad.ver'])
    w.unmount()
  })

  it('muestra el error del backend', async () => {
    const w = await abrir({ error: 'Ya existe un rol con ese código.' })
    expect(w.get('[role="alert"]').text()).toContain('Ya existe')
    w.unmount()
  })
})
