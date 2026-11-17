import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { limpiar } from '@/api/tokens'
import BuscarCuenta from '@/modulos/entidad/componentes/BuscarCuenta.vue'
import BuscarPersona from '@/modulos/entidad/componentes/BuscarPersona.vue'
import VincularOrganizacion from '@/modulos/entidad/componentes/VincularOrganizacion.vue'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const PH = '01930000-0000-7000-8000-000000000001'
const boton = (w: ReturnType<typeof mount>, texto: string) => w.findAll('button').find((b) => b.text().includes(texto))!

beforeEach(async () => {
  limpiar(false)
  prepararConDemo()
  await useSesion().iniciar('admin', 'x')
  await useEntidad().entrar(PH)
})

describe('BuscarCuenta', () => {
  it('avisa si no hay cuenta y emite la encontrada', async () => {
    const w = mount(BuscarCuenta, { props: { entidadId: PH } })
    await w.get('input').setValue('nadie@x.co')
    await w.get('form').trigger('submit')
    await vi.waitFor(() => expect(w.text()).toContain('No hay una cuenta activa'))
    expect(w.emitted('encontrada')).toBeUndefined()
    await w.get('input').setValue('carlos')
    await w.get('form').trigger('submit')
    await vi.waitFor(() => expect(w.text()).toContain('Carlos Vigilante'))
    expect(w.emitted<[{ nombre: string }]>('encontrada')![0]![0].nombre).toBe('Carlos Vigilante')
  })

  it('sin texto no consulta', async () => {
    const w = mount(BuscarCuenta, { props: { entidadId: PH } })
    await w.get('form').trigger('submit')
    expect(w.text()).not.toContain('No hay una cuenta')
  })
})

describe('BuscarPersona', () => {
  it('busca desde 2 caracteres y emite la persona elegida', async () => {
    const w = mount(BuscarPersona, { props: { copropiedadId: PH } })
    await w.get('input').setValue('m')
    expect(w.findAll('ul button')).toHaveLength(0)
    await w.get('input').setValue('marta')
    await vi.waitFor(() => expect(w.findAll('ul button')).toHaveLength(1))
    await w.get('ul button').trigger('click')
    expect(w.emitted<[{ nombre: string }]>('elegir')![0]![0].nombre).toBe('Marta Residente')
    await w.get('input').setValue('zzzz')
    await vi.waitFor(() => expect(w.text()).toContain('Ninguna persona coincide'))
  })
})

describe('VincularOrganizacion', () => {
  it('valida el NIT, encuentra la existente y registra el contrato', async () => {
    const w = mount(VincularOrganizacion, { props: { copropiedadId: PH } })
    await w.get('input').setValue('abc')
    await w.get('form').trigger('submit')
    expect(w.text()).toContain('Escriba un NIT válido')
    await w.get('input').setValue('900.123.456-8')
    await w.get('form').trigger('submit')
    await vi.waitFor(() => expect(w.text()).toContain('Seguridad Total Ltda.'))
    await w.get('form').trigger('submit')
    await vi.waitFor(() => expect(w.emitted('vinculado')).toHaveLength(1))
  })

  it('si no existe permite registrarla y exige razón social y servicio', async () => {
    const w = mount(VincularOrganizacion, { props: { copropiedadId: PH } })
    await w.get('input').setValue('800111222-3')
    await w.get('form').trigger('submit')
    await vi.waitFor(() => expect(w.text()).toContain('No hay una organización registrada'))
    await boton(w, 'Registrarla').trigger('click')
    await w.get('form').trigger('submit')
    expect(w.text()).toContain('Escriba la razón social.')
    await w.findAll('input')[0]!.setValue('Aseo Brillante')
    await w.get('form').trigger('submit')
    expect(w.text()).toContain('Elija al menos un tipo de servicio.')
    await w.get('input[value="aseo"]').setValue(true)
    await w.get('form').trigger('submit')
    await vi.waitFor(() => expect(w.text()).toContain('Organización: Aseo Brillante'))
  })
})
