import { beforeEach, describe, expect, it } from 'vitest'
import type { Asignacion, Rol } from '@/api/tipos'
import { limpiar } from '@/api/tokens'
import { asignacionesDe, crearUsuario, listarRoles, listarUsuarios, quitarAsignacion, reenviarCodigo } from '@/api/usuarios'
import { asignacionesVigentes, estadoDeUsuario, nombresDeRoles, textoOrigen, vigente } from '@/formato/usuarios'
import { confirmarImportacion, importarUsuarios } from '@/modulos/entidad/api'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

const E = '01930000-0000-7000-8000-000000000001'

describe('reglas de usuarios', () => {
  it('muestra el estado: bloqueado, pendiente o activo', () => {
    expect(estadoDeUsuario({ estado: 'bloqueada', contrasena_pendiente: true })).toEqual({ texto: 'Bloqueado', tono: 'peligro' })
    expect(estadoDeUsuario({ estado: 'activa', contrasena_pendiente: true }).texto).toBe('Contraseña pendiente')
    expect(estadoDeUsuario({ estado: 'activa', contrasena_pendiente: false }).tono).toBe('exito')
    expect(estadoDeUsuario({ estado: 'eliminada', contrasena_pendiente: false }).texto).toBe('Eliminado')
  })

  const roles = [{ id: 'r1', codigo: 'contador', nombre: 'Contador' }] as Rol[]

  it('traduce códigos de rol a nombres', () => {
    expect(nombresDeRoles(['contador', 'raro'], roles)).toEqual(['Contador', 'raro'])
  })

  it('solo las asignaciones vigentes y manuales se pueden quitar', () => {
    const base = { cuenta_id: 'c', rol_id: 'r1', vigente_desde: '2026-01-01T00:00:00Z' }
    const lista: Asignacion[] = [
      { ...base, id: 'a', origen: 'manual', vigente_hasta: null },
      { ...base, id: 'b', origen: 'residencia', vigente_hasta: null },
      { ...base, id: 'c', origen: 'manual', vigente_hasta: '2026-02-01T00:00:00Z' },
      { ...base, id: 'd', origen: 'manual', vigente_desde: '2027-01-01T00:00:00Z' },
    ]
    const ahora = new Date('2026-06-01T00:00:00Z')
    expect(asignacionesVigentes(lista, roles, ahora)).toEqual([
      { id: 'a', rol: 'Contador', quitable: true, origen: 'manual' },
      { id: 'b', rol: 'Contador', quitable: false, origen: 'residencia' },
    ])
    expect(vigente(lista[2]!, ahora)).toBe(false)
    expect(textoOrigen('residencia')).toBe('por ser residente')
  })
})

describe('api de usuarios (demo)', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('admin', 'x')
  })

  const rol = async (codigo: string) => (await listarRoles(E)).find((r) => r.codigo === codigo)!.id

  it('lista con búsqueda y paginación por cursor', async () => {
    const todos = await listarUsuarios(E)
    expect(todos.datos.map((u) => u.nombre)).toContain('Pedro Portero')
    expect(todos.datos.find((u) => u.nombre === 'Laura Contadora')?.roles).toEqual(['contador'])
    expect((await listarUsuarios(E, undefined, 'pedro')).datos).toHaveLength(1)
  })

  it('crea una cuenta nueva, vincula una existente y avisa si ya tenía el rol', async () => {
    const contador = await rol('contador')
    const nueva = await crearUsuario(E, { nombre: 'Ana', correo: 'ana@x.co', rol_id: contador }, 'k1')
    expect(nueva.cuenta_nueva).toBe(true)
    const otra = await crearUsuario(E, { nombre: 'Luis', correo: 'luis@otra.dad', rol_id: contador }, 'k2')
    expect(otra).toMatchObject({ cuenta_nueva: false })
    expect(otra.asignacion_id).not.toBeNull()
    const repetida = await crearUsuario(E, { nombre: 'Ana', correo: 'ana@x.co', rol_id: contador }, 'k3')
    expect(repetida).toMatchObject({ cuenta_nueva: false, asignacion_id: null })
  })

  it('un usuario de otra cuenta responde 409', async () => {
    const contador = await rol('contador')
    await expect(crearUsuario(E, { nombre: 'X', correo: 'x@x.co', rol_id: contador, usuario: 'pedro' }, 'k')).rejects.toMatchObject({
      estado: 409,
      codigo: 'conflicto',
    })
  })

  it('reenvía el código solo si la contraseña está pendiente', async () => {
    const { datos } = await listarUsuarios(E)
    const pedro = datos.find((u) => u.contrasena_pendiente)!
    await expect(reenviarCodigo(E, pedro.cuenta_id)).resolves.toBeUndefined()
    const laura = datos.find((u) => u.nombre === 'Laura Contadora')!
    await expect(reenviarCodigo(E, laura.cuenta_id)).rejects.toMatchObject({ codigo: 'validacion' })
  })

  it('quita una asignación y no deja la entidad sin administrador', async () => {
    const { datos } = await listarUsuarios(E)
    const laura = datos.find((u) => u.nombre === 'Laura Contadora')!
    const [suya] = await asignacionesDe(E, laura.cuenta_id)
    await quitarAsignacion(E, suya!.id)
    expect((await listarUsuarios(E, undefined, 'laura')).datos[0]!.roles).toEqual([])
    const admin = datos.find((u) => u.roles.includes('administrador'))!
    const [delAdmin] = await asignacionesDe(E, admin.cuenta_id)
    await expect(quitarAsignacion(E, delAdmin!.id)).rejects.toMatchObject({ estado: 409 })
  })

  it('importa con vista previa: con errores no se aplica; válida se confirma', async () => {
    const mala = new File(['nombre,correo,rol\nAna,ana@x.co,contador\n,sin@x.co,contador\nBeto,beto@x.co,piloto\n'], 'u.csv')
    const previa = await importarUsuarios(E, mala)
    expect(previa.importacion).toMatchObject({ estado: 'con_errores', total_filas: 3, filas_validas: 1 })
    expect(previa.importacion.errores.map((e) => e.fila)).toEqual([3, 4])
    await expect(confirmarImportacion(E, previa.importacion.id, 'k')).rejects.toMatchObject({ codigo: 'conflicto_estado' })

    const buena = await importarUsuarios(E, new File(['nombre,correo,rol\nAna,ana@x.co,contador\nBeto,beto@x.co,porteria\n'], 'u.csv'))
    expect(buena.filas).toEqual([
      { fila: 2, rol: 'contador' },
      { fila: 3, rol: 'porteria' },
    ])
    const aplicada = await confirmarImportacion(E, buena.importacion.id, 'k2')
    expect(aplicada).toMatchObject({ estado: 'aplicada', resumen: { usuarios: 2, cuentas_nuevas: 2 } })
  })

  it('una planilla sin la cabecera esperada se rechaza', async () => {
    await expect(importarUsuarios(E, new File(['a,b\n1,2'], 'x.csv'))).rejects.toMatchObject({ codigo: 'validacion' })
  })
})
