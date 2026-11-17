/**
 * Demo de la portería: visitas en cada estado (una espera llamada), correspondencia, minuta,
 * bitácora, alertas, credenciales, autorizaciones, consentimientos biométricos y configuración.
 * También atiende las visitas y paquetes del residente (filtrados a su bien, como el backend).
 * Se reinicia en cada inicio de sesión.
 */
import type {
  AutorizacionAcceso,
  ConfiguracionAcceso,
  ConsentimientoBiometrico,
  Correspondencia,
  Credencial,
  DispositivoAcceso,
  EntregaCorrespondencia,
  EventoAcceso,
  EventoVisita,
  NovedadMinuta,
  NuevaAutorizacionAcceso,
  NuevaCorrespondencia,
  NuevaCredencial,
  NuevaVisita,
  NuevoEventoAcceso,
  Preautorizacion,
  Puente,
  PuntoAcceso,
  Visita,
} from '@/api/tipos'
import { cuerpo, error, json, type Manejador, sinContenido } from './http'
import { bienesDemo, personasDemo } from './unidades'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const MIN = 60_000
const hace = (min: number) => new Date(Date.now() - min * MIN).toISOString()
const ahora = () => new Date().toISOString()
const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const T1_101 = id(7001)

let visitas: Visita[] = []
let eventosVisita = new Map<string, EventoVisita[]>()
let paquetes: Correspondencia[] = []
let novedades: NovedadMinuta[] = []
let eventos: EventoAcceso[] = []
let credenciales: Credencial[] = []
let autorizaciones: AutorizacionAcceso[] = []
let consentimientos = new Map<string, ConsentimientoBiometrico>()
let configuracion: ConfiguracionAcceso = { retencion_soportes_dias: 90, dias_avisos_correspondencia: 5, silencio_inicio: '22:00:00', silencio_fin: '06:00:00', retencion_eventos_dias: 365, retencion_fotos_placas_dias: 30 }
let puntos: PuntoAcceso[] = []
let puentes: Puente[] = []
let dispositivos: DispositivoAcceso[] = []
let consecutivo = 9800
/** Si es un residente, solo ve lo de su bien (como el backend). */
let soloBien: string | null = null

function visita(n: number, nombre: string, estado: Visita['estado'], minutos: number, extra: Partial<Visita> = {}): Visita {
  return {
    id: id(n), bien_privado_id: T1_101, origen: 'anuncio_porteria', tipo: 'visita', estado, visitante_nombre: nombre,
    usos_permitidos: 1, usos: 0, avisos_enviados: 1, creada_en: hace(minutos), ...extra,
  }
}

const ev = (tipo: EventoVisita['tipo'], minutos: number, extra: Partial<EventoVisita> = {}): EventoVisita => ({ tipo, ocurrido_en: hace(minutos), ...extra })

