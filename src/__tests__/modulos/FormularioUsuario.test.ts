import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Rol } from '@/api/tipos'
import FormularioUsuario from '@/modulos/entidad/componentes/FormularioUsuario.vue'

const ROLES = [{ id: 'r1', codigo: 'contador', nombre: 'Contador' }] as Rol[]

describe('FormularioUsuario', () => {
  it('exige el rol y emite los datos con los opcionales vacíos en null', async () => {
    const w = mount(FormularioUsuario, { props: { roles: ROLES, abierto: true }, attachTo: document.body })
    const [nombre, correo] = w.findAll('input')
    await nombre!.setValue('  Ana Pérez ')
    await correo!.setValue('ana@x.co')
    await w.get('form').trigger('submit')
    expect(w.emitted('enviar')).toBeUndefined()
    expect(w.text()).toContain('Elija el rol del usuario.')
    await w.get('select').setValue('r1')
    await w.get('form').trigger('submit')
    expect(w.emitted('enviar')).toEqual([
      [{ nombre: 'Ana Pérez', correo: 'ana@x.co', rol_id: 'r1', usuario: null, telefono: null, documento: null }],
    ])
    w.unmount()
  })

  it('muestra el error del backend', () => {
    const w = mount(FormularioUsuario, { props: { roles: ROLES, abierto: true, error: 'Ese usuario ya lo usa otra cuenta.' } })
    expect(w.get('[role="alert"]').text()).toContain('otra cuenta')
  })
})
