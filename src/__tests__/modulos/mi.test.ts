import { beforeEach, describe, expect, it } from 'vitest'
import type { Ticket, Visita } from '@/api/tipos'
import { limpiar } from '@/api/tokens'
import { accionesVisibles, SECCIONES } from '@/escena/mapa-modulos'
import * as mi from '@/modulos/mi/api'
import { accionesDelSolicitante, esperaRespuesta, qrVigente, situacionCartera } from '@/modulos/mi/reglas'
import { useComunicadosPendientes } from '@/stores/comunicados'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { conCapacidades, ENTIDAD_PH, prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const T1_101 = '01930000-0000-7000-8000-000000007001'
const T1_102 = '01930000-0000-7000-8000-000000007002'

describe('acciones por vínculo', () => {
  const consulta = (roles: string[], modulos: string[] = []) => ({
    tieneModulo: (m: string) => modulos.includes(m),
    tienePermiso: () => false,
    tieneRol: (r: string) => roles.includes(r),
    esPH: true,
  })
  const ids = (c: ReturnType<typeof consulta>) => accionesVisibles(SECCIONES.mi!, c as never).map((a) => a.id)

  it('se muestran por el rol propietario o residente, no por permisos', () => {
    expect(ids(consulta([]))).toEqual([])
    expect(ids(consulta(['residente']))).toEqual(['inicio', 'bienes', 'privacidad'])
    expect(ids(consulta(['propietario'], ['contabilidad_ph', 'gestion_administrativa', 'control_acceso']))).toEqual([
      'inicio', 'bienes', 'cartera', 'comunicados', 'pqrs', 'visitas', 'privacidad',
    ])
  })

  it('sin tieneRol en la consulta no se muestran', () => {
    const c = { tieneModulo: () => true, tienePermiso: () => true, esPH: true }
    expect(accionesVisibles(SECCIONES.mi!, c)).toEqual([])
  })

  it('quien solo tiene vínculo se reconoce para entrar a «Mi hogar»', () => {
    prepararConDemo()
    const e = conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] }, { ...ENTIDAD_PH, roles: ['propietario', 'residente'] })
    expect(e.soloVinculo).toBe(true)
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] }, { ...ENTIDAD_PH, roles: ['propietario', 'administrador'] })
    expect(e.soloVinculo).toBe(false)
    conCapacidades({ tipo: 'propiedad_horizontal', modulos: [], permisos: [] }, { ...ENTIDAD_PH, roles: [] })
    expect(e.soloVinculo).toBe(false)
  })
})

describe('reglas del portal', () => {
  const t = (x: Partial<Ticket>) => ({ estado: 'en_progreso', encuesta: null, reabrible_hasta: null, ...x }) as Ticket
  it('el solicitante responde mientras se atiende; califica, cierra o reabre al resolverse', () => {
    expect(accionesDelSolicitante(t({}))).toEqual({ responder: true, calificar: false, cerrar: false, reabrir: false })
    const ahora = new Date('2026-11-17T00:00:00Z')
    expect(accionesDelSolicitante(t({ estado: 'resuelto', reabrible_hasta: '2026-11-20T00:00:00Z' }), ahora)).toEqual({ responder: false, calificar: true, cerrar: true, reabrir: true })
    expect(accionesDelSolicitante(t({ estado: 'resuelto', reabrible_hasta: '2026-11-10T00:00:00Z' }), ahora).reabrir).toBe(false)
    expect(accionesDelSolicitante(t({ estado: 'cerrado', encuesta: { calificacion: 5 } })).calificar).toBe(false)
    expect(accionesDelSolicitante(t({ estado: 'rechazado' })).responder).toBe(false)
  })

  const v = (x: Partial<Visita>) => ({ origen: 'anuncio_porteria', estado: 'anunciada', usos: 0, usos_permitidos: 1, ventana_hasta: null, ...x }) as Visita
  it('reconoce las visitas por responder y los QR vigentes', () => {
    expect(esperaRespuesta(v({}))).toBe(true)
    expect(esperaRespuesta(v({ estado: 'requiere_llamada' }))).toBe(true)
    expect(esperaRespuesta(v({ estado: 'autorizada' }))).toBe(false)
    const ahora = new Date('2026-11-17T00:00:00Z')
    const pre = v({ origen: 'preautorizada', estado: 'autorizada', ventana_hasta: '2026-11-18T00:00:00Z', usos_permitidos: 2, usos: 1 })
    expect(qrVigente(pre, ahora)).toBe(true)
    expect(qrVigente({ ...pre, usos: 2 }, ahora)).toBe(false)
    expect(qrVigente({ ...pre, ventana_hasta: '2026-11-16T00:00:00Z' }, ahora)).toBe(false)
  })

  it('describe la situación de la cartera', () => {
    expect(situacionCartera({ saldo: '100', vencido: '50' }).texto).toBe('En mora')
    expect(situacionCartera({ saldo: '100', vencido: '0' }).texto).toBe('Con saldo por pagar')
    expect(situacionCartera({ saldo: '0', vencido: '0' }).tono).toBe('exito')
  })
})

