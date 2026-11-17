/**
 * Demo del portal del propietario y residente: mi cartera (un bien en mora y otro al día), mis
 * comunicados, mis PQRS, visitas (una anunciada que espera respuesta y otra que ya respondió otro
 * residente), paquetes, mis datos y la autorización de publicidad. Se reinicia en cada sesión.
 */
import type {
  ComunicadoRecibido,
  Correspondencia,
  CuentaCobro,
  DetalleTicket,
  Obligacion,
  Preautorizacion,
  Ticket,
  Visita,
} from '@/api/tipos'
import { cuerpo, error, json, type Manejador, sinContenido } from './http'
import { bienesDemo, personasDemo } from './unidades'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const DIA = 86_400_000
const hace = (dias: number) => new Date(Date.now() - dias * DIA).toISOString()
const fecha = (dias: number) => new Date(Date.now() + dias * DIA).toISOString().slice(0, 10)
const T1_101 = id(7001)
const T1_102 = id(7002)
/** Persona de la cuenta demo en la PH (titular de T1-101). */
const PERSONA = id(5100)

let obligaciones: Obligacion[] = []
let comunicados: ComunicadoRecibido[] = []
let tickets: DetalleTicket[] = []
let visitas: Visita[] = []
let paquetes: Correspondencia[] = []
let publicidad = false
let consecutivo = 9500

function obligacion(n: number, concepto: string, dias: number, valor: string, saldo: string): Obligacion {
  return {
    id: id(n), bien_privado_id: T1_101, concepto_cobro_id: id(n + 50), concepto_codigo: concepto.slice(0, 3).toUpperCase(),
    concepto_nombre: concepto, concepto_tipo: 'ordinaria', periodo: fecha(dias - 15), valor, vencimiento: fecha(dias),
    deudor_persona_id: PERSONA, origen: 'liquidacion', estado: 'vigente', ajustes: '0', aplicado: String(Number(valor) - Number(saldo)), saldo,
  }
}

function comunicado(n: number, titulo: string, dias: number, extra: Partial<ComunicadoRecibido['comunicado']> = {}, leido = true): ComunicadoRecibido {
  return {
    comunicado: {
      id: id(n), titulo, cuerpo: `${titulo}.\n\nLa administración informa a todos los residentes los detalles de este aviso.`,
      finalidad: 'comunicaciones', audiencia: { tipo: 'todos' }, importante: false, requiere_confirmacion: false, estado: 'enviado',
      enviado_en: hace(dias), adjuntos: [], creado_en: hace(dias + 1), actualizado_en: hace(dias), ...extra,
    },
    leido_en: leido ? hace(dias) : null,
    enterado_en: null,
  }
}

function ticket(n: number, asunto: string, estado: Ticket['estado'], extra: Partial<Ticket> = {}): DetalleTicket {
  return {
    ticket: {
      id: id(n), numero: `PQRS-${2026}-${n}`, tipo: 'solicitud_mantenimiento', prioridad: 'media', canal: 'web', estado, asunto,
      descripcion: `${asunto}. Por favor revisar.`, bien_privado_id: T1_101, vencido: false, confidencial: false, identidad_oculta: false,
      creado_en: hace(6), actualizado_en: hace(1), ...extra,
    },
    mensajes: [
      { id: id(n + 1), del_solicitante: false, canal: 'web', interno: false, texto: 'Recibimos su solicitud y la estamos revisando.', adjuntos: [], creado_en: hace(5) },
      { id: id(n + 2), del_solicitante: false, canal: 'web', interno: true, texto: 'Nota interna: llamar al contratista.', adjuntos: [], creado_en: hace(4) },
    ],
    adjuntos: [],
    eventos: [],
    transiciones_permitidas: [],
  }
}

function visita(n: number, nombre: string, estado: Visita['estado'], extra: Partial<Visita> = {}): Visita {
  return {
    id: id(n), bien_privado_id: T1_101, origen: 'anuncio_porteria', tipo: 'visita', estado, visitante_nombre: nombre,
    usos_permitidos: 1, usos: 0, avisos_enviados: 1, creada_en: hace(0), ...extra,
  }
}

