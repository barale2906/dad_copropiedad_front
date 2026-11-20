import { beforeEach, describe, expect, it } from 'vitest'
import { buscarPersonas } from '@/api/personas'
import type { AutorizacionTratamiento } from '@/api/tipos'
import { limpiar } from '@/api/tokens'
import {
  asignarPorContrato,
  buscarCuenta,
  buscarOrganizacion,
  contratos,
  crearContrato,
  crearOrganizacion,
  terminarContrato,
} from '@/modulos/entidad/api-organizaciones'
import {
  autorizacionesDe,
  datosTratados,
  listarSolicitudes,
  otorgarAutorizacion,
  politicaVigente,
  politicas,
  prorrogarSolicitud,
  publicarPolitica,
  radicarSolicitud,
  responderSolicitud,
  revocarAutorizacion,
  tramitarSolicitud,
} from '@/modulos/entidad/api-proteccion'
import { normalizarNit, tiposConocidos } from '@/formato/organizaciones'
import { accionesDeSolicitud, finalidadesVigentes, plazoVisible, venceEl } from '@/modulos/entidad/proteccion'
import { useSesion } from '@/stores/sesion'
import { conRespuesta, prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'

describe('reglas de protección de datos', () => {
  it('ofrece acciones según el estado y la prórroga es única', () => {
    expect(accionesDeSolicitud({ estado: 'radicada', prorrogada_hasta: null })).toEqual(['tramitar', 'prorrogar', 'responder'])
    expect(accionesDeSolicitud({ estado: 'en_tramite', prorrogada_hasta: '2026-12-01' })).toEqual(['responder'])
    expect(accionesDeSolicitud({ estado: 'respondida' })).toEqual([])
  })

  it('muestra el plazo que calcula el backend en días hábiles', () => {
    expect(plazoVisible({ estado: 'radicada', dias_habiles_restantes: 0 })).toEqual({ texto: 'Vence hoy o venció', tono: 'peligro' })
    expect(plazoVisible({ estado: 'radicada', dias_habiles_restantes: 1 }).texto).toBe('Queda 1 día hábil')
    expect(plazoVisible({ estado: 'radicada', dias_habiles_restantes: 3 })).toEqual({ texto: 'Quedan 3 días hábiles', tono: 'aviso' })
    expect(plazoVisible({ estado: 'radicada', dias_habiles_restantes: 9 }).tono).toBe('info')
    expect(plazoVisible({ estado: 'radicada', dias_habiles_restantes: null }).texto).toBe('Sin plazo')
    expect(plazoVisible({ estado: 'respondida', dias_habiles_restantes: null }).texto).toBe('Respondida')
    expect(venceEl({ vence_el: '2026-11-20', prorrogada_hasta: '2026-11-28' })).toBe('2026-11-28')
    expect(venceEl({ vence_el: '2026-11-20' })).toBe('2026-11-20')
  })

  it('cuenta solo las finalidades no revocadas, sin repetir', () => {
    const a = (finalidad: AutorizacionTratamiento['finalidad'], revocada_en: string | null = null) =>
      ({ finalidad, revocada_en }) as AutorizacionTratamiento
    expect(finalidadesVigentes([a('administracion'), a('administracion'), a('publicidad', '2026-01-01T00:00:00Z')])).toEqual(['administracion'])
  })

  it('normaliza el NIT y filtra tipos desconocidos', () => {
    expect(normalizarNit('900.123.456-8')).toBe('900123456-8')
    expect(normalizarNit(' 900123456 ')).toBe('900123456')
    expect(normalizarNit('abc')).toBeNull()
    expect(tiposConocidos(['seguridad', 'nuevo_tipo'])).toEqual(['seguridad'])
  })
})

describe('api de protección de datos (demo)', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('admin', 'x')
  })

  it('publica una versión nueva de la política y la vigente cambia', async () => {
    expect((await politicaVigente(PH))?.version).toBe(1)
    const nueva = await publicarPolitica(PH, { texto: 'Versión 2' }, 'k1')
    expect(nueva.version).toBe(2)
    expect((await politicas(PH)).map((p) => p.version)).toEqual([2, 1])
    expect((await politicaVigente(PH))?.version).toBe(2)
    await expect(publicarPolitica(PH, {}, 'k2')).rejects.toMatchObject({ estado: 422 })
  })

  it('sin política la vigente es null', async () => {
    conRespuesta('GET', /\/proteccion-datos\/politica$/, () => new Response('null', { headers: { 'Content-Type': 'application/json' } }))
    expect(await politicaVigente(PH)).toBeNull()
  })

  it('filtra solicitudes por estado y por vencidas', async () => {
    expect((await listarSolicitudes(PH, undefined)).datos).toHaveLength(3)
    expect((await listarSolicitudes(PH, undefined, { estado: 'respondida' })).datos).toHaveLength(1)
    const hoy = new Date().toISOString().slice(0, 10)
    expect((await listarSolicitudes(PH, undefined, { vencenHasta: hoy })).datos.map((s) => s.tipo)).toEqual(['consulta'])
  })

  it('radica, tramita, prorroga una vez y responde', async () => {
    const [p] = (await buscarPersonas(PH, 'lucia')).datos
    expect(p?.nombre).toBe('Lucía Gómez')
    const s = await radicarSolicitud(PH, { persona_id: p!.id, tipo: 'consulta' }, 'k1')
    expect(s.estado).toBe('radicada')
    expect((await tramitarSolicitud(PH, s.id)).estado).toBe('en_tramite')
    await expect(tramitarSolicitud(PH, s.id)).rejects.toMatchObject({ estado: 409 })
    expect((await prorrogarSolicitud(PH, s.id, 'Falta información')).prorrogada_hasta).toBeTruthy()
    await expect(prorrogarSolicitud(PH, s.id, 'Otra vez')).rejects.toMatchObject({ estado: 422 })
    await expect(responderSolicitud(PH, s.id, {})).rejects.toMatchObject({ estado: 422 })
    expect((await responderSolicitud(PH, s.id, { respuesta: 'Listo' })).estado).toBe('respondida')
  })

  it('otorga y revoca autorizaciones y consulta los datos tratados', async () => {
    const [p] = (await buscarPersonas(PH, '79876543')).datos
    expect(await autorizacionesDe(PH, p!.id)).toEqual([])
    await otorgarAutorizacion(PH, p!.id, { finalidades: ['administracion', 'comunicaciones'], medio: 'escrito' }, 'k1')
    expect(finalidadesVigentes(await autorizacionesDe(PH, p!.id)).sort()).toEqual(['administracion', 'comunicaciones'])
    expect(await revocarAutorizacion(PH, p!.id, ['comunicaciones'])).toBe(1)
    const d = await datosTratados(PH, p!.id)
    expect(d.persona.nombre).toBe('Pedro Pérez')
    expect(d.autorizaciones).toHaveLength(2)
  })
})