describe('portal contra el demo', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('residente', 'x')
    await useEntidad().entrar(PH)
  })

  it('el residente entra con vínculo y capacidades de autoservicio', () => {
    const e = useEntidad()
    expect(e.soloVinculo).toBe(true)
    expect(e.tienePermiso('acceso.visitantes.autorizar')).toBe(true)
    expect(e.tienePermiso('reservas.aprobar')).toBe(false)
  })

  it('paz y salvo: 409 con deuda; sin deuda entrega código y PDF', async () => {
    const e = await mi.estadoCuenta(PH, T1_101)
    expect(Number(e.vencido)).toBeGreaterThan(0)
    await expect(mi.pedirPazYSalvo(PH, T1_101)).rejects.toMatchObject({ estado: 409, codigo: 'conflicto' })
    const p = await mi.pedirPazYSalvo(PH, T1_102)
    expect(p.codigo).toBeTruthy()
    expect(atob(p.pdf_base64)).toContain('%PDF')
    expect(await mi.cuentasCobro(PH, T1_101)).toHaveLength(2)
    expect((await mi.bienesCartera(PH)).map((b) => b.codigo)).toEqual(['T1-101', 'T1-102'])
    await expect(mi.estadoCuenta(PH, 'otro')).rejects.toMatchObject({ estado: 404 })
  })

  it('abrir un comunicado registra la lectura; «Enterado» solo si lo pide', async () => {
    const pendientes = useComunicadosPendientes()
    expect(pendientes.aplica()).toBe(true)
    await pendientes.actualizar()
    expect(pendientes.cantidad).toBe(1)
    const { datos } = await mi.misComunicados(PH)
    const nuevo = datos.find((c) => !c.leido_en)!
    const abierto = await mi.abrirComunicado(PH, nuevo.comunicado.id)
    expect(abierto.enlaces_adjuntos).toHaveLength(1)
    expect((await mi.marcarEnterado(PH, nuevo.comunicado.id)).enterado_en).toBeTruthy()
    await pendientes.actualizar()
    expect(pendientes.cantidad).toBe(0)
    const otro = datos.find((c) => !c.comunicado.requiere_confirmacion)!
    await expect(mi.marcarEnterado(PH, otro.comunicado.id)).rejects.toMatchObject({ estado: 409 })
  })

  it('radica una PQRS, responde, califica y cierra la resuelta', async () => {
    const t = await mi.radicarTicket(PH, { tipo: 'queja', asunto: 'Ruido', descripcion: 'Fiesta hasta tarde' }, 'k1')
    expect((await mi.misTickets())[0]?.ticket_id).toBe(t.id)
    await expect(mi.radicarTicket(PH, { tipo: 'queja', asunto: ' ', descripcion: 'x' }, 'k2')).rejects.toMatchObject({ estado: 422 })
    const lista = await mi.misTickets()
    const espera = lista.find((x) => x.estado === 'en_espera_solicitante')!
    await mi.responderTicket(PH, espera.ticket_id, 'Ya pueden venir', [])
    expect((await mi.detalleTicket(PH, espera.ticket_id)).ticket.estado).toBe('en_progreso')
    const resuelta = lista.find((x) => x.estado === 'resuelto')!
    expect((await mi.calificarTicket(PH, resuelta.ticket_id, 5, null)).encuesta?.calificacion).toBe(5)
    await expect(mi.calificarTicket(PH, resuelta.ticket_id, 4, null)).rejects.toMatchObject({ estado: 409 })
    expect((await mi.cambiarEstadoTicket(PH, resuelta.ticket_id, 'cerrado')).estado).toBe('cerrado')
    expect((await mi.categoriasTicket(PH)).length).toBe(3)
  })

  it('visitas: la primera decisión gana; pre-autoriza con QR', async () => {
    const { datos } = await mi.misVisitas(PH)
    const carlos = datos.find((v) => v.visitante_nombre === 'Carlos Domicilio')!
    expect((await mi.responderVisita(PH, carlos.id, true)).decidida_ahora).toBe(true)
    expect((await mi.responderVisita(PH, carlos.id, false)).decidida_ahora).toBe(false)
    const maria = datos.find((v) => v.visitante_nombre === 'María Visita')!
    const r = await mi.responderVisita(PH, maria.id, false)
    expect(r).toMatchObject({ decidida_ahora: false, visita: { estado: 'autorizada' } })
    const desde = new Date().toISOString()
    const hasta = new Date(Date.now() + 3_600_000).toISOString()
    const pre = await mi.preautorizar(PH, { bien_privado_id: T1_101, tipo: 'visita', visitante_nombre: 'Ana', desde, hasta, usos: 1 }, 'k')
    expect(pre.qr).toContain('DAD1.')
    expect(await mi.qrDeVisita(PH, pre.visita.id)).toContain(pre.visita.id)
    await expect(mi.qrDeVisita(PH, carlos.id)).rejects.toMatchObject({ estado: 409 })
    await expect(mi.preautorizar(PH, { bien_privado_id: T1_101, tipo: 'visita', visitante_nombre: 'X', desde: hasta, hasta: desde, usos: 1 }, 'k2')).rejects.toMatchObject({ estado: 422 })
    expect((await mi.misPaquetes(PH)).datos.filter((p) => p.estado === 'recibida')).toHaveLength(1)
  })

  it('privacidad: mis datos, solicitud propia y publicidad', async () => {
    const d = await mi.misDatos(PH)
    expect(d.persona.nombre).toBe('Titular T1-101')
    expect((await mi.politicaVigente(PH))?.version).toBe(1)
    const s = await mi.radicarMiSolicitud(PH, d.persona.id, 'consulta', null, 'k')
    expect(s.estado).toBe('radicada')
    const p = await mi.autorizacionPublicidad(PH)
    expect(p.autorizada).toBe(false)
    await expect(mi.autorizarPublicidad(PH, 9)).rejects.toMatchObject({ estado: 422 })
    await mi.autorizarPublicidad(PH, p.politica!.version)
    expect((await mi.autorizacionPublicidad(PH)).autorizada).toBe(true)
    await mi.retirarPublicidad(PH)
    expect((await mi.autorizacionPublicidad(PH)).autorizada).toBe(false)
  })

  it('propone cambios del censo de su bien y los ve como propios', async () => {
    const c = await mi.proponerCambio(PH, T1_101, 'mascota', { especie: 'gato', nombre: 'Luna' })
    expect(c.estado).toBe('pendiente')
    expect((await mi.misPropuestas(PH)).some((x) => x.id === c.id)).toBe(true)
    await expect(mi.proponerCambio(PH, '01930000-0000-7000-8000-000000007010', 'mascota', {})).rejects.toMatchObject({ estado: 422 })
    expect((await mi.misReservas(PH)).length).toBeGreaterThan(0)
  })
})
