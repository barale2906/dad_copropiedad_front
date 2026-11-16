import { beforeEach, describe, expect, it } from 'vitest'
import { ErrorApi } from '@/api/errores'
import { haySesion, limpiar } from '@/api/tokens'
import { useCuenta } from '@/stores/cuenta'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from './ayudantes'

async function conSesion(usuario = 'admin') {
  await useSesion().iniciar(usuario, 'x')
  return useCuenta()
}

describe('useCuenta', () => {
  beforeEach(() => {
    limpiar(false)
    prepararConDemo()
  })

  it('carga el perfil una sola vez y expone sus datos', async () => {
    const c = await conSesion()
    const p = await c.asegurar()
    expect(p.nombre).toBe('Andrés Administrador')
    expect(c.id).toBe(p.id)
    expect(c.segundoFactorActivo).toBe(false)
    expect(c.permisosPlataforma.size).toBe(0)
    expect(await c.asegurar()).toBe(c.perfil)
  })

  it('activa el segundo factor en dos pasos', async () => {
    const c = await conSesion()
    await c.cargar()
    const i = await c.inscribirSegundoFactor()
    expect(i.uri).toMatch(/^otpauth:\/\/totp\//)
    await expect(c.confirmarSegundoFactor('000000')).rejects.toBeInstanceOf(ErrorApi)
    await c.confirmarSegundoFactor('123456')
    expect(c.segundoFactorActivo).toBe(true)
  })

  it('verifica el correo con el código', async () => {
    const c = await conSesion('sinverificar')
    expect((await c.cargar()).correo_verificado).toBe(false)
    await c.reenviarVerificacion()
    await c.verificarCorreo('123456')
    expect(c.perfil?.correo_verificado).toBe(true)
  })

  it('cambiar la contraseña informa el error del backend', async () => {
    const c = await conSesion()
    await expect(c.cambiarContrasena('mala', 'una-contrasena-larga')).rejects.toMatchObject({ codigo: 'validacion' })
    await expect(c.cambiarContrasena('buena', 'una-contrasena-larga')).resolves.toBeUndefined()
  })

  it('lista y quita dispositivos', async () => {
    const c = await conSesion()
    await c.cargarDispositivos()
    expect(c.dispositivos).toHaveLength(1)
    await c.quitarDispositivo(c.dispositivos[0]!.id)
    expect(c.dispositivos).toHaveLength(0)
  })

  it('cerrar todas las sesiones también cierra la local', async () => {
    const c = await conSesion()
    expect(await c.cerrarTodasLasSesiones()).toBe(3)
    expect(haySesion()).toBe(false)
    expect(useSesion().estado).toBe('anonimo')
  })

  it('limpiar olvida el perfil', async () => {
    const c = await conSesion()
    await c.cargar()
    c.limpiar()
    expect(c.perfil).toBeNull()
  })
})

describe('definir contraseña', () => {
  beforeEach(() => prepararConDemo())

  it('acepta el código correcto y rechaza uno errado', async () => {
    const s = useSesion()
    await expect(s.definirContrasena('a@b.co', '000000', 'contrasena-larga')).rejects.toMatchObject({
      codigo: 'validacion',
    })
    await expect(s.definirContrasena('a@b.co', '123456', 'contrasena-larga')).resolves.toBeUndefined()
  })
})
