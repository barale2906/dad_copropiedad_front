import { beforeEach, describe, expect, it } from 'vitest'
import type { CoincidenciaMesa } from '@/api/tipos'
import { limpiar } from '@/api/tokens'
import { bienesDemo } from '@/mocks/unidades'
import * as a from '@/modulos/asambleas/api'
import {
  accionesReunion,
  antelacionSuficiente,
  bienesDelRepresentante,
  coeficienteDe,
  constanciaEntregada,
  estadoConstancia,
  mesaAbierta,
  porcentajeUnidades,
  preparable,
  resumenBienes,
  superaUmbral,
  umbralQuorum,
} from '@/modulos/asambleas/reglas'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const vid = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`

describe('reglas de las asambleas', () => {
  const todo = { convocar: true, conducir: true }
  it('ofrece las acciones del diagrama de estados', () => {
    expect(accionesReunion('borrador', todo)).toEqual(['cancelar'])
    expect(accionesReunion('convocada', todo)).toEqual(['abrir_registro', 'cancelar'])
    expect(accionesReunion('en_registro', todo)).toEqual(['instalar', 'cancelar'])
    expect(accionesReunion('instalada', todo)).toEqual(['suspender', 'cerrar'])
    expect(accionesReunion('suspendida', todo)).toEqual(['reanudar', 'cerrar'])
    expect(accionesReunion('cerrada', todo)).toEqual([])
    expect(accionesReunion('en_registro', { convocar: false, conducir: false })).toEqual([])
    expect(accionesReunion('convocada', { convocar: true, conducir: false })).toEqual(['cancelar'])
  })

  it('solo se prepara en borrador; la mesa abre desde el registro hasta el cierre', () => {
    expect(preparable('borrador')).toBe(true)
    expect(preparable('convocada')).toBe(false)
    expect(mesaAbierta('en_registro')).toBe(true)
    expect(mesaAbierta('suspendida')).toBe(true)
    expect(mesaAbierta('convocada')).toBe(false)
  })

  it('las ordinarias exigen 15 días de antelación (art. 39)', () => {
    expect(antelacionSuficiente('ordinaria', '2026-11-17', '2026-12-02')).toBe(true)
    expect(antelacionSuficiente('ordinaria', '2026-11-17', '2026-12-01')).toBe(false)
    expect(antelacionSuficiente('extraordinaria', '2026-11-17', '2026-11-18')).toBe(true)
    expect(antelacionSuficiente('extraordinaria', '2026-11-17', '2026-11-16')).toBe(false)
  })

  it('umbral de quórum: más de la mitad solo en primera convocatoria (art. 45)', () => {
    expect(umbralQuorum('primera')).toBe('50')
    expect(umbralQuorum('segunda')).toBeNull()
    expect(umbralQuorum('derecho_propio')).toBeNull()
    expect(superaUmbral('50.00', '50')).toBe(false)
    expect(superaUmbral('50.01', '50')).toBe(true)
    expect(superaUmbral('10', null)).toBe(true)
    expect(porcentajeUnidades(22, 40)).toBe('55.0')
    expect(porcentajeUnidades(0, 0)).toBe('0')
  })

  it('el representante se registra con sus bienes libres, sin repetir', () => {
    const c = (b: string, otros: string[], ocupado: string | null = null) => ({ bien_privado_id: b, otros_bienes: otros, asistente_actual: ocupado }) as CoincidenciaMesa
    expect(bienesDelRepresentante(c('a', ['b', 'a', 'c']))).toEqual(['a', 'b', 'c'])
    expect(bienesDelRepresentante(c('a', ['b', 'c']), [c('b', [], 'x')])).toEqual(['a', 'c'])
  })

  it('suma coeficientes con decimales exactos y resume los bienes', () => {
    const asis = { bienes: [
      { bien_privado_id: '1', codigo: 'T1-101', coeficiente: '0.01234567', calidad: 'propietario', moroso: false },
      { bien_privado_id: '2', codigo: 'T1-102', coeficiente: '0.02000001', calidad: 'apoderado', moroso: true },
    ] } as Parameters<typeof coeficienteDe>[0]
    expect(coeficienteDe(asis)).toBe('0.03234568')
    expect(coeficienteDe({ bienes: [] })).toBe('0')
    expect(resumenBienes(asis)).toBe('T1-101, T1-102 (poder) (mora)')
  })

  it('el acuse de WhatsApp manda sobre el estado del envío', () => {
    expect(estadoConstancia({ estado_envio: 'enviado', acuse: 'read' })).toEqual({ texto: 'Leído', tono: 'exito' })
    expect(estadoConstancia({ estado_envio: 'enviado', acuse: 'failed' }).tono).toBe('peligro')
    expect(estadoConstancia({ estado_envio: 'fallido' }).texto).toBe('No se pudo enviar')
    expect(estadoConstancia({ estado_envio: 'raro' }).texto).toBe('raro')
    expect(constanciaEntregada({ acuse: 'delivered' })).toBe(true)
    expect(constanciaEntregada({ acuse: 'sent' })).toBe(false)
  })
})

describe('asambleas contra el demo', { timeout: 25_000 }, () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('uno', 'x')
    await useEntidad().entrar(PH)
  })

  it('prepara y convoca: orden del día obligatorio y 15 días de antelación', async () => {
    const pronto = new Date(Date.now() + 5 * 86_400_000).toISOString()
    const r = await a.crearReunion(PH, { titulo: 'Ordinaria 2028', tipo: 'ordinaria', modalidad: 'presencial', fecha_programada: pronto }, 'k1')
    await expect(a.convocar(PH, r.id, { whatsapp: true, correo: true })).rejects.toMatchObject({ estado: 422 })
    const p = await a.crearPunto(PH, r.id, 1, 'Quórum', null)
    await expect(a.crearPunto(PH, r.id, 1, 'Repetido', null)).rejects.toMatchObject({ estado: 409 })
    await expect(a.convocar(PH, r.id, { whatsapp: true, correo: true })).rejects.toMatchObject({ estado: 422 })
    const lejos = new Date(Date.now() + 30 * 86_400_000).toISOString()
    await a.editarReunion(PH, r.id, { datos: { titulo: 'Ordinaria 2028', tipo: 'ordinaria', modalidad: 'presencial', fecha_programada: lejos } })
    expect((await a.editarPunto(PH, r.id, { ...p, titulo: 'Verificación del quórum' })).titulo).toBe('Verificación del quórum')
    const c = await a.convocar(PH, r.id, { whatsapp: true, correo: false })
    expect(c.reunion.estado).toBe('convocada')
    expect(c.bienes_padron).toBe(40)
    await expect(a.editarReunion(PH, r.id, { datos: { titulo: 'X', tipo: 'ordinaria', modalidad: 'virtual', fecha_programada: lejos } })).rejects.toMatchObject({ estado: 409 })
    await expect(a.crearPunto(PH, r.id, 2, 'Tarde', null)).rejects.toMatchObject({ estado: 409 })
    expect((await a.constancias(PH, r.id)).length).toBeGreaterThan(0)
  })

  it('la mesa registra en un toque y no deja un bien en dos asistentes', async () => {
    const R = vid(4003)
    const [c] = await a.buscarEnMesa(PH, R, 'T1-401')
    expect(c?.codigo).toBe('T1-401')
    const reg = await a.registrarAsistente(PH, R, { persona_id: c!.representante_persona_id, bienes_propios: [c!.bien_privado_id] }, 'k2')
    expect(reg.asistente.bienes.map((b) => b.codigo)).toEqual(['T1-401'])
    await expect(a.registrarAsistente(PH, R, { persona_id: c!.representante_persona_id, bienes_propios: [c!.bien_privado_id] }, 'k3')).rejects.toMatchObject({ estado: 409 })
    expect((await a.buscarEnMesa(PH, R, 'T1-401'))[0]?.asistente_actual).toBe(reg.asistente.id)
    await expect(a.registrarAsistente(PH, R, { nombre: 'Ana', documento: '1', poderes: [{ bien_privado_id: bienesDemo()[20]!.id }] }, 'k4')).rejects.toMatchObject({ estado: 422 })
    const poder = await a.registrarAsistente(PH, R, { nombre: 'Ana', documento: '1', poderes: [{ bien_privado_id: bienesDemo()[20]!.id, soporte_archivo_id: vid(9) }] }, 'k5')
    expect(poder.asistente.bienes[0]?.calidad).toBe('apoderado')
    expect((await a.poderes(PH, R)).filter((p) => p.estado === 'pendiente')).toHaveLength(2)
  })

  it('salidas, reingresos, rótulos y revisión de poderes', async () => {
    const R = vid(4003)
    const asis = vid(4301)
    expect((await a.salida(PH, R, asis, 'se_retiro')).presente).toBe(false)
    await expect(a.salida(PH, R, asis, 'se_retiro')).rejects.toMatchObject({ estado: 409 })
    expect((await a.reingreso(PH, R, asis)).presente).toBe(true)
    await a.asignarRotulo(PH, R, asis, 'ASM-0001')
    await expect(a.asignarRotulo(PH, R, vid(4302), 'ASM-0001')).rejects.toMatchObject({ estado: 409 })
    expect((await a.asignarRotulo(PH, R, asis, null)).rotulo).toBeNull()
    const rechazado = await a.revisarPoder(PH, R, vid(4351), 'rechazado', 'Sin firma')
    expect(rechazado.estado).toBe('rechazado')
    await expect(a.revisarPoder(PH, R, vid(4351), 'verificado')).rejects.toMatchObject({ estado: 409 })
    expect((await a.asistentes(PH, R)).find((x) => x.id === vid(4304))?.bienes).toEqual([])
  })

  it('sin quórum no se instala y se convoca la segunda reunión; con quórum se conduce', async () => {
    const R = vid(4003)
    const t = await a.tablero(PH, R)
    expect(t.hay_quorum).toBe(false)
    expect(t.quorum.unidades_presentes).toBe(4)
    await expect(a.transicionReunion(PH, R, 'instalar')).rejects.toMatchObject({ codigo: 'conflicto' })
    await expect(a.transicionReunion(PH, R, 'cancelar')).rejects.toMatchObject({ estado: 422 })
    const segunda = await a.segundaConvocatoria(PH, R, { whatsapp: true, correo: true })
    expect(segunda.reunion.convocatoria).toBe('segunda')
    expect((await a.detalleReunion(PH, R)).reunion.estado).toBe('cancelada')

    const I = vid(4004)
    const vivo = await a.tablero(PH, I)
    expect(vivo.hay_quorum).toBe(true)
    expect(vivo.punto_en_curso).toBe('Aprobación de estados financieros')
    expect((await a.fotoQuorum(PH, I)).porcentaje_coeficiente).toBe('55.00')
    expect((await a.estadoPunto(PH, I, vid(4043), 'en_curso')).estado).toBe('en_curso')
    expect((await a.detalleReunion(PH, I)).puntos.find((p) => p.id === vid(4042))?.estado).toBe('aplazado')
    expect((await a.transicionReunion(PH, I, 'suspender')).estado).toBe('suspendida')
    await expect(a.estadoPunto(PH, I, vid(4043), 'terminado')).rejects.toMatchObject({ codigo: 'conflicto_estado' })
    expect((await a.transicionReunion(PH, I, 'reanudar')).estado).toBe('instalada')
    expect((await a.transicionReunion(PH, I, 'cerrar')).estado).toBe('cerrada')
  })

  it('morosos, anexos, lista, actas y rótulos', async () => {
    const C = vid(4002)
    const m = await a.marcarMorosos(PH, C, ['T1-101', 'X-999'])
    expect(m).toEqual({ marcados: 1, no_encontrados: ['X-999'] })
    await expect(a.marcarMorosos(PH, vid(4004), ['T1-101'])).rejects.toMatchObject({ estado: 409 })
    await a.anexarDocumento(PH, C, vid(8), 'presupuesto', 'Presupuesto')
    await a.quitarDocumento(PH, C, vid(8))
    expect((await a.detalleReunion(PH, C)).documentos).toEqual([])
    expect((await a.listarReuniones(PH, undefined, { estado: 'instalada' })).datos.map((r) => r.id)).toEqual([vid(4004)])
    expect((await a.actasPublicadas(PH)).map((r) => r.titulo)).toEqual(['Asamblea ordinaria 2025'])
    expect((await a.transicionReunion(PH, C, 'abrir_registro')).estado).toBe('en_registro')
    expect((await a.quorum(PH, C)).unidades_total).toBe(40)
    const B = vid(4001)
    await a.borrarPunto(PH, B, vid(4012))
    expect((await a.detalleReunion(PH, B)).puntos.map((p) => p.titulo)).toEqual(['Verificación del quórum'])
  })
})
