import { beforeEach, describe, expect, it } from 'vitest'
import { limpiar } from '@/api/tokens'
import * as a from '@/modulos/administracion/api'
import * as mi from '@/modulos/mi/api'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const vid = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`

async function entrarComo(usuario: string) {
  limpiar(false)
  prepararConDemo()
  await useSesion().iniciar(usuario, 'x')
  await useEntidad().entrar(PH)
}

describe('gestión administrativa contra el demo', { timeout: 20_000 }, () => {
  beforeEach(() => entrarComo('admin'))

  it('atiende un ticket: transiciones del backend, motivo obligatorio y nota interna', async () => {
    const d = await a.detalleTicket(PH, vid(3021))
    expect(d.transiciones_permitidas).toEqual(['en_revision', 'en_progreso', 'rechazado', 'duplicado'])
    await expect(a.transicionTicket(PH, vid(3021), 'resuelto', 'x')).rejects.toMatchObject({ codigo: 'conflicto_estado' })
    await a.transicionTicket(PH, vid(3021), 'en_progreso')
    await expect(a.transicionTicket(PH, vid(3021), 'resuelto', '  ')).rejects.toMatchObject({ estado: 422 })
    await a.mensajeTicket(PH, vid(3021), 'Llamé al técnico', true)
    const t = await a.transicionTicket(PH, vid(3021), 'resuelto', 'Se ajustó el ascensor.')
    expect(t.estado).toBe('resuelto')
    expect(t.reabrible_hasta).toBeTruthy()
    const mensajes = (await a.detalleTicket(PH, vid(3021))).mensajes
    expect(mensajes.some((m) => m.interno && m.texto === 'Llamé al técnico')).toBe(true)
    expect(mensajes.at(-1)?.texto).toBe('Se ajustó el ascensor.')
  })

  it('filtra la bandeja, asigna y marca duplicados', async () => {
    expect((await a.listarTickets(PH, undefined, { vencidos: true })).datos.map((t) => t.id)).toEqual([vid(3021)])
    const t = await a.asignarTicket(PH, vid(3031), { cuenta_id: '01930000-0000-7000-8000-00000000c001' })
    expect(t.estado).toBe('asignado')
    expect((await a.listarTickets(PH, undefined, { mios: true })).datos.length).toBe(2)
    await expect(a.transicionTicket(PH, vid(3021), 'duplicado')).rejects.toMatchObject({ estado: 422 })
    expect((await a.transicionTicket(PH, vid(3021), 'duplicado', undefined, vid(3041))).duplicado_de).toBe(vid(3041))
    expect((await a.tableroTickets(PH)).vencidos).toBe(1)
  })

  it('configura plazos y categorías', async () => {
    const c = await a.configuracionTickets(PH)
    await expect(a.guardarConfiguracionTickets(PH, { ...c, jornada_fin: '07:00:00' })).rejects.toMatchObject({ estado: 422 })
    expect((await a.guardarConfiguracionTickets(PH, { ...c, dias_reapertura: 8 })).dias_reapertura).toBe(8)
    await expect(a.crearCategoria(PH, 'plomería', 'k1')).rejects.toMatchObject({ estado: 409 })
    const nueva = await a.crearCategoria(PH, 'Jardinería', 'k2')
    expect((await a.editarCategoria(PH, { ...nueva, activa: false })).activa).toBe(false)
  })

  it('el chat solo responde dentro de las 24 h y se cierra una vez', async () => {
    const m = await a.responderConversacion(PH, vid(3201), 'Sí, está habilitado.')
    expect(m.entrante).toBe(false)
    await expect(a.responderConversacion(PH, vid(3202), 'Hola')).rejects.toMatchObject({ estado: 409 })
    expect((await a.cerrarConversacion(PH, vid(3201))).estado).toBe('cerrada')
    await expect(a.cerrarConversacion(PH, vid(3201))).rejects.toMatchObject({ estado: 409 })
    expect((await a.conversaciones(PH, undefined, { estado: 'abierta' })).datos.map((c) => c.id)).toEqual([vid(3202)])
  })

  it('preguntas frecuentes: crea, edita y valida', async () => {
    await expect(a.crearPregunta(PH, { pregunta: ' ', respuesta: 'x' }, 'k3')).rejects.toMatchObject({ estado: 422 })
    const p = await a.crearPregunta(PH, { pregunta: '¿Hay wifi?', respuesta: 'En el lobby.' }, 'k4')
    expect((await a.editarPregunta(PH, p.id, { pregunta: p.pregunta, respuesta: p.respuesta, activa: false })).activa).toBe(false)
    expect((await a.preguntasFrecuentes(PH)).at(-1)?.id).toBe(p.id)
  })

  it('comunicados: borrador → programado → retirado → enviado; lo enviado no se anula', async () => {
    await expect(a.crearComunicado(PH, { titulo: 'X', cuerpo: 'Y', finalidad: 'administracion', audiencia: { tipo: 'roles', ids: [] } }, 'k5')).rejects.toMatchObject({ estado: 422 })
    const c = await a.crearComunicado(PH, { titulo: 'Corte de luz', cuerpo: 'El martes.', finalidad: 'administracion', audiencia: { tipo: 'todos' } }, 'k6')
    expect(c.estado).toBe('borrador')
    const en = new Date(Date.now() + 86_400_000).toISOString()
    expect((await a.publicarComunicado(PH, c.id, en)).estado).toBe('programado')
    await expect(a.editarComunicado(PH, c.id, { titulo: 'Z', cuerpo: 'Y', finalidad: 'administracion', audiencia: { tipo: 'todos' } })).rejects.toMatchObject({ estado: 409 })
    expect((await a.retirarComunicado(PH, c.id)).estado).toBe('borrador')
    expect((await a.publicarComunicado(PH, c.id, null)).estado).toBe('enviado')
    await expect(a.anularComunicado(PH, c.id)).rejects.toMatchObject({ codigo: 'conflicto_estado' })
    expect((await a.comunicado(PH, c.id)).resumen.destinatarios).toBeGreaterThan(0)
    expect((await a.anularComunicado(PH, vid(3303))).estado).toBe('anulado')
  })

  it('inventario: crea, mueve y la baja exige soporte y es definitiva', async () => {
    await expect(a.crearActivo(PH, { codigo: 'ASC-01', nombre: 'Otro', clase: 'equipo' }, 'k7')).rejects.toMatchObject({ estado: 409 })
    const act = await a.crearActivo(PH, { codigo: 'SIL-01', nombre: 'Sillas', clase: 'mobiliario' }, 'k8')
    await expect(a.registrarMovimiento(PH, act.id, { tipo: 'traslado' }, 'k9')).rejects.toMatchObject({ estado: 422 })
    await a.registrarMovimiento(PH, act.id, { tipo: 'traslado', ubicacion_destino: 'Salón' }, 'k10')
    await expect(a.registrarMovimiento(PH, act.id, { tipo: 'baja' }, 'k11')).rejects.toMatchObject({ estado: 422 })
    await a.registrarMovimiento(PH, act.id, { tipo: 'baja', soporte_archivo_id: vid(1) }, 'k12')
    const h = await a.hojaDeVida(PH, act.id)
    expect(h.activo.estado).toBe('dado_de_baja')
    expect(h.movimientos.map((m) => m.tipo)).toEqual(['baja', 'traslado'])
    await expect(a.editarActivo(PH, act.id, { estado: 'operativo' })).rejects.toMatchObject({ estado: 409 })
    expect((await a.listarActivos(PH, undefined, { q: 'ascensor' })).datos.map((x) => x.codigo)).toEqual(['ASC-01'])
  })

  it('órdenes: el checklist se diligencia y quien ejecutó no verifica', async () => {
    await a.avanzarOrden(PH, vid(3601), { accion: 'iniciar' })
    await expect(a.avanzarOrden(PH, vid(3601), { accion: 'ejecutar', checklist: [] })).rejects.toMatchObject({ estado: 422 })
    const o = await a.avanzarOrden(PH, vid(3601), {
      accion: 'ejecutar',
      checklist: [{ descripcion: 'Lubricar guías', cumplido: true }, { descripcion: 'Probar frenos', cumplido: true }],
      costo_mano_obra: '50000',
    })
    expect(o.ejecutada_por).toBe('01930000-0000-7000-8000-00000000c001')
    await expect(a.avanzarOrden(PH, vid(3601), { accion: 'verificar', aprobada: true })).rejects.toMatchObject({ codigo: 'conflicto' })
    await expect(a.avanzarOrden(PH, vid(3602), { accion: 'verificar', aprobada: true })).rejects.toMatchObject({ estado: 409 })
    await expect(a.avanzarOrden(PH, vid(3603), { accion: 'cancelar', motivo: ' ' })).rejects.toMatchObject({ estado: 422 })
    expect((await a.avanzarOrden(PH, vid(3603), { accion: 'cancelar', motivo: 'Lluvia' })).estado).toBe('cancelada')
    await a.agregarEvidencia(PH, vid(3602), vid(2), 'despues')
    expect((await a.detalleOrden(PH, vid(3602))).evidencias).toHaveLength(1)
  })

  it('planes, obligaciones, tablero y alertas', async () => {
    await expect(a.crearPlan(PH, { actividad: 'Fumigar', recurrencia: { frecuencia: 'meses', intervalo: 0, inicio: '2026-12-01' } }, 'k13')).rejects.toMatchObject({ estado: 422 })
    const p = await a.crearPlan(PH, { actividad: 'Fumigar', recurrencia: { frecuencia: 'meses', intervalo: 3, inicio: '2026-12-01' } }, 'k14')
    expect((await a.editarPlan(PH, p.id, { actividad: 'Fumigar', recurrencia: p.recurrencia, activo: false })).activo).toBe(false)
    expect(await a.planes(PH)).toHaveLength(3)

    await expect(a.crearObligacion(PH, { codigo_sugerido: 'lavado_tanques', nombre: 'x', periodicidad_meses: 6, proxima: '2027-01-01' }, 'k15')).rejects.toMatchObject({ estado: 409 })
    const ob = await a.crearObligacion(PH, { codigo_sugerido: 'fumigacion', nombre: 'Fumigación', periodicidad_meses: 3, proxima: '2026-12-01' }, 'k16')
    const manana = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)
    await expect(a.registrarCumplimiento(PH, ob.id, manana, null, null)).rejects.toMatchObject({ estado: 422 })
    const hecho = await a.registrarCumplimiento(PH, ob.id, '2026-11-10', null, 'OK')
    expect(hecho.proxima).toBe('2027-02-10')
    expect(await a.cumplimientos(PH, ob.id)).toHaveLength(1)
    expect((await a.obligacionesSugeridas(PH)).length).toBe(3)

    const alertas = await a.alertasMantenimiento(PH)
    expect(alertas.obligaciones.map((o) => o.nombre)).toContain('Lavado de tanques')
    expect(alertas.garantias.map((x) => x.codigo)).toEqual(['ASC-01'])
    expect((await a.tableroMantenimiento(PH)).ordenes_vencidas).toBe(1)
    expect((await a.alertasCenso(PH)).mascotas.length).toBeGreaterThan(0)
    expect((await a.agrupacionesAudiencia(PH)).map((g) => g.nombre)).toEqual(['Torre 1', 'Torre 2'])
    expect((await a.rolesAudiencia(PH)).length).toBeGreaterThan(0)
  })
})

describe('cuatro ojos con dos cuentas demo', { timeout: 20_000 }, () => {
  it('lo que ejecutó el administrador lo verifica el revisor', async () => {
    await entrarComo('revisor')
    const o = await a.avanzarOrden(PH, vid(3602), { accion: 'verificar', aprobada: true })
    expect(o.estado).toBe('verificada')
    expect(o.verificada_por).toBe('01930000-0000-7000-8000-00000000c002')
  })
})

describe('el residente ve solo sus PQRS y sin notas internas', { timeout: 20_000 }, () => {
  it('filtra tickets, oculta notas y ofrece solo cerrar o reabrir', async () => {
    await entrarComo('residente')
    expect((await mi.misTickets()).map((t) => t.numero)).toEqual(['PQR-2026-03001', 'PQR-2026-03011'])
    const d = await mi.detalleTicket(PH, vid(3001))
    expect(d.mensajes.some((m) => m.interno)).toBe(false)
    expect(d.transiciones_permitidas).toEqual([])
    expect((await mi.detalleTicket(PH, vid(3011))).transiciones_permitidas).toEqual(['cerrado', 'reabierto'])
    await expect(mi.detalleTicket(PH, vid(3021))).rejects.toMatchObject({ estado: 404 })
  })
})