/** Reinicia el demo; `residente` limita visitas y paquetes a su bien. */
export function iniciarPorteria(residente = false): void {
  consecutivo = 9800
  soloBien = residente ? T1_101 : null
  visitas = [
    visita(9401, 'Carlos Domicilio', 'anunciada', 1, { tipo: 'domicilio' }),
    visita(9402, 'María Visita', 'anunciada', 2),
    visita(9405, 'Técnico de internet', 'requiere_llamada', 6, { tipo: 'proveedor', bien_privado_id: id(7003), avisos_enviados: 3 }),
    visita(9406, 'Luis Amigo', 'autorizada', 4, { bien_privado_id: id(7004), decidida_en: hace(3) }),
    visita(9407, 'Plomero', 'ingresada', 40, { tipo: 'proveedor', bien_privado_id: id(7006), ingreso_en: hace(35) }),
    visita(9403, 'Jardinero', 'autorizada', 60 * 24, { origen: 'preautorizada', tipo: 'servicio_domestico', usos_permitidos: 4, usos: 1, ventana_desde: hace(60), ventana_hasta: new Date(Date.now() + 6 * 24 * 60 * MIN).toISOString() }),
    visita(9404, 'Tía Rosa', 'finalizada', 60 * 72, { ingreso_en: hace(60 * 72), salida_en: hace(60 * 70) }),
    visita(9408, 'Vendedor', 'rechazada', 90, { bien_privado_id: id(7005) }),
  ]
  eventosVisita = new Map([
    [id(9405), [ev('anunciada', 6), ev('aviso_enviado', 6, { nivel: 1, canal: 'app' }), ev('aviso_enviado', 4, { nivel: 2, destinatarios: 3, canal: 'whatsapp' }), ev('escalada_llamada', 1)]],
    [id(9406), [ev('anunciada', 4), ev('aviso_enviado', 4, { nivel: 1, canal: 'app' }), ev('autorizada', 3, { canal: 'app' })]],
  ])
  paquetes = [
    { id: id(9451), bien_privado_id: T1_101, tipo: 'paquete', estado: 'recibida', remitente: 'Mercado Libre', ubicacion: 'Casillero 4', recibida_en: hace(30), avisos_enviados: 1 },
    { id: id(9453), bien_privado_id: id(7003), tipo: 'sobre', estado: 'recibida', remitente: 'DIAN', recibida_en: hace(60 * 26), avisos_enviados: 2 },
    { id: id(9452), bien_privado_id: T1_101, tipo: 'sobre', estado: 'entregada', remitente: 'Banco', recibida_en: hace(60 * 24 * 6), avisos_enviados: 1, cerrada_en: hace(60 * 24 * 5) },
  ]
  novedades = [
    { id: id(9501), tipo: 'inicio_turno', texto: 'Recibo el turno sin novedades. Radio y llaves completas.', adjuntos: [], ocurrida_en: hace(120) },
    { id: id(9502), tipo: 'ronda', texto: 'Ronda por sótanos: luz fundida en el sótano 2.', adjuntos: [], ocurrida_en: hace(60) },
  ]
  eventos = [
    { id: id(9601), sentido: 'entrada', resultado: 'permitido', placa: 'ABC123', ocurrido_en: hace(15) },
    { id: id(9602), sentido: 'entrada', resultado: 'denegado', motivo: 'Tarjeta suspendida', ocurrido_en: hace(25) },
    { id: id(9603), sentido: 'salida', resultado: 'manual', motivo: 'Domicilio sin credencial', ocurrido_en: hace(50) },
  ]
  credenciales = [
    { id: id(9701), titular: { persona_id: id(5001) }, tipo: 'tarjeta_rfid', estado: 'activa', vigente_desde: hace(60 * 24 * 100) },
    { id: id(9702), titular: { persona_id: id(5001) }, tipo: 'qr_permanente', estado: 'suspendida', vigente_desde: hace(60 * 24 * 30) },
  ]
  autorizaciones = [
    { id: id(9751), titular: { persona_id: id(5001) }, origen: 'residencia', puntos: [], vigente_desde: hace(60 * 24 * 200) },
  ]
  consentimientos = new Map()
  puntos = [
    { id: id(9861), nombre: 'Portería principal', tipo: 'mixto', sentido: 'ambos', activo: true },
    { id: id(9862), nombre: 'Rampa vehicular', tipo: 'vehicular', sentido: 'ambos', activo: true },
  ]
  puentes = [{ id: id(9851), nombre: 'Puente portería', estado: 'activo', version: '1.4.2', ultimo_latido_en: hace(2), creado_en: hace(60 * 24 * 60) }]
  dispositivos = [{ id: id(9871), puente_id: id(9851), punto_acceso_id: id(9861), tipo: 'torniquete', fabricante: 'ZKTeco', modelo: 'TS1000', activo: true }]
}

const visibles = <T extends { bien_privado_id: string }>(lista: T[]) => (soloBien ? lista.filter((x) => x.bien_privado_id === soloBien) : lista)

