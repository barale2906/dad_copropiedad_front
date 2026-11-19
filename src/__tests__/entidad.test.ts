import { beforeEach, describe, expect, it } from 'vitest'
import { iniciarCliente } from '@/api/cliente'
import type { FichaEntidad } from '@/api/tipos'
import { limpiar } from '@/api/tokens'
import { fetchDemo } from '@/mocks/demo'
import { useEntidad, ZONA_HORARIA_PREDETERMINADA } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { API, conCapacidades, conRespuesta, ENTIDAD_PH, prepararConDemo } from './ayudantes'

/** Inicia sesión en el demo y devuelve el id de la entidad con ese nombre. */
async function conSesion(nombre: RegExp): Promise<string> {
  const s = useSesion()
  await s.iniciar('admin', 'x')
  return s.entidades.find((e) => nombre.test(e.nombre))!.entidad_id
}

describe('useEntidad', () => {
  beforeEach(() => {
    limpiar(false)
    prepararConDemo()
  })

  it('sin capacidades no está en modo soporte', () => {
    expect(useEntidad().modoSoporte).toBe(false)
  })

  it('refleja el modo soporte que entregan las capacidades', () => {
    const e = conCapacidades({ tipo: 'empresa', modulos: [], permisos: [], modo_soporte: true })
    expect(e.modoSoporte).toBe(true)
    conCapacidades({ tipo: 'empresa', modulos: [], permisos: [] })
    expect(e.modoSoporte).toBe(false)
  })

  it('sabe si la entidad está suspendida por las capacidades o por su estado', () => {
    const e = conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] })
    expect(e.suspendida).toBe(false)
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [], entidad_suspendida: true })
    expect(e.suspendida).toBe(true)
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] }, { ...ENTIDAD_PH, estado: 'suspendida' })
    expect(e.suspendida).toBe(true)
  })

  it('distingue la PH de la empresa y de la plataforma', () => {
    const e = conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] })
    expect(e.esPH).toBe(true)
    conCapacidades({ tipo: 'plataforma', modulos: [], permisos: [] })
    expect(e.esPH).toBe(false)
  })

  it('consulta los roles de la cuenta en la entidad activa', () => {
    const e = useEntidad()
    expect(e.tieneRol('administrador')).toBe(false)
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] }, {
      ...ENTIDAD_PH,
      roles: ['administrador', 'propietario'],
    })
    expect(e.tieneRol('propietario')).toBe(true)
    expect(e.tieneRol('residente')).toBe(false)
  })

  it('al entrar carga la ficha y toma su zona horaria', async () => {
    const id = await conSesion(/Los Robles/)
    const e = useEntidad()
    await e.entrar(id)
    expect(e.ficha?.nombre).toBe('Conjunto Residencial Los Robles')
    expect(e.zonaHoraria).toBe('America/Bogota')
  })

  it('sin permiso para ver la ficha no la pide y toma la zona de las capacidades', async () => {
    const pedidas: string[] = []
    iniciarCliente(API, async (r) => {
      pedidas.push(new URL(r.url).pathname)
      const res = await fetchDemo(r)
      if (!new URL(r.url).pathname.endsWith('/capacidades')) return res
      return Response.json({ ...(await res.json()), zona_horaria: 'America/Lima' })
    })
    // El consejero de Torres del Parque no tiene `copropiedad.datos.ver`.
    const id = await conSesion(/Torres del Parque/)
    const e = useEntidad()
    await e.entrar(id)
    expect(e.ficha).toBeNull()
    expect(e.zonaHoraria).toBe('America/Lima')
    expect(pedidas.some((p) => p.endsWith(`/entidades/${id}`))).toBe(false)
  })

  it('la ficha recién editada manda sobre la zona de las capacidades', () => {
    const e = conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [], zona_horaria: 'America/Lima' })
    expect(e.zonaHoraria).toBe('America/Lima')
    e.ficha = { zona_horaria: 'America/Mexico_City' } as FichaEntidad
    expect(e.zonaHoraria).toBe('America/Mexico_City')
  })

  it('si la ficha falla, entra igual con la zona de las capacidades', async () => {
    conRespuesta('GET', /^\/entidades\/[^/]+$/, () => new Response(null, { status: 500 }))
    const id = await conSesion(/Los Robles/)
    const e = useEntidad()
    await e.entrar(id)
    expect(e.activa?.entidad_id).toBe(id)
    expect(e.ficha).toBeNull()
    expect(e.zonaHoraria).toBe('America/Bogota')
  })

  it('sin entidad usa la zona predeterminada', () => {
    expect(useEntidad().zonaHoraria).toBe(ZONA_HORARIA_PREDETERMINADA)
  })

  it('salir olvida la entidad, sus capacidades y su ficha', async () => {
    const e = useEntidad()
    await e.entrar(await conSesion(/Los Robles/))
    e.salir()
    expect(e.activa).toBeNull()
    expect(e.capacidades).toBeNull()
    expect(e.ficha).toBeNull()
  })
})
