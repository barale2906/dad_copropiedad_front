import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { limpiar } from '@/api/tokens'
import { puntosAtencion } from '@/modulos/entidad/api'
import PuntosAtencion from '@/modulos/entidad/componentes/PuntosAtencion.vue'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const PH = '01930000-0000-7000-8000-000000000001'
const boton = (w: ReturnType<typeof mount>, texto: string) => w.findAll('button').find((b) => b.text().includes(texto))!

describe('PuntosAtencion', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('admin', 'x')
  })

  it('cambia el horario de un punto existente (su horario es reactivo)', async () => {
    const w = mount(PuntosAtencion, { props: { copropiedadId: PH, editable: true }, attachTo: document.body })
    await vi.waitFor(() => expect(w.text()).toContain('Lun–Vie'))
    await boton(w, 'Cambiar horario').trigger('click')
    expect(document.body.textContent).toContain('Horario de Oficina de administración')
    await boton(w, 'Quitar la franja 5').trigger('click')
    await w.get('form').trigger('submit')
    await vi.waitFor(() => expect(w.text()).toContain('Lun–Jue'))
    expect((await puntosAtencion(PH))[0]!.horario.franjas).toHaveLength(4)
    w.unmount()
  })

  it('sin permiso de edición solo muestra los puntos', async () => {
    const w = mount(PuntosAtencion, { props: { copropiedadId: PH, editable: false } })
    await vi.waitFor(() => expect(w.text()).toContain('Oficina de administración'))
    expect(w.findAll('button').some((b) => b.text().includes('Cambiar horario'))).toBe(false)
  })
})