function transicion(v: Visita, accion: string): Response | null {
  const reglas: Record<string, { desde: Visita['estado'][]; hacia: Visita['estado']; error: string }> = {
    ingreso: { desde: ['autorizada'], hacia: 'ingresada', error: 'No está autorizada, está fuera de la ventana o sin usos.' },
    salida: { desde: ['ingresada'], hacia: 'finalizada', error: 'La visita no estaba adentro.' },
    cancelacion: { desde: ['anunciada', 'requiere_llamada', 'autorizada', 'sin_respuesta'], hacia: 'cancelada', error: 'La visita ya ingresó o terminó.' },
  }
  const r = reglas[accion]
  if (!r) return null
  if (!r.desde.includes(v.estado)) return error(409, accion === 'ingreso' ? 'conflicto' : 'conflicto_estado', r.error)
  v.estado = r.hacia
  if (accion === 'ingreso') {
    v.ingreso_en = ahora()
    v.usos += 1
    // Una pre-autorización con usos de sobra vuelve a quedar autorizada al salir.
  }
  if (accion === 'salida') {
    v.salida_en = ahora()
    if (v.origen === 'preautorizada' && v.usos < v.usos_permitidos) v.estado = 'autorizada'
  }
  eventosVisita.set(v.id, [...(eventosVisita.get(v.id) ?? []), ev(accion === 'cancelacion' ? 'cancelada' : (accion as 'ingreso' | 'salida'), 0)])
  return json(v)
}

