import { beforeEach, describe, expect, it } from 'vitest'
import type { Visita } from '@/api/tipos'
import { limpiar } from '@/api/tokens'
import { opcionesDe, TIPO_VISITA } from '@/composables/textos-acceso'
import { accionesVisibles, SECCIONES } from '@/escena/mapa-modulos'
import * as p from '@/modulos/porteria/api'
import {
  accionesDeVisita,
  ordenarTurno,
  pideValor,
  rotable,
  textoAlerta,
  textoEvento,
  transcurrido,
  transicionesCredencial,
  visitaAbierta,
} from '@/modulos/porteria/reglas'
import { bienesDemo } from '@/mocks/unidades'
import { usePorteria } from '@/modulos/porteria/store'
import { useBienes } from '@/stores/bienes'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const T1_101 = '01930000-0000-7000-8000-000000007001'
const vid = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`

describe('reglas de la portería', () => {
  it('ofrece los botones según el estado de la visita', () => {
    expect(accionesDeVisita('anunciada')).toEqual(['cancelar'])
    expect(accionesDeVisita('requiere_llamada')).toEqual(['contactos', 'llamada', 'cancelar'])
    expect(accionesDeVisita('autorizada')).toEqual(['ingreso', 'cancelar'])
    expect(accionesDeVisita('ingresada')).toEqual(['salida'])
    expect(accionesDeVisita('finalizada')).toEqual([])
    expect(accionesDeVisita('rechazada')).toEqual([])
  })

  it('el turno muestra primero lo que exige acción y luego por antigüedad', () => {
    const v = (estado: Visita['estado'], creada_en: string) => ({ estado, creada_en })
    const orden = ordenarTurno([v('ingresada', '1'), v('anunciada', '2'), v('requiere_llamada', '3'), v('autorizada', '1'), v('anunciada', '1')])
    expect(orden.map((x) => `${x.estado}${x.creada_en}`)).toEqual(['requiere_llamada3', 'autorizada1', 'anunciada1', 'anunciada2', 'ingresada1'])
    expect(visitaAbierta({ estado: 'finalizada' })).toBe(false)
    expect(visitaAbierta({ estado: 'sin_respuesta' })).toBe(true)
  })

  it('muestra el tiempo de espera desde el anuncio', () => {
    const ahora = new Date('2026-11-17T12:00:00Z')
    expect(transcurrido('2026-11-17T11:59:40Z', ahora)).toBe('hace menos de 1 min')
    expect(transcurrido('2026-11-17T11:55:00Z', ahora)).toBe('hace 5 min')
    expect(transcurrido('2026-11-17T10:30:00Z', ahora)).toBe('hace 1 h 30 min')
    expect(transcurrido('2026-11-17T12:05:00Z', ahora)).toBe('hace menos de 1 min')
  })

  it('describe el escalamiento del aviso', () => {
    expect(textoEvento({ tipo: 'aviso_enviado', nivel: 1, canal: 'app' })).toBe('Aviso enviado al responsable del bien por app')
    expect(textoEvento({ tipo: 'aviso_enviado', nivel: 2, destinatarios: 3 })).toBe('Aviso enviado a todos los residentes (3)')
    expect(textoEvento({ tipo: 'escalada_llamada' })).toBe('Nadie respondió: hay que llamar')
  })

  it('las credenciales revocadas o perdidas no cambian; solo se rotan los QR', () => {
    expect(transicionesCredencial('activa')).toEqual(['suspendida', 'perdida', 'revocada'])
    expect(transicionesCredencial('suspendida')).toEqual(['activa', 'revocada'])
    expect(transicionesCredencial('revocada')).toEqual([])
    expect(transicionesCredencial('perdida')).toEqual([])
    expect(rotable('qr_permanente')).toBe(true)
    expect(rotable('tarjeta_rfid')).toBe(false)
    expect(pideValor('placa')).toBe(true)
    expect(pideValor('pin')).toBe(false)
  })

  it('traduce alertas conocidas y deja legibles las demás', () => {
    expect(textoAlerta('intentos_fallidos')).toBe('Intentos fallidos repetidos')
    expect(textoAlerta('algo_nuevo')).toBe('algo nuevo')
  })

  it('convierte un mapa de textos en opciones', () => {
    expect(opcionesDe(TIPO_VISITA)[0]).toEqual({ valor: 'visita', etiqueta: 'Visita' })
  })

  it('el turno solo aparece con acceso.registrar', () => {
    const c = (permisos: string[]) => ({ tieneModulo: () => true, tienePermiso: (x: string) => permisos.includes(x), esPH: true })
    expect(accionesVisibles(SECCIONES.porteria!, c(['acceso.registrar'])).map((a) => a.id)).toContain('turno')
    expect(accionesVisibles(SECCIONES.porteria!, c(['acceso.bitacora.ver'])).map((a) => a.id)).toEqual(['visitas', 'bitacora'])
  })
})

// El demo responde con 250–500 ms de latencia: los flujos largos necesitan más que 5 s.
describe('portería contra el demo', { timeout: 20_000 }, () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('porteria', 'x')
    await useEntidad().entrar(PH)
  })

  it('el usuario de portería tiene el control de acceso, sin ver bienes ni personas', () => {
    const e = useEntidad()
    expect(e.tieneModulo('control_acceso')).toBe(true)
    expect(e.tienePermiso('acceso.registrar')).toBe(true)
    expect(e.tienePermiso('bienes_privados.ver')).toBe(false)
    expect(e.tienePermiso('personas.ver')).toBe(false)
  })

  it('busca bienes con lo mínimo y pagina por cursor', async () => {
    const { datos } = await p.bienesPorteria(PH, 't1-10')
    expect(datos.map((b) => b.codigo)).toContain('T1-101')
    expect(Object.keys(datos[0]!).sort()).toEqual(['codigo', 'id'])
    const primera = await p.bienesPorteria(PH, undefined, undefined, 30)
    expect(primera.datos).toHaveLength(30)
    const segunda = await p.bienesPorteria(PH, undefined, primera.siguiente ?? undefined, 30)
    expect(segunda.siguiente).toBeNull()
    expect(primera.datos.length + segunda.datos.length).toBe(40)
  })

  it('carga los códigos de los bienes una vez para mostrar visitas y paquetes', async () => {
    const porteria = usePorteria()
    await Promise.all([porteria.asegurarCodigos(PH), porteria.asegurarCodigos(PH)])
    expect(useBienes().codigo(T1_101)).toBe('T1-101')
    const ultimo = bienesDemo().at(-1)!
    expect(useBienes().codigo(ultimo.id)).toBe(ultimo.codigo)
    expect(Object.keys(useBienes().codigos)).toHaveLength(40)
  })

  it('anunciar → llamada → ingreso → salida', async () => {
    const v = await p.anunciarVisita(PH, { bien_privado_id: T1_101, tipo: 'visita', visitante_nombre: 'Ana' }, 'k1')
    expect(v.estado).toBe('anunciada')
    expect((await p.detalleVisita(PH, v.id)).eventos.map((e) => e.tipo)).toEqual(['anunciada', 'aviso_enviado'])
    await expect(p.contactosVisita(PH, v.id)).rejects.toMatchObject({ estado: 409 })

    const espera = vid(9405)
    expect(await p.contactosVisita(PH, espera)).toHaveLength(2)
    const autorizada = await p.registrarLlamada(PH, espera, 'autorizo', vid(5003))
    expect(autorizada.estado).toBe('autorizada')
    await expect(p.registrarLlamada(PH, espera, 'rechazo')).rejects.toMatchObject({ codigo: 'conflicto' })
    await expect(p.salidaVisita(PH, espera)).rejects.toMatchObject({ codigo: 'conflicto_estado' })
    expect((await p.ingresoVisita(PH, espera)).estado).toBe('ingresada')
    expect((await p.salidaVisita(PH, espera)).estado).toBe('finalizada')
    await expect(p.cancelarVisita(PH, espera)).rejects.toMatchObject({ estado: 409 })
  })

  it('ingreso con QR: válido, inválido y sin usos', async () => {
    const jardinero = vid(9403)
    await expect(p.ingresoConQr(PH, 'cualquier cosa')).rejects.toMatchObject({ estado: 422 })
    const v = await p.ingresoConQr(PH, `  DAD1.${jardinero}.firma \n`)
    expect(v.usos).toBe(2)
    await expect(p.ingresoConQr(PH, `DAD1.${jardinero}.firma`)).rejects.toMatchObject({ estado: 409 })
  })

  it('recibir y entregar exige firma o foto; luego no se puede devolver', async () => {
    const c = await p.recibirCorrespondencia(PH, { bien_privado_id: T1_101, tipo: 'paquete', remitente: 'Tienda' }, 'k2')
    const personas = await p.personasParaEntrega(PH, T1_101)
    expect(personas.map((x) => x.nombre)).toContain('Marta Residente')
    await expect(p.entregarCorrespondencia(PH, c.id, { persona_id: personas[0]!.persona_id })).rejects.toMatchObject({ estado: 422 })
    const r = await p.entregarCorrespondencia(PH, c.id, { persona_id: personas[0]!.persona_id, firma_base64: 'iVBOR' })
    expect(r.correspondencia.estado).toBe('entregada')
    await expect(p.devolverCorrespondencia(PH, c.id, 'x')).rejects.toMatchObject({ codigo: 'conflicto_estado' })
    expect((await p.listarCorrespondencia(PH, 'recibida')).datos.some((x) => x.id === c.id)).toBe(false)
  })

  it('minuta, bitácora y alertas', async () => {
    await expect(p.registrarNovedad(PH, 'ronda', '  ', [], 'k3')).rejects.toMatchObject({ estado: 422 })
    const n = await p.registrarNovedad(PH, 'incidente', 'Puerta abierta', ['abc'], 'k4')
    expect(n.adjuntos).toHaveLength(1)
    expect((await p.minuta(PH, undefined, { tipo: 'incidente' })).datos.map((x) => x.texto)).toEqual(['Puerta abierta'])
    await p.registrarEvento(PH, { sentido: 'entrada', resultado: 'manual', motivo: 'Sin tarjeta' }, 'k5')
    expect((await p.eventosAcceso(PH, undefined, { resultado: 'manual' })).datos).toHaveLength(2)
    expect((await p.alertasAcceso(PH))[0]?.tipo).toBe('intentos_fallidos')
  })

  it('credenciales: secreto una vez, revocada es definitiva, rotar solo QR', async () => {
    const persona = vid(5001)
    const pin = await p.emitirCredencial(PH, { titular: { persona_id: persona }, tipo: 'pin' }, 'k6')
    expect(pin.secreto).toBe('482915')
    const tarjeta = await p.emitirCredencial(PH, { titular: { persona_id: persona }, tipo: 'tarjeta_rfid', valor: 'A1' }, 'k7')
    expect(tarjeta.secreto).toBeNull()
    await expect(p.emitirCredencial(PH, { titular: { persona_id: persona }, tipo: 'tarjeta_rfid', valor: 'A1' }, 'k8')).rejects.toMatchObject({ estado: 409 })
    await expect(p.rotarCredencial(PH, tarjeta.credencial.id)).rejects.toMatchObject({ estado: 422 })
    expect((await p.rotarCredencial(PH, vid(9702))).secreto).toContain('nuevo')
    expect((await p.cambiarEstadoCredencial(PH, tarjeta.credencial.id, 'revocada')).estado).toBe('revocada')
    await expect(p.cambiarEstadoCredencial(PH, tarjeta.credencial.id, 'activa')).rejects.toMatchObject({ estado: 409 })
    expect((await p.credenciales(PH, persona)).length).toBe(4)
  })

  it('autorizaciones manuales y biometría con consentimiento', async () => {
    const persona = vid(5001)
    await expect(
      p.crearAutorizacionAcceso(PH, { titular: { persona_id: persona }, vigente_desde: '2026-12-02T00:00:00Z', vigente_hasta: '2026-12-01T00:00:00Z' }, 'k9'),
    ).rejects.toMatchObject({ estado: 422 })
    const a = await p.crearAutorizacionAcceso(PH, { titular: { persona_id: persona }, vigente_desde: '2026-12-01T00:00:00Z', motivo: 'Obra' }, 'k10')
    await p.revocarAutorizacionAcceso(PH, a.id)
    expect((await p.autorizacionesAcceso(PH, persona)).find((x) => x.id === a.id)?.revocada_en).toBeTruthy()

    expect(await p.consentimiento(PH, persona)).toBeNull()
    await expect(p.emitirCredencial(PH, { titular: { persona_id: persona }, tipo: 'biometria_ref' }, 'k11')).rejects.toMatchObject({ estado: 422 })
    await p.registrarConsentimiento(PH, persona, 'v1', null)
    await expect(p.registrarConsentimiento(PH, persona, 'v1', null)).rejects.toMatchObject({ estado: 409 })
    await p.emitirCredencial(PH, { titular: { persona_id: persona }, tipo: 'biometria_ref' }, 'k12')
    expect(await p.revocarConsentimiento(PH, persona)).toBe(1)
    expect(await p.consentimiento(PH, persona)).toBeNull()
  })

  it('configuración, costo de avisos, puntos, puentes y dispositivos', async () => {
    const c = await p.configuracion(PH)
    await expect(p.guardarConfiguracion(PH, { ...c, dias_avisos_correspondencia: 0 })).rejects.toMatchObject({ estado: 422 })
    expect((await p.guardarConfiguracion(PH, { ...c, dias_avisos_correspondencia: 7 })).dias_avisos_correspondencia).toBe(7)
    await expect(p.costoAvisos(PH, '2026-11-30', '2026-11-01')).rejects.toMatchObject({ estado: 422 })
    expect((await p.costoAvisos(PH, '2026-11-01', '2026-11-30')).valor_estimado).toBe('3915.00')

    await expect(p.crearPuntoAcceso(PH, { nombre: 'Portería principal', tipo: 'mixto', sentido: 'ambos' }, 'k13')).rejects.toMatchObject({ estado: 409 })
    const punto = await p.crearPuntoAcceso(PH, { nombre: 'Peatonal norte', tipo: 'peatonal', sentido: 'entrada' }, 'k14')
    expect((await p.actualizarPuntoAcceso(PH, punto.id ?? '', { ...punto, activo: false })).activo).toBe(false)

    const { puente, token } = await p.registrarPuente(PH, 'Puente rampa', 'k15')
    expect(token).toContain('dadp_')
    expect(await p.nuevoTokenPuente(PH, puente.id)).toContain('nuevo')
    expect((await p.retirarPuente(PH, puente.id)).estado).toBe('retirado')
    await expect(p.nuevoTokenPuente(PH, puente.id)).rejects.toMatchObject({ estado: 409 })

    const base = { puente_id: (await p.puentes(PH))[0]!.id, punto_acceso_id: punto.id ?? '', tipo: 'lector_qr' as const, fabricante: 'X' }
    // El contrato tipa `config` como objeto libre sin claves declaradas; aquí se prueba que el demo rechaza secretos.
    const conSecreto = { password: '1' } as unknown as Record<string, never>
    await expect(p.registrarDispositivo(PH, { ...base, config: conSecreto }, 'k16')).rejects.toMatchObject({ estado: 422 })
    await p.registrarDispositivo(PH, base, 'k17')
    expect(await p.dispositivos(PH)).toHaveLength(2)
  })

  it('opciones de persona con el documento enmascarado; pide al menos 2 caracteres', async () => {
    const [o] = await p.opcionesPersona(PH, 'marta')
    expect(o).toEqual({ id: vid(5001), nombre: 'Marta Residente', detalle: 'Documento ****3456' })
    await expect(p.opcionesPersona(PH, 'm')).rejects.toMatchObject({ estado: 422 })
  })
})

describe('el residente solo ve lo de su bien', () => {
  it('visitas y paquetes filtrados a T1-101', async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('residente', 'x')
    await useEntidad().entrar(PH)
    const { datos } = await p.listarVisitas(PH)
    expect(datos.every((v) => v.bien_privado_id === T1_101)).toBe(true)
    expect(datos.map((v) => v.visitante_nombre)).toEqual(['Carlos Domicilio', 'María Visita', 'Jardinero', 'Tía Rosa'])
  })
})
