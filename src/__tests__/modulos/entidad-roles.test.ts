import { beforeEach, describe, expect, it } from 'vitest'
import { ErrorApi } from '@/api/errores'
import type { PermisoDelCatalogo } from '@/api/tipos'
import { limpiar } from '@/api/tokens'
import { cambiarPermisos, catalogoPermisos, crearRol, listarRoles } from '@/api/usuarios'
import {
  agruparPermisos,
  CODIGO_ROL,
  diferencia,
  etiquetaPermiso,
  noOtorgables,
  sugerirCodigo,
} from '@/formato/permisos'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

const E = '01930000-0000-7000-8000-000000000001'

describe('reglas de permisos', () => {
  const catalogo: PermisoDelCatalogo[] = [
    { codigo: 'cartera.ver', ambito: 'copropiedad' },
    { codigo: 'roles.ver', ambito: 'copropiedad' },
    { codigo: 'plataforma.cuentas.ver', ambito: 'plataforma' },
    { codigo: 'censo.ver', ambito: 'copropiedad' },
    { codigo: 'nuevo.permiso', ambito: 'copropiedad' },
    { codigo: 'titulares.ver', ambito: 'copropiedad' },
  ]

  it('agrupa por módulo en el orden del menú y solo el ámbito pedido', () => {
    const grupos = agruparPermisos(catalogo, 'copropiedad')
    expect(grupos.map((g) => g.nombre)).toEqual(['Datos y usuarios', 'Unidades y residentes', 'Cartera', 'Otros'])
    expect(grupos[1]!.permisos.map((p) => p.codigo)).toEqual(['censo.ver', 'titulares.ver'])
    expect(grupos[0]!.permisos[0]).toEqual({ codigo: 'roles.ver', etiqueta: 'Ver usuarios y roles' })
    expect(agruparPermisos(catalogo, 'plataforma').map((g) => g.nombre)).toEqual(['Plataforma'])
    expect(agruparPermisos([], 'copropiedad')).toEqual([])
  })

  it('un permiso que el cliente no conoce se muestra con su código', () => {
    expect(etiquetaPermiso('nuevo.permiso')).toBe('nuevo.permiso')
    expect(etiquetaPermiso('cartera.ver')).toBe('Ver la cartera')
  })

  it('calcula lo agregado y lo quitado', () => {
    expect(diferencia(['cartera.ver', 'censo.ver'], ['censo.ver', 'roles.ver'])).toEqual({
      agregados: ['roles.ver'],
      quitados: ['cartera.ver'],
    })
    expect(diferencia(['censo.ver'], ['censo.ver'])).toEqual({ agregados: [], quitados: [] })
  })

  it('detecta los permisos que la cuenta no puede otorgar', () => {
    expect(noOtorgables(['cartera.ver', 'censo.ver'], (p) => p === 'censo.ver')).toEqual(['cartera.ver'])
  })

  it('propone un código válido a partir del nombre', () => {
    expect(sugerirCodigo('Auxiliar de Cartera')).toBe('auxiliar_de_cartera')
    expect(sugerirCodigo('  Señor  Porteño (noche) ')).toBe('senor_porteno_noche')
    expect(sugerirCodigo('x'.repeat(80))).toHaveLength(60)
    expect(CODIGO_ROL.test('auxiliar_cartera')).toBe(true)
    expect(CODIGO_ROL.test('a')).toBe(false)
    expect(CODIGO_ROL.test('Con Mayúscula')).toBe(false)
  })
})

describe('api de roles (demo)', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('admin', 'x')
  })

  it('trae el catálogo con los dos ámbitos', async () => {
    const c = await catalogoPermisos()
    expect(c.some((p) => p.ambito === 'plataforma')).toBe(true)
    expect(c.some((p) => p.codigo === 'roles.gestionar')).toBe(true)
  })

  it('crea un rol propio y rechaza un código repetido', async () => {
    const rol = await crearRol(E, { codigo: 'vigilante_noche', nombre: 'Vigilante de noche', permisos: ['acceso.registrar'] }, 'k1')
    expect(rol).toMatchObject({ es_plantilla: false, permisos: ['acceso.registrar'] })
    expect((await listarRoles(E)).map((r) => r.codigo)).toContain('vigilante_noche')
    const repetido = crearRol(E, { codigo: 'vigilante_noche', nombre: 'Otro', permisos: [] }, 'k2')
    await expect(repetido).rejects.toMatchObject({ estado: 409, codigo: 'conflicto' })
  })

  it('cambia los permisos de un rol propio, pero no los de una plantilla', async () => {
    const roles = await listarRoles(E)
    const propio = roles.find((r) => !r.es_plantilla)!
    expect((await cambiarPermisos(E, propio.id, ['cartera.ver'])).permisos).toEqual(['cartera.ver'])
    const plantilla = roles.find((r) => r.es_plantilla)!
    const error = await cambiarPermisos(E, plantilla.id, []).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ErrorApi)
    expect(error).toMatchObject({ estado: 409 })
  })
})
