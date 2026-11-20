import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Rol } from '@/api/tipos'
import DetalleRol from '@/modulos/entidad/componentes/DetalleRol.vue'
import type { GrupoPermisos } from '@/formato/permisos'
import { conCapacidades, conRespuesta, ENTIDAD_PH, prepararConDemo } from '../ayudantes'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const GRUPOS: GrupoPermisos[] = [
  {
    nombre: 'Cartera',
    permisos: [
      { codigo: 'cartera.ver', etiqueta: 'Ver la cartera' },
      { codigo: 'cartera.ajustar', etiqueta: 'Hacer ajustes de cartera' },
    ],
  },
]
const PROPIO: Rol = { id: 'r9', codigo: 'auxiliar', nombre: 'Auxiliar', ambito: 'copropiedad', es_plantilla: false, permisos: [] }

function montar(rol: Rol, puedeGestionar = true) {
  return mount(DetalleRol, { props: { rol, grupos: GRUPOS, entidadId: ENTIDAD_PH.entidad_id, puedeGestionar } })
}
const boton = (w: ReturnType<typeof montar>, texto: string) => w.findAll('button').find((b) => b.text().includes(texto))!
const casilla = (w: ReturnType<typeof montar>, texto: string) =>
  w.findAll('label').find((l) => l.text().includes(texto))!.get('input')

describe('DetalleRol', () => {
  beforeEach(() => {
    prepararConDemo()
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: ['roles.gestionar', 'cartera.ver'] })
  })

  it('guarda los cambios de un rol propio y emite el rol actualizado', async () => {
    conRespuesta('PUT', /\/roles\/r9\/permisos$/, () =>
      new Response(JSON.stringify({ ...PROPIO, permisos: ['cartera.ver'] }), { headers: { 'Content-Type': 'application/json' } }),
    )
    const w = montar(PROPIO)
    expect(boton(w, 'Guardar permisos').attributes('disabled')).toBeDefined()
    await casilla(w, 'Ver la cartera').setValue(true)
    expect(w.text()).toContain('1 permisos agregados')
    await boton(w, 'Guardar permisos').trigger('click')
    await flushPromises()
    expect(w.emitted<[Rol]>('guardado')![0]![0].permisos).toEqual(['cartera.ver'])
    expect(w.text()).toContain('Permisos guardados.')
  })

  it('una plantilla es de solo lectura y ofrece crear un rol a partir de ella', async () => {
    const w = montar({ ...PROPIO, es_plantilla: true })
    expect(w.text()).toContain('no se editan')
    expect(w.findAll('button').some((b) => b.text().includes('Guardar'))).toBe(false)
    await boton(w, 'Crear un rol a partir de este').trigger('click')
    expect(w.emitted('crearDesde')).toEqual([['r9']])
  })

  it('sin roles.gestionar solo se consulta', () => {
    const w = montar(PROPIO, false)
    expect(w.findAll('button').some((b) => b.text().includes('Guardar'))).toBe(false)
  })

  it('no deja guardar un rol con permisos que la cuenta no tiene', async () => {
    const w = montar({ ...PROPIO, permisos: ['cartera.ajustar'] })
    await casilla(w, 'Ver la cartera').setValue(true)
    expect(w.get('[role="alert"]').text()).toContain('Hacer ajustes de cartera')
    expect(boton(w, 'Guardar permisos').attributes('disabled')).toBeDefined()
    await casilla(w, 'Hacer ajustes de cartera').setValue(false)
    expect(boton(w, 'Guardar permisos').attributes('disabled')).toBeUndefined()
  })

  it('muestra el error del backend y descarta los cambios', async () => {
    conRespuesta('PUT', /\/roles\/r9\/permisos$/, () =>
      new Response(JSON.stringify({ error: { codigo: 'conflicto', mensaje: 'Los roles del sistema no se editan.' } }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const w = montar(PROPIO)
    await casilla(w, 'Ver la cartera').setValue(true)
    await boton(w, 'Guardar permisos').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('no se editan')
    await boton(w, 'Descartar cambios').trigger('click')
    expect((casilla(w, 'Ver la cartera').element as HTMLInputElement).checked).toBe(false)
  })
})