describe('api de organizaciones (demo)', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('admin', 'x')
  })

  it('busca por NIT exacto; si no existe la crea y no la duplica', async () => {
    expect((await buscarOrganizacion(PH, '900123456-8'))?.razon_social).toBe('Seguridad Total Ltda.')
    expect(await buscarOrganizacion(PH, '800111222-3')).toBeNull()
    const nueva = { nit: '800111222-3', razon_social: 'Aseo Brillante', naturaleza: 'juridica' as const, tipos: ['aseo' as const] }
    const r = await crearOrganizacion(PH, nueva, 'k1')
    expect(r.creada).toBe(true)
    expect(await crearOrganizacion(PH, nueva, 'k2')).toEqual({ id: r.id, creada: false })
  })

  it('un error distinto de 404 en la búsqueda se propaga', async () => {
    conRespuesta('GET', /\/organizaciones$/, () => new Response(null, { status: 500 }))
    await expect(buscarOrganizacion(PH, '900123456-8')).rejects.toMatchObject({ estado: 500 })
  })

  it('vincula, asigna personal y termina el contrato', async () => {
    const c = await crearContrato(PH, { organizacion_id: 'org', tipo_servicio: 'aseo', valor: '1000.00' }, 'k1')
    expect(c.estado).toBe('vigente')
    expect((await contratos(PH)).length).toBe(2)
    const a = await asignarPorContrato(PH, c.id, { cuenta_id: 'cta', rol_id: 'rol' }, 'k2')
    expect(a.origen).toBe('contrato_servicio')
    expect(await terminarContrato(PH, c.id)).toBe(2)
    await expect(asignarPorContrato(PH, c.id, { cuenta_id: 'cta', rol_id: 'rol' }, 'k3')).rejects.toMatchObject({ estado: 409 })
  })

  it('encuentra cuentas solo por usuario o correo exactos', async () => {
    expect(await buscarCuenta(PH, ' Carlos@Seguridad.co ')).toEqual({ id: expect.any(String), nombre: 'Carlos Vigilante' })
    expect(await buscarCuenta(PH, 'carl')).toBeNull()
  })
})
