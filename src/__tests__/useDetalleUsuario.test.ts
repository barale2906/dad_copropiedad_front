import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { limpiar } from '@/api/tokens'
import { listarRoles, listarUsuarios } from '@/api/usuarios'
import { useDetalleUsuario } from '@/composables/useDetalleUsuario'
import { useSesion } from '@/stores/sesion'
import { conRespuesta, prepararConDemo } from './ayudantes'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const PH = '01930000-0000-7000-8000-000000000001'

beforeEach(async () => {
  limpiar(false)
  prepararConDemo()
  await useSesion().iniciar('admin', 'x')
})

describe('useDetalleUsuario', () => {
  it('carga los roles vigentes, quita uno y avisa el cambio', async () => {
    const roles = await listarRoles(PH)
    const laura = (await listarUsuarios(PH, undefined, 'laura')).datos[0]!
    const alCambio = vi.fn()
    const d = effectScope().run(() => useDetalleUsuario(() => PH, () => roles, alCambio))!
    d.abrir(laura)
    await vi.waitFor(() => expect(d.estado).toBe('listo'))
    expect(d.asignaciones.map((a) => a.rol)).toEqual(['Contador'])
    expect(await d.quitar(d.asignaciones[0]!.id)).toBe(true)
    expect(alCambio).toHaveBeenCalled()
    expect(d.asignaciones).toEqual([])
  })

  it('el código se reenvía solo si la contraseña está pendiente; los errores quedan visibles', async () => {
    const roles = await listarRoles(PH)
    const { datos } = await listarUsuarios(PH)
    const pedro = datos.find((u) => u.contrasena_pendiente)!
    const laura = datos.find((u) => !u.contrasena_pendiente && u.nombre.startsWith('Laura'))!
    const d = effectScope().run(() => useDetalleUsuario(() => PH, () => roles, () => undefined))!
    d.abrir(pedro)
    await d.reenviar()
    expect(d.codigoEnviado).toBe(true)
    d.abrir(laura)
    expect(d.codigoEnviado).toBe(false)
    await d.reenviar()
    expect(d.errorReenviar).toBeTruthy()
    expect(await d.quitar('no-existe')).toBe(false)
    expect(d.errorQuitar).toBeTruthy()
  })

  it('si las asignaciones no cargan, queda en error', async () => {
    conRespuesta('GET', /\/asignaciones$/, () => new Response(null, { status: 500 }))
    const d = effectScope().run(() => useDetalleUsuario(() => PH, () => [], () => undefined))!
    d.abrir({ cuenta_id: 'c', nombre: 'X', estado: 'activa', contrasena_pendiente: false, roles: [] })
    await vi.waitFor(() => expect(d.estado).toBe('error'))
    expect(d.error).toBeTruthy()
  })
})