export const porteria: Manejador = async (req, ruta) => {
  const m = req.method
  const base = ruta.match(/^\/copropiedades\/[^/]+(\/.*)$/)?.[1]
  if (!base) return null
  const q = new URL(req.url).searchParams

  // Visitas
  if (base === '/visitas') {
    if (m === 'GET') {
      const lista = visibles(visitas).filter((v) => (!q.get('estado') || v.estado === q.get('estado')) && (q.get('dentro') !== 'true' || v.estado === 'ingresada'))
      return json({ datos: lista, siguiente: null })
    }
    if (m === 'POST') {
      const d = await cuerpo<NuevaVisita>(req)
      if (!d.visitante_nombre?.trim()) return error(422, 'validacion', 'Escriba el nombre del visitante.')
      const v = visita(++consecutivo, d.visitante_nombre, 'anunciada', 0, { tipo: d.tipo, bien_privado_id: d.bien_privado_id, placa: d.placa, visitante_documento: d.visitante_documento, observacion: d.observacion })
      visitas = [v, ...visitas]
      eventosVisita.set(v.id, [ev('anunciada', 0), ev('aviso_enviado', 0, { nivel: 1, canal: 'app' })])
      return json(v, 201)
    }
  }
  if (m === 'POST' && base === '/visitas/ingreso-qr') {
    const { qr } = await cuerpo<{ qr: string }>(req)
    const v = visitas.find((x) => x.origen === 'preautorizada' && qr.startsWith(`DAD1.${x.id}.`))
    if (!v) return error(422, 'validacion', 'El código no es válido o es de otra copropiedad.')
    if (v.estado !== 'autorizada' || v.usos >= v.usos_permitidos || (v.ventana_hasta && Date.parse(v.ventana_hasta) < Date.now())) {
      return error(409, 'conflicto', 'El código está fuera de su horario o ya no tiene ingresos.')
    }
    return transicion(v, 'ingreso')
  }
  if (m === 'POST' && base === '/visitas/preautorizaciones') {
    const d = await cuerpo<Preautorizacion>(req)
    if (Date.parse(d.hasta) <= Date.parse(d.desde)) return error(422, 'validacion', 'La ventana no es válida.')
    const v = visita(++consecutivo, d.visitante_nombre, 'autorizada', 0, {
      origen: 'preautorizada', tipo: d.tipo, bien_privado_id: d.bien_privado_id, placa: d.placa, ventana_desde: d.desde, ventana_hasta: d.hasta,
      usos_permitidos: d.usos, avisos_enviados: 0,
    })
    visitas = [v, ...visitas]
    return json({ visita: v, qr: `DAD1.${v.id}.firma` }, 201)
  }
  const vis = base.match(/^\/visitas\/([^/]+)(?:\/([a-z-]+))?$/)
  if (vis) {
    const v = visitas.find((x) => x.id === vis[1])
    if (!v) return error(404, 'no_encontrado', 'La visita no existe.')
    const accion = vis[2]
    if (m === 'GET' && !accion) return json({ visita: v, eventos: eventosVisita.get(v.id) ?? [ev('anunciada', Math.round((Date.now() - Date.parse(v.creada_en)) / MIN))] })
    if (m === 'GET' && accion === 'qr') {
      if (v.origen !== 'preautorizada' || v.estado !== 'autorizada') return error(409, 'conflicto', 'No es una pre-autorización vigente.')
      return json({ qr: `DAD1.${v.id}.firma` })
    }
    if (m === 'GET' && accion === 'contactos') {
      if (v.estado !== 'requiere_llamada') return error(409, 'conflicto', 'La visita no espera una llamada.')
      return json([
        { persona_id: id(5003), nombre: 'Lucía Gómez', telefono: '310 555 0102' },
        { persona_id: id(5102), nombre: 'Titular T1-201', telefono: '320 555 0199' },
      ])
    }
    if (m === 'POST' && accion === 'llamada') {
      if (v.estado !== 'requiere_llamada') return error(409, 'conflicto', 'La visita ya fue atendida.')
      const { resultado } = await cuerpo<{ resultado: 'autorizo' | 'rechazo' | 'no_contesto' }>(req)
      v.estado = resultado === 'autorizo' ? 'autorizada' : resultado === 'rechazo' ? 'rechazada' : 'sin_respuesta'
      v.decidida_en = ahora()
      eventosVisita.set(v.id, [...(eventosVisita.get(v.id) ?? []), ev('llamada', 0, { canal: 'llamada' })])
      return json(v)
    }
    if (m === 'POST' && accion === 'respuesta') {
      // «María Visita» la respondió otro residente un instante antes: gana la primera decisión.
      if (v.id === id(9402) && v.estado === 'anunciada') {
        v.estado = 'autorizada'
        return json({ decidida_ahora: false, visita: v })
      }
      if (!['anunciada', 'requiere_llamada'].includes(v.estado)) return json({ decidida_ahora: false, visita: v })
      const { autorizar } = await cuerpo<{ autorizar: boolean }>(req)
      v.estado = autorizar ? 'autorizada' : 'rechazada'
      v.decidida_en = ahora()
      return json({ decidida_ahora: true, visita: v })
    }
    if (m === 'POST' && accion) {
      const r = transicion(v, accion)
      if (r) return r
    }
  }

  // Correspondencia
  if (base === '/correspondencia') {
    if (m === 'GET') return json({ datos: visibles(paquetes).filter((p) => !q.get('estado') || p.estado === q.get('estado')), siguiente: null })
    if (m === 'POST') {
      const d = await cuerpo<NuevaCorrespondencia>(req)
      if (!bienesDemo().some((b) => b.id === d.bien_privado_id)) return error(422, 'validacion', 'Elija el bien destinatario.')
      const p: Correspondencia = { id: id(++consecutivo), bien_privado_id: d.bien_privado_id, tipo: d.tipo, estado: 'recibida', remitente: d.remitente, guia: d.guia, ubicacion: d.ubicacion, recibida_en: ahora(), avisos_enviados: 1 }
      paquetes = [p, ...paquetes]
      return json(p, 201)
    }
  }
  if (m === 'GET' && base === '/correspondencia/personas-para-entrega') {
    const bien = q.get('bien_privado_id')
    const b = bienesDemo().find((x) => x.id === bien)
    if (!b) return json([])
    const indice = bienesDemo().indexOf(b)
    return json([
      { persona_id: id(5100 + indice), nombre: `Titular ${b.codigo}`, vinculo: 'Propietario' },
      ...(b.id === T1_101 ? [{ persona_id: id(5001), nombre: 'Marta Residente', vinculo: 'Familiar' }] : []),
    ])
  }
  const paq = base.match(/^\/correspondencia\/([^/]+)(?:\/(entrega|devolucion))?$/)
  if (paq) {
    const p = paquetes.find((x) => x.id === paq[1])
    if (!p) return error(404, 'no_encontrado', 'No existe.')
    if (m === 'GET' && !paq[2]) return json({ correspondencia: p, entrega: null })
    if (m === 'POST' && paq[2]) {
      if (p.estado !== 'recibida') return error(409, 'conflicto_estado', 'Ya se entregó o devolvió.')
      if (paq[2] === 'devolucion') {
        p.estado = 'devuelta'
        p.motivo_devolucion = (await cuerpo<{ motivo: string }>(req)).motivo
        p.cerrada_en = ahora()
        return json(p)
      }
      const d = await cuerpo<EntregaCorrespondencia>(req)
      if (!d.firma_base64 && !d.foto_base64) return error(422, 'validacion', 'Falta la firma o la foto de quien recibe.')
      if (!d.persona_id && !d.tercero_nombre) return error(422, 'validacion', 'Indique quién recibe.')
      p.estado = 'entregada'
      p.cerrada_en = ahora()
      return json({ correspondencia: p, entrega: { persona_id: d.persona_id, tercero_nombre: d.tercero_nombre, entregada_en: ahora(), soportes_hasta: new Date(Date.now() + 90 * 24 * 60 * MIN).toISOString() } })
    }
  }

  // Minuta, bitácora y alertas
  if (base === '/minuta') {
    if (m === 'GET') return json({ datos: novedades.filter((n) => !q.get('tipo') || n.tipo === q.get('tipo')), siguiente: null })
    if (m === 'POST') {
      const d = await cuerpo<{ tipo: NovedadMinuta['tipo']; texto: string; adjuntos_base64?: string[] }>(req)
      if (!d.texto?.trim()) return error(422, 'validacion', 'Escriba la novedad.')
      const n: NovedadMinuta = { id: id(++consecutivo), tipo: d.tipo, texto: d.texto, adjuntos: (d.adjuntos_base64 ?? []).map(() => id(++consecutivo)), ocurrida_en: ahora() }
      novedades = [n, ...novedades]
      return json(n, 201)
    }
  }
  if (base === '/eventos-acceso') {
    if (m === 'GET') return json({ datos: eventos.filter((e) => !q.get('resultado') || e.resultado === q.get('resultado')), siguiente: null })
    if (m === 'POST') {
      const d = await cuerpo<NuevoEventoAcceso>(req)
      const e: EventoAcceso = { id: id(++consecutivo), ...d, ocurrido_en: ahora() }
      eventos = [e, ...eventos]
      return json(e, 201)
    }
  }
  if (m === 'GET' && base === '/acceso/alertas') return json([{ tipo: 'intentos_fallidos', nombre: 'Portería principal', momento: hace(25), intentos: 4 }])

  // Credenciales y autorizaciones
  if (base === '/credenciales') {
    if (m === 'GET') return json(credenciales.filter((c) => !q.get('persona_id') || c.titular.persona_id === q.get('persona_id')))
    if (m === 'POST') {
      const d = await cuerpo<NuevaCredencial>(req)
      if (d.tipo === 'biometria_ref' && !consentimientos.has(d.titular.persona_id ?? '')) return error(422, 'validacion', 'La persona no ha dado su consentimiento biométrico.')
      if (d.valor && credenciales.some((c) => c.estado === 'activa' && c.tipo === d.tipo && (c as Credencial & { valor?: string }).valor === d.valor)) {
        return error(409, 'conflicto', 'Ya hay otra credencial vigente con ese identificador.')
      }
      const c = { id: id(++consecutivo), titular: d.titular, tipo: d.tipo, estado: 'activa' as const, vigente_desde: d.vigente_desde ?? ahora(), vigente_hasta: d.vigente_hasta, valor: d.valor ?? undefined }
      credenciales.push(c)
      const secreto = d.tipo === 'pin' ? '482915' : d.tipo === 'qr_permanente' ? `DADQ.${c.id}.secreto` : null
      return json({ credencial: c, secreto }, 201)
    }
  }
  const cred = base.match(/^\/credenciales\/([^/]+)\/(estado|rotacion)$/)
  if (m === 'POST' && cred) {
    const c = credenciales.find((x) => x.id === cred[1])
    if (!c) return error(404, 'no_encontrado', 'No existe.')
    if (cred[2] === 'rotacion') {
      if (c.tipo !== 'qr_permanente' && c.tipo !== 'app_movil') return error(422, 'validacion', 'Solo se rotan los QR permanentes y los de la app.')
      return json({ credencial: c, secreto: `DADQ.${c.id}.nuevo` })
    }
    const { estado } = await cuerpo<{ estado: Credencial['estado'] }>(req)
    if (c.estado === 'revocada' || c.estado === 'perdida') return error(409, 'conflicto_estado', 'Revocada y perdida son definitivas.')
    c.estado = estado
    return json(c)
  }
  if (base === '/autorizaciones-acceso') {
    if (m === 'GET') return json(autorizaciones.filter((a) => !q.get('persona_id') || a.titular.persona_id === q.get('persona_id')))
    if (m === 'POST') {
      const d = await cuerpo<NuevaAutorizacionAcceso>(req)
      if (d.vigente_hasta && Date.parse(d.vigente_hasta) <= Date.parse(d.vigente_desde)) return error(422, 'validacion', 'La vigencia está invertida.')
      const a: AutorizacionAcceso = { id: id(++consecutivo), titular: d.titular, origen: 'manual', puntos: d.puntos ?? [], vigente_desde: d.vigente_desde, vigente_hasta: d.vigente_hasta, motivo: d.motivo }
      autorizaciones.push(a)
      return json(a, 201)
    }
  }
  const revoca = base.match(/^\/autorizaciones-acceso\/([^/]+)\/revocacion$/)
  if (m === 'POST' && revoca) {
    const a = autorizaciones.find((x) => x.id === revoca[1])
    if (a) a.revocada_en = ahora()
    return sinContenido()
  }
  const bio = base.match(/^\/personas\/([^/]+)\/consentimiento-biometrico$/)
  if (bio) {
    const personaId = bio[1] ?? ''
    if (!personasDemo().some((p) => p.id === personaId)) return error(404, 'no_encontrado', 'La persona no existe.')
    if (m === 'GET') return json(consentimientos.get(personaId) ?? null)
    if (m === 'POST') {
      if (consentimientos.has(personaId)) return error(409, 'conflicto', 'Ya tiene un consentimiento vigente.')
      const d = await cuerpo<{ version_texto: string }>(req)
      const c: ConsentimientoBiometrico = { id: id(++consecutivo), persona_id: personaId, version_texto: d.version_texto, otorgado_en: ahora() }
      consentimientos.set(personaId, c)
      return json(c, 201)
    }
    if (m === 'DELETE') {
      consentimientos.delete(personaId)
      let n = 0
      for (const c of credenciales) {
        if (c.titular.persona_id === personaId && c.tipo === 'biometria_ref' && c.estado !== 'revocada') {
          c.estado = 'revocada'
          n++
        }
      }
      return json({ credenciales_revocadas: n })
    }
  }

  // Búsquedas de la portería (lo mínimo, sin bienes_privados.ver ni personas.ver)
  if (m === 'GET' && base === '/acceso/bienes') {
    const texto = sinTildes(q.get('q') ?? '')
    const lista = bienesDemo().filter((b) => b.activo && (!texto || sinTildes(b.codigo).includes(texto)))
    const limite = Number(q.get('limite') ?? '50')
    const desde = q.get('despues') ? lista.findIndex((b) => b.id === q.get('despues')) + 1 : 0
    const pagina = lista.slice(desde, desde + limite)
    const siguiente = desde + limite < lista.length ? (pagina.at(-1)?.id ?? null) : null
    return json({ datos: pagina.map((b) => ({ id: b.id, codigo: b.codigo })), siguiente })
  }
  if (m === 'GET' && base === '/acceso/personas') {
    const texto = sinTildes(q.get('q') ?? '').trim()
    if (texto.length < 2) return error(422, 'validacion', 'Escriba al menos 2 caracteres del nombre o del documento.')
    const lista = personasDemo().filter((p) => sinTildes(p.nombre).includes(texto) || (p.documento ?? '').includes(texto))
    return json({
      datos: lista.slice(0, 20).map((p) => ({ id: p.id, nombre: p.nombre, documento: p.documento ? `****${p.documento.slice(-4)}` : null })),
      siguiente: null,
    })
  }

  // Configuración
  if (base === '/acceso/configuracion') {
    if (m === 'GET') return json(configuracion)
    if (m === 'PUT') {
      const d = await cuerpo<ConfiguracionAcceso>(req)
      if (d.dias_avisos_correspondencia < 1 || d.dias_avisos_correspondencia > 30) return error(422, 'validacion', 'Los días de aviso van de 1 a 30.')
      configuracion = d
      return json(d)
    }
  }
  if (m === 'GET' && base === '/acceso/costo-avisos') {
    if ((q.get('hasta') ?? '') < (q.get('desde') ?? '')) return error(422, 'validacion', 'El periodo está invertido.')
    return json({ moneda: 'COP', push_enviados: 412, whatsapp_enviados: 87, fallidos: 3, tarifa_utilidad: '45.00', valor_estimado: '3915.00' })
  }
  if (base === '/puntos-acceso') {
    if (m === 'GET') return json(puntos)
    if (m === 'POST') {
      const d = await cuerpo<PuntoAcceso>(req)
      if (puntos.some((p) => p.nombre === d.nombre)) return error(409, 'conflicto', `Ya existe el punto «${d.nombre}».`)
      const p = { activo: true, ...d, id: id(++consecutivo) }
      puntos.push(p)
      return json(p, 201)
    }
  }
  const punto = base.match(/^\/puntos-acceso\/([^/]+)$/)
  if (m === 'PUT' && punto) {
    const i = puntos.findIndex((p) => p.id === punto[1])
    if (i < 0) return error(404, 'no_encontrado', 'El punto no existe.')
    const p = { ...(await cuerpo<PuntoAcceso>(req)), id: punto[1] }
    puntos[i] = p
    return json(p)
  }
  if (base === '/puentes') {
    if (m === 'GET') return json(puentes)
    if (m === 'POST') {
      const { nombre } = await cuerpo<{ nombre: string }>(req)
      const p: Puente = { id: id(++consecutivo), nombre, estado: 'activo', creado_en: ahora() }
      puentes.push(p)
      return json({ puente: p, token: `dadp_${p.id.slice(-6)}_secreto_de_maquina` }, 201)
    }
  }
  const pte = base.match(/^\/puentes\/([^/]+)\/(credencial|retiro)$/)
  if (m === 'POST' && pte) {
    const p = puentes.find((x) => x.id === pte[1])
    if (!p) return error(404, 'no_encontrado', 'No existe.')
    if (pte[2] === 'retiro') {
      p.estado = 'retirado'
      return json(p)
    }
    if (p.estado === 'retirado') return error(409, 'conflicto', 'El puente está retirado.')
    return json({ token: `dadp_${p.id.slice(-6)}_nuevo_token` })
  }
  if (base === '/dispositivos-acceso') {
    if (m === 'GET') return json(dispositivos)
    if (m === 'POST') {
      const d = await cuerpo<DispositivoAcceso>(req)
      if (JSON.stringify(d.config ?? {}).match(/contrase|password|secret/i)) return error(422, 'validacion', 'La configuración no puede traer secretos.')
      const nuevo = { ...d, id: id(++consecutivo), activo: true }
      dispositivos.push(nuevo)
      return json(nuevo, 201)
    }
  }
  return null
}