export function iniciarMi(): void {
  consecutivo = 9500
  obligaciones = [
    obligacion(9101, 'Cuota de administración', -20, '350000.00', '350000.00'),
    obligacion(9102, 'Cuota de administración', 10, '350000.00', '350000.00'),
    obligacion(9103, 'Intereses de mora', -5, '8750.00', '8750.00'),
  ]
  comunicados = [
    comunicado(9201, 'Corte de agua el sábado', 0, { importante: true, requiere_confirmacion: true }, false),
    comunicado(9202, 'Mantenimiento de ascensores', 4),
    comunicado(9203, 'Asamblea ordinaria 2027', 12),
  ]
  tickets = [
    ticket(9301, 'Filtración en el techo del baño', 'en_espera_solicitante'),
    ticket(9311, 'Bombillo del pasillo fundido', 'resuelto', { resuelto_en: hace(1), reabrible_hasta: new Date(Date.now() + 5 * DIA).toISOString() }),
  ]
  visitas = [
    visita(9401, 'Carlos Domicilio', 'anunciada', { tipo: 'domicilio' }),
    visita(9402, 'María Visita', 'anunciada'),
    visita(9403, 'Jardinero', 'autorizada', { origen: 'preautorizada', tipo: 'servicio_domestico', usos_permitidos: 4, usos: 1, ventana_desde: hace(1), ventana_hasta: new Date(Date.now() + 6 * DIA).toISOString() }),
    visita(9404, 'Tía Rosa', 'finalizada', { creada_en: hace(3), ingreso_en: hace(3), salida_en: hace(3) }),
  ]
  paquetes = [
    { id: id(9451), bien_privado_id: T1_101, tipo: 'paquete', estado: 'recibida', remitente: 'Mercado Libre', ubicacion: 'Casillero 4', recibida_en: hace(0), avisos_enviados: 1 },
    { id: id(9452), bien_privado_id: T1_101, tipo: 'sobre', estado: 'entregada', remitente: 'Banco', recibida_en: hace(6), avisos_enviados: 1, cerrada_en: hace(5) },
  ]
  publicidad = false
}

function estadoDe(bienId: string) {
  const b = bienesDemo().find((x) => x.id === bienId)
  const propias = obligaciones.filter((o) => o.bien_privado_id === bienId && o.estado === 'vigente')
  const hoy = fecha(0)
  const saldo = propias.reduce((s, o) => s + Number(o.saldo), 0)
  const vencido = propias.filter((o) => o.vencimiento < hoy).reduce((s, o) => s + Number(o.saldo), 0)
  return {
    bien: { id: bienId, codigo: b?.codigo ?? '', tipo: b?.tipo ?? 'apartamento', activo: true, referencia_pago: `REF-${b?.codigo ?? ''}` },
    corte: hoy, obligaciones: propias, pagos: bienId === T1_102 ? [{ recibo_id: id(9601), fecha: fecha(-10), obligacion_id: id(9602), valor: '350000.00' }] : [],
    saldo: saldo.toFixed(2), vencido: vencido.toFixed(2), anticipos: '0',
  }
}

const cuentaCobro = (n: number, dias: number, total: string): CuentaCobro => ({
  id: id(n), numero: `CC-${n}`, liquidacion_id: id(n + 1), bien_privado_id: T1_101, periodo: fecha(dias - 15), deudor_persona_id: PERSONA,
  saldo_anterior: '0', cargos: total, total, vencimiento: fecha(dias), referencia_pago: 'REF-T1-101', creada_en: hace(-dias + 15),
})

export const mi: Manejador = async (req, ruta) => {
  const m = req.method
  if (m === 'GET' && ruta === '/yo/tickets') {
    return json(
      tickets.map((t) => ({
        copropiedad_id: id(1), copropiedad: 'Conjunto Residencial Los Robles', ticket_id: t.ticket.id, numero: t.ticket.numero,
        tipo: t.ticket.tipo, estado: t.ticket.estado, asunto: t.ticket.asunto, creado_en: t.ticket.creado_en, actualizado_en: t.ticket.actualizado_en,
      })),
    )
  }
  if (ruta.match(/^\/entidades\/[^/]+\/publicidad\/autorizacion$/)) {
    if (m === 'GET') return json({ autorizada: publicidad, politica: { version: 1, texto: 'Recibirá ofertas de los comercios del directorio según sus preferencias. Puede retirarse cuando quiera.', vigente_desde: hace(90) } })
    if (m === 'POST') {
      const { version } = await cuerpo<{ version: number }>(req)
      if (version !== 1) return error(422, 'validacion', 'Debe aceptar la política vigente.')
      publicidad = true
      return sinContenido()
    }
    if (m === 'DELETE') {
      publicidad = false
      return sinContenido()
    }
  }
  const base = ruta.match(/^\/copropiedades\/[^/]+(\/.*)$/)?.[1]
  if (!base) return null

  // Mi cartera
  if (m === 'GET' && base === '/mi-cartera/bienes') return json([estadoDe(T1_101).bien, estadoDe(T1_102).bien])
  const cartera = base.match(/^\/mi-cartera\/bienes\/([^/]+)\/(estado-cuenta|cuentas-cobro|paz-y-salvo)$/)
  if (cartera) {
    const bienId = cartera[1] ?? ''
    if (![T1_101, T1_102].includes(bienId)) return error(404, 'no_encontrado', 'El bien no es de la cuenta.')
    if (m === 'GET' && cartera[2] === 'estado-cuenta') return json(estadoDe(bienId))
    if (m === 'GET' && cartera[2] === 'cuentas-cobro') return json(bienId === T1_101 ? [cuentaCobro(9701, 10, '708750.00'), cuentaCobro(9702, -20, '350000.00')] : [])
    if (m === 'POST' && cartera[2] === 'paz-y-salvo') {
      const e = estadoDe(bienId)
      if (Number(e.saldo) > 0) return error(409, 'conflicto', `El bien tiene un saldo de ${e.saldo}.`)
      return json(
        {
          certificado: { id: id(++consecutivo), tipo: 'paz_y_salvo', bien_privado_id: bienId, corte: fecha(0), saldo: '0', vencido: '0', pdf_sha256: 'x', emitido_en: new Date().toISOString() },
          codigo: 'PYS-7Q4K-2M9D',
          pdf_base64: btoa('%PDF-1.4 paz y salvo demo'),
        },
        201,
      )
    }
  }
  if (m === 'GET' && base.match(/^\/mi-cartera\/cuentas-cobro\/[^/]+\/pdf$/)) {
    return new Response('%PDF-1.4 cuenta de cobro demo', { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="cuenta-de-cobro.pdf"' } })
  }

  // Comunicados
  if (m === 'GET' && base === '/mis-comunicados') return json({ datos: comunicados, siguiente: null })
  const com = base.match(/^\/mis-comunicados\/([^/]+)(\/enterado)?$/)
  if (com) {
    const c = comunicados.find((x) => x.comunicado.id === com[1])
    if (!c) return error(404, 'no_encontrado', 'No es destinatario.')
    if (m === 'GET' && !com[2]) {
      c.leido_en ??= new Date().toISOString()
      return json({ ...c, enlaces_adjuntos: c.comunicado.importante ? [{ archivo_id: id(9801), nombre: 'Horario del corte.pdf', tipo_mime: 'application/pdf', url: 'https://archivos.demo.dad/corte.pdf?firma=demo' }] : [] })
    }
    if (m === 'POST' && com[2]) {
      if (!c.comunicado.requiere_confirmacion) return error(409, 'conflicto', 'El comunicado no pide confirmación.')
      c.enterado_en ??= new Date().toISOString()
      return json(c)
    }
  }

  // PQRS
  if (m === 'GET' && base === '/tickets/categorias') {
    return json([
      { id: id(9901), nombre: 'Plomería', activa: true },
      { id: id(9902), nombre: 'Electricidad', activa: true },
      { id: id(9903), nombre: 'Zonas comunes', activa: true },
    ])
  }
  if (m === 'POST' && base === '/tickets') {
    const d = await cuerpo<Ticket & { idempotency_key: string; adjuntos?: string[] }>(req)
    if (!d.asunto?.trim() || !d.descripcion?.trim()) return error(422, 'validacion', 'Escriba el asunto y la descripción.')
    const t = ticket(++consecutivo * 10, d.asunto, 'abierto', { tipo: d.tipo, descripcion: d.descripcion, creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() })
    t.mensajes = []
    t.adjuntos = (d.adjuntos ?? []).map((a) => ({ archivo_id: a, interno: false }))
    tickets = [t, ...tickets]
    return json(t.ticket, 201)
  }
  const tic = base.match(/^\/tickets\/([^/]+)(?:\/(mensajes|encuesta|transiciones))?$/)
  if (tic) {
    const t = tickets.find((x) => x.ticket.id === tic[1])
    if (!t) return error(404, 'no_encontrado', 'No existe o no es visible para la cuenta.')
    if (m === 'GET' && !tic[2]) return json(t)
    if (m === 'POST' && tic[2] === 'mensajes') {
      if (['resuelto', 'cerrado'].includes(t.ticket.estado)) return error(409, 'conflicto', 'El ticket terminó.')
      const { texto } = await cuerpo<{ texto: string }>(req)
      const msj = { id: id(++consecutivo), del_solicitante: true, canal: 'web' as const, interno: false, texto, adjuntos: [], creado_en: new Date().toISOString() }
      t.mensajes.push(msj)
      if (t.ticket.estado === 'en_espera_solicitante') t.ticket.estado = 'en_progreso'
      return json(msj, 201)
    }
    if (m === 'POST' && tic[2] === 'encuesta') {
      if (!['resuelto', 'cerrado'].includes(t.ticket.estado) || t.ticket.encuesta) return error(409, 'conflicto', 'Aún no está resuelto o ya calificó.')
      t.ticket.encuesta = await cuerpo<{ calificacion: number; comentario?: string | null }>(req)
      return json(t.ticket)
    }
    if (m === 'POST' && tic[2] === 'transiciones') {
      const { hacia } = await cuerpo<{ hacia: Ticket['estado'] }>(req)
      if (t.ticket.estado !== 'resuelto') return error(409, 'conflicto_estado', 'Transición no permitida.')
      t.ticket.estado = hacia
      return json(t.ticket)
    }
  }

  // Visitas y paquetes
  if (m === 'GET' && base === '/visitas') return json({ datos: visitas, siguiente: null })
  if (m === 'POST' && base === '/visitas/preautorizaciones') {
    const d = await cuerpo<Preautorizacion>(req)
    if (Date.parse(d.hasta) <= Date.parse(d.desde)) return error(422, 'validacion', 'La ventana no es válida.')
    const v = visita(++consecutivo, d.visitante_nombre, 'autorizada', {
      origen: 'preautorizada', tipo: d.tipo, bien_privado_id: d.bien_privado_id, placa: d.placa, ventana_desde: d.desde, ventana_hasta: d.hasta,
      usos_permitidos: d.usos, avisos_enviados: 0,
    })
    visitas = [v, ...visitas]
    return json({ visita: v, qr: `DAD1.${v.id}.${btoa(d.visitante_nombre).slice(0, 12)}.firma` }, 201)
  }
  const vis = base.match(/^\/visitas\/([^/]+)\/(qr|respuesta)$/)
  if (vis) {
    const v = visitas.find((x) => x.id === vis[1])
    if (!v) return error(404, 'no_encontrado', 'No existe.')
    if (m === 'GET' && vis[2] === 'qr') {
      if (v.origen !== 'preautorizada' || v.estado !== 'autorizada') return error(409, 'conflicto', 'No es una pre-autorización vigente.')
      return json({ qr: `DAD1.${v.id}.firma` })
    }
    if (m === 'POST' && vis[2] === 'respuesta') {
      // «María Visita» la respondió otro residente un instante antes: gana la primera decisión.
      if (v.id === id(9402) && v.estado === 'anunciada') {
        v.estado = 'autorizada'
        return json({ decidida_ahora: false, visita: v })
      }
      if (!['anunciada', 'requiere_llamada'].includes(v.estado)) return json({ decidida_ahora: false, visita: v })
      const { autorizar } = await cuerpo<{ autorizar: boolean }>(req)
      v.estado = autorizar ? 'autorizada' : 'rechazada'
      v.decidida_en = new Date().toISOString()
      return json({ decidida_ahora: true, visita: v })
    }
  }
  if (m === 'GET' && base === '/correspondencia') return json({ datos: paquetes, siguiente: null })

  // Mis datos (la persona de la cuenta demo)
  if (m === 'GET' && base === '/proteccion-datos/mis-datos') {
    const p = personasDemo().find((x) => x.id === PERSONA)
    if (!p) return error(404, 'no_encontrado', 'La cuenta no tiene persona en la copropiedad.')
    return json({
      persona: p,
      autorizaciones: [{ id: id(9951), finalidad: 'administracion', medio: 'web', politica_version: 1, otorgada_en: hace(200) }],
      solicitudes: [],
    })
  }
  return null
}
