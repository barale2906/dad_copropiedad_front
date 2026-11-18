/**
 * Demo de la gestión administrativa: PQRS en varios estados (uno vencido, uno de convivencia),
 * configuración de plazos y categorías, preguntas frecuentes del bot, conversaciones de WhatsApp
 * (una dentro y otra fuera de la ventana de 24 h), comunicados en cada estado, activos con hoja
 * de vida, planes preventivos, órdenes (una ejecutada por la cuenta del administrador demo) y
 * obligaciones periódicas. El residente solo ve sus tickets y solo con sus transiciones.
 * Se reinicia en cada inicio de sesión.
 */
import type {
  Activo,
  Comunicado,
  ConfiguracionTickets,
  Conversacion,
  Cumplimiento,
  DetalleTicket,
  EstadoTicket,
  MensajeConversacion,
  MovimientoActivo,
  NuevaObligacionMantenimiento,
  NuevaOrden,
  NuevoActivo,
  NuevoComunicado,
  NuevoMovimiento,
  NuevoPlan,
  ObligacionMantenimiento,
  OrdenTrabajo,
  PlanMantenimiento,
  PreguntaFrecuente,
  Ticket,
} from '@/api/tipos'
import { cuentaDemoId } from './cuenta'
import { cuerpo, error, json, type Manejador, sinContenido } from './http'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const MIN = 60_000
const DIA = 86_400_000
const hace = (min: number) => new Date(Date.now() - min * MIN).toISOString()
const enDias = (dias: number) => new Date(Date.now() + dias * DIA).toISOString()
const fecha = (dias: number) => new Date(Date.now() + dias * DIA).toISOString().slice(0, 10)
const ahora = () => new Date().toISOString()
const T1_101 = id(7001)
const ADMIN = cuentaDemoId('admin')

interface TicketDemo extends DetalleTicket {
  /** Solo el residente demo es solicitante de estos. */
  delResidente: boolean
}

let tickets: TicketDemo[] = []
let configuracion: ConfiguracionTickets
let categorias: { id: string; nombre: string; activa: boolean }[] = []
let preguntas: PreguntaFrecuente[] = []
let chats: { conversacion: Conversacion; mensajes: MensajeConversacion[] }[] = []
let comunicados: Comunicado[] = []
let activos: Activo[] = []
let movimientos = new Map<string, MovimientoActivo[]>()
let ordenes: OrdenTrabajo[] = []
let evidencias = new Map<string, { archivo_id: string; momento: 'antes' | 'despues' | 'soporte' }[]>()
let planes: PlanMantenimiento[] = []
let obligacionesMant: ObligacionMantenimiento[] = []
let cumplimientos = new Map<string, Cumplimiento[]>()
let consecutivo = 3800
let residente = false
let cuenta = ADMIN

/** Transiciones que la administración ofrece desde cada estado (el demo no distingue papeles). */
const TRANSICIONES: Partial<Record<EstadoTicket, EstadoTicket[]>> = {
  abierto: ['en_revision', 'en_progreso', 'rechazado', 'duplicado'],
  en_revision: ['en_progreso', 'rechazado', 'duplicado'],
  asignado: ['en_progreso', 'en_espera_tercero'],
  en_progreso: ['en_espera_tercero', 'en_espera_solicitante', 'resuelto'],
  en_espera_tercero: ['en_progreso', 'resuelto'],
  en_espera_solicitante: ['en_progreso', 'resuelto'],
  reabierto: ['en_progreso', 'resuelto'],
}

function transiciones(t: TicketDemo): EstadoTicket[] {
  if (residente) return t.ticket.estado === 'resuelto' ? ['cerrado', 'reabierto'] : []
  return TRANSICIONES[t.ticket.estado] ?? []
}

function ticket(n: number, asunto: string, estado: Ticket['estado'], extra: Partial<Ticket> = {}, delResidente = false): TicketDemo {
  return {
    delResidente,
    ticket: {
      id: id(n), numero: `PQR-2026-${String(n).padStart(5, '0')}`, tipo: 'solicitud_mantenimiento', prioridad: 'media', canal: 'web', estado, asunto,
      descripcion: `${asunto}. Por favor revisar.`, bien_privado_id: T1_101, vencido: false, confidencial: false, identidad_oculta: false,
      solicitante_persona_id: id(5100), vence_en: enDias(3), plazo: { cantidad: 15, unidad: 'dias_habiles' },
      creado_en: hace(60 * 24 * 6), actualizado_en: hace(60 * 24), ...extra,
    },
    mensajes: [
      { id: id(n + 1), del_solicitante: false, canal: 'web', interno: false, texto: 'Recibimos su solicitud y la estamos revisando.', adjuntos: [], creado_en: hace(60 * 24 * 5), autor_cuenta_id: ADMIN },
      { id: id(n + 2), del_solicitante: false, canal: 'web', interno: true, texto: 'Nota interna: llamar al contratista.', adjuntos: [], creado_en: hace(60 * 24 * 4), autor_cuenta_id: ADMIN },
    ],
    adjuntos: [],
    eventos: [{ hacia: 'abierto', ocurrido_en: hace(60 * 24 * 6) }],
    transiciones_permitidas: [],
  }
}

function orden(n: number, descripcion: string, estado: OrdenTrabajo['estado'], extra: Partial<OrdenTrabajo> = {}): OrdenTrabajo {
  return {
    id: id(n), numero: `OT-2026-${String(n).padStart(5, '0')}`, origen: 'plan_preventivo', tipo: 'preventivo', descripcion, programada_para: fecha(0), estado,
    checklist: [], costo_mano_obra: '0', costo_repuestos: '0', creado_en: hace(60 * 24 * 10), plan_id: id(3401), ...extra,
  }
}

function activo(n: number, codigo: string, nombre: string, clase: Activo['clase'], estado: Activo['estado'] = 'operativo', extra: Partial<Activo> = {}): Activo {
  return { id: id(n), codigo, nombre, clase, estado, creado_en: hace(60 * 24 * 400), ...extra }
}

/** Reinicia el demo; `esResidente` limita los tickets a los suyos; `usuario` fija la cuenta. */
export function iniciarGestion(usuario: string, esResidente = false): void {
  consecutivo = 3800
  residente = esResidente
  cuenta = cuentaDemoId(usuario)
  tickets = [
    ticket(3001, 'Filtración en el techo del baño', 'en_espera_solicitante', {}, true),
    ticket(3011, 'Bombillo del pasillo fundido', 'resuelto', { resuelto_en: hace(60 * 24), reabrible_hasta: enDias(5), vence_en: null }, true),
    ticket(3021, 'Ruido en el ascensor de la torre 2', 'abierto', { prioridad: 'alta', bien_privado_id: id(7021), vence_en: enDias(-1), vencido: true, tipo: 'queja' }),
    ticket(3031, 'Fiesta con ruido después de las 10 p. m.', 'en_revision', { tipo: 'reporte_convivencia', confidencial: true, identidad_oculta: true, solicitante_persona_id: null, bien_privado_id: id(7005) }),
    ticket(3041, 'Solicitud de certificado de residencia', 'en_progreso', { tipo: 'solicitud_documentos', vence_en: hace(-300), asignado: { cuenta_id: ADMIN } }),
  ]
  configuracion = {
    jornada_inicio: '08:00:00', jornada_fin: '17:00:00', incluye_sabado: false, dias_reapertura: 5,
    plazos: [
      { tipo: 'peticion', plazo: { cantidad: 15, unidad: 'dias_habiles' } },
      { tipo: 'solicitud_mantenimiento', prioridad: 'urgente', plazo: { cantidad: 4, unidad: 'horas' } },
    ],
  }
  categorias = [
    { id: id(9901), nombre: 'Plomería', activa: true },
    { id: id(9902), nombre: 'Electricidad', activa: true },
    { id: id(9903), nombre: 'Zonas comunes', activa: true },
  ]
  preguntas = [
    { id: id(3101), pregunta: '¿Cuál es el horario de la administración?', respuesta: 'De lunes a viernes de 8 a. m. a 5 p. m.', orden: 1, activa: true },
    { id: id(3102), pregunta: '¿Cómo reservo el salón social?', respuesta: 'Desde la app, en Zonas comunes → Reservar.', orden: 2, activa: true },
    { id: id(3103), pregunta: '¿Se permiten mascotas en la piscina?', respuesta: 'No. Consulte el manual de convivencia.', orden: 3, activa: false },
  ]
  chats = [
    {
      conversacion: { id: id(3201), telefono: '+57 300 555 0101', persona_id: id(5001), estado: 'abierta', abierta_en: hace(90), ultimo_entrante_en: hace(30), ventana_abierta: true },
      mensajes: [
        { entrante: true, texto: 'Hola, quiero hablar con la administración.', creado_en: hace(90) },
        { entrante: false, texto: 'Le comunico con una persona de la administración.', creado_en: hace(89) },
        { entrante: true, texto: '¿El parqueadero de visitantes está habilitado hoy?', creado_en: hace(30) },
      ],
    },
    {
      conversacion: { id: id(3202), telefono: '+57 300 555 0199', estado: 'abierta', abierta_en: hace(60 * 30), ultimo_entrante_en: hace(60 * 26), ventana_abierta: false },
      mensajes: [{ entrante: true, texto: 'Buenas, necesito un paz y salvo.', creado_en: hace(60 * 26) }],
    },
  ]
  const com = (n: number, titulo: string, estado: Comunicado['estado'], extra: Partial<Comunicado> = {}): Comunicado => ({
    id: id(n), titulo, cuerpo: `${titulo}. La administración informa los detalles.`, finalidad: 'administracion', audiencia: { tipo: 'todos' },
    importante: false, requiere_confirmacion: false, estado, adjuntos: [], creado_en: hace(60 * 24 * 3), actualizado_en: hace(60 * 24), ...extra,
  })
  comunicados = [
    com(3301, 'Corte de agua el sábado', 'enviado', { importante: true, requiere_confirmacion: true, enviado_en: hace(60 * 5) }),
    com(3302, 'Jornada de vacunación de mascotas', 'programado', { finalidad: 'comunicaciones', programado_para: enDias(2) }),
    com(3303, 'Mantenimiento de la piscina', 'borrador', { audiencia: { tipo: 'agrupaciones', ids: [id(7101)] } }),
    com(3304, 'Asamblea extraordinaria (aplazada)', 'anulado'),
  ]
  activos = [
    activo(3501, 'ASC-01', 'Ascensor torre 1', 'equipo', 'operativo', { marca: 'Otis', ubicacion: 'Torre 1', garantia_vence: fecha(20), valor: '85000000.00' }),
    activo(3502, 'BOM-01', 'Motobomba del tanque', 'equipo', 'con_falla', { ubicacion: 'Cuarto de máquinas' }),
    activo(3503, 'POD-01', 'Podadora', 'herramienta', 'operativo', { ubicacion: 'Bodega' }),
  ]
  movimientos = new Map([[id(3501), [{ id: id(3511), tipo: 'entrada', observacion: 'Instalación', ocurrido_en: hace(60 * 24 * 400) }]]])
  ordenes = [
    orden(3601, 'Mantenimiento mensual del ascensor', 'programada', { activo_id: id(3501), checklist: [{ descripcion: 'Lubricar guías', cumplido: false }, { descripcion: 'Probar frenos', cumplido: false }] }),
    orden(3602, 'Revisión de la motobomba', 'ejecutada', {
      activo_id: id(3502), tipo: 'correctivo', origen: 'inspeccion', plan_id: null, ejecutada_por: ADMIN, ejecutada_en: hace(120), iniciada_en: hace(240),
      costo_mano_obra: '120000.00', costo_repuestos: '45000.00', observaciones: 'Se cambió el sello mecánico.',
    }),
    orden(3603, 'Poda de jardines', 'programada', { programada_para: fecha(-3), plan_id: id(3402) }),
  ]
  evidencias = new Map()
  planes = [
    { id: id(3401), activo_id: id(3501), actividad: 'Mantenimiento mensual del ascensor', recurrencia: { frecuencia: 'meses', intervalo: 1, inicio: fecha(-90) }, anticipacion_dias: 5, checklist: ['Lubricar guías', 'Probar frenos'], activo: true },
    { id: id(3402), ubicacion: 'Zonas verdes', actividad: 'Poda de jardines', recurrencia: { frecuencia: 'semanas', intervalo: 2, inicio: fecha(-60) }, anticipacion_dias: 2, checklist: [], activo: true },
  ]
  obligacionesMant = [
    { id: id(3701), codigo_sugerido: 'certificacion_ascensores', nombre: 'Certificación de ascensores', periodicidad_meses: 12, proxima: fecha(10), dias_alerta: 30, activo_id: id(3501), activa: true },
    { id: id(3702), codigo_sugerido: 'lavado_tanques', nombre: 'Lavado de tanques', periodicidad_meses: 6, proxima: fecha(-2), dias_alerta: 15, activa: true },
  ]
  cumplimientos = new Map([[id(3701), [{ realizada_el: fecha(-355), observacion: 'Certificado vigente', registrado_en: hace(60 * 24 * 355) }]]])
}

const visibles = () => (residente ? tickets.filter((t) => t.delResidente) : tickets)
const conTransiciones = (t: TicketDemo): DetalleTicket => ({
  ticket: t.ticket, mensajes: residente ? t.mensajes.filter((m) => !m.interno) : t.mensajes, adjuntos: t.adjuntos, eventos: t.eventos,
  transiciones_permitidas: transiciones(t),
})

const PIDE_MOTIVO: EstadoTicket[] = ['resuelto', 'rechazado', 'en_espera_solicitante']

export const gestion: Manejador = async (req, ruta) => {
  const m = req.method
  if (m === 'GET' && ruta === '/yo/tickets') {
    return json(
      tickets.filter((t) => t.delResidente).map((t) => ({
        copropiedad_id: id(1), copropiedad: 'Conjunto Residencial Los Robles', ticket_id: t.ticket.id, numero: t.ticket.numero,
        tipo: t.ticket.tipo, estado: t.ticket.estado, asunto: t.ticket.asunto, creado_en: t.ticket.creado_en, actualizado_en: t.ticket.actualizado_en,
      })),
    )
  }
  const base = ruta.match(/^\/copropiedades\/[^/]+(\/.*)$/)?.[1]
  if (!base) return null
  const q = new URL(req.url).searchParams

  // Tickets
  if (base === '/tickets/categorias') {
    if (m === 'GET') return json(categorias)
    if (m === 'POST') {
      const d = await cuerpo<{ nombre: string }>(req)
      if (categorias.some((c) => c.nombre.toLowerCase() === d.nombre.trim().toLowerCase())) return error(409, 'conflicto', 'Ya existe esa categoría.')
      const c = { id: id(++consecutivo), nombre: d.nombre.trim(), activa: true }
      categorias.push(c)
      return json(c, 201)
    }
  }
  const cat = base.match(/^\/tickets\/categorias\/([^/]+)$/)
  if (m === 'PUT' && cat) {
    const c = categorias.find((x) => x.id === cat[1])
    if (!c) return error(404, 'no_encontrado', 'No existe.')
    Object.assign(c, await cuerpo<{ nombre: string; activa: boolean }>(req))
    return json(c)
  }
  if (base === '/tickets/configuracion') {
    if (m === 'GET') return json(configuracion)
    if (m === 'PUT') {
      const d = await cuerpo<ConfiguracionTickets>(req)
      if (d.jornada_fin <= d.jornada_inicio) return error(422, 'validacion', 'La jornada termina antes de empezar.')
      configuracion = d
      return json(d)
    }
  }
  if (m === 'GET' && base === '/tickets/tablero') {
    const cuenta = new Map<EstadoTicket, number>()
    tickets.filter((t) => !['resuelto', 'cerrado', 'rechazado', 'duplicado'].includes(t.ticket.estado)).forEach((t) => cuenta.set(t.ticket.estado, (cuenta.get(t.ticket.estado) ?? 0) + 1))
    return json({
      pendientes_por_estado: [...cuenta].map(([estado, cantidad]) => ({ estado, cantidad })),
      vencidos: tickets.filter((t) => t.ticket.vencido).length,
      horas_promedio_respuesta: 6.5, horas_promedio_solucion: 52, satisfaccion_promedio: 4.3,
    })
  }
  if (base === '/tickets') {
    if (m === 'GET') {
      const lista = visibles().filter((t) =>
        (!q.get('estado') || t.ticket.estado === q.get('estado')) && (!q.get('tipo') || t.ticket.tipo === q.get('tipo')) &&
        (!q.get('prioridad') || t.ticket.prioridad === q.get('prioridad')) && (q.get('vencidos') !== 'true' || t.ticket.vencido) &&
        (q.get('mios') !== 'true' || t.ticket.asignado?.cuenta_id === cuenta))
      return json({ datos: lista.map((t) => t.ticket), siguiente: null })
    }
    if (m === 'POST') {
      const d = await cuerpo<Ticket & { idempotency_key: string; adjuntos?: string[] }>(req)
      if (!d.asunto?.trim() || !d.descripcion?.trim()) return error(422, 'validacion', 'Escriba el asunto y la descripción.')
      const t = ticket(++consecutivo * 10, d.asunto, 'abierto', { tipo: d.tipo, descripcion: d.descripcion, creado_en: ahora(), actualizado_en: ahora() }, residente)
      t.mensajes = []
      t.adjuntos = (d.adjuntos ?? []).map((a) => ({ archivo_id: a, interno: false }))
      tickets = [t, ...tickets]
      return json(t.ticket, 201)
    }
  }
  const tic = base.match(/^\/tickets\/([^/]+)(?:\/(mensajes|encuesta|transiciones|asignacion))?$/)
  if (tic) {
    const t = visibles().find((x) => x.ticket.id === tic[1])
    if (!t) return error(404, 'no_encontrado', 'No existe o no es visible para la cuenta.')
    const accion = tic[2]
    if (m === 'GET' && !accion) return json(conTransiciones(t))
    if (m === 'PATCH' && !accion) {
      Object.assign(t.ticket, await cuerpo<Partial<Ticket>>(req))
      return json(t.ticket)
    }
    if (m === 'POST' && accion === 'asignacion') {
      t.ticket.asignado = await cuerpo<{ cuenta_id?: string | null; organizacion_id?: string | null }>(req)
      if (['abierto', 'en_revision'].includes(t.ticket.estado)) t.ticket.estado = 'asignado'
      return json(t.ticket)
    }
    if (m === 'POST' && accion === 'mensajes') {
      if (['cerrado', 'rechazado', 'duplicado'].includes(t.ticket.estado)) return error(409, 'conflicto', 'El ticket terminó.')
      const { texto, interno } = await cuerpo<{ texto: string; interno?: boolean }>(req)
      const msj = { id: id(++consecutivo), del_solicitante: residente, canal: 'web' as const, interno: !residente && !!interno, texto, adjuntos: [], creado_en: ahora(), autor_cuenta_id: cuenta }
      t.mensajes.push(msj)
      if (residente && t.ticket.estado === 'en_espera_solicitante') t.ticket.estado = 'en_progreso'
      return json(msj, 201)
    }
    if (m === 'POST' && accion === 'encuesta') {
      if (!['resuelto', 'cerrado'].includes(t.ticket.estado) || t.ticket.encuesta) return error(409, 'conflicto', 'Aún no está resuelto o ya calificó.')
      t.ticket.encuesta = await cuerpo<{ calificacion: number; comentario?: string | null }>(req)
      return json(t.ticket)
    }
    if (m === 'POST' && accion === 'transiciones') {
      const { hacia, motivo, duplicado_de } = await cuerpo<{ hacia: EstadoTicket; motivo?: string | null; duplicado_de?: string | null }>(req)
      if (!transiciones(t).includes(hacia)) return error(409, 'conflicto_estado', 'Ese cambio de estado ya no aplica: recargue el ticket.')
      if (PIDE_MOTIVO.includes(hacia) && !motivo?.trim()) return error(422, 'validacion', 'Indique el motivo (la respuesta o lo que necesita del solicitante).')
      if (hacia === 'duplicado' && !duplicado_de) return error(422, 'validacion', 'Indique el ticket original.')
      t.eventos.push({ desde: t.ticket.estado, hacia, motivo, actor_cuenta_id: cuenta, ocurrido_en: ahora() })
      if (motivo?.trim() && hacia !== 'rechazado') {
        t.mensajes.push({ id: id(++consecutivo), del_solicitante: residente, canal: 'web', interno: false, texto: motivo, adjuntos: [], creado_en: ahora(), autor_cuenta_id: cuenta })
      }
      t.ticket.estado = hacia
      if (hacia === 'resuelto') {
        t.ticket.resuelto_en = ahora()
        t.ticket.reabrible_hasta = enDias(configuracion.dias_reapertura)
      }
      if (hacia === 'duplicado') t.ticket.duplicado_de = duplicado_de
      t.ticket.actualizado_en = ahora()
      return json(t.ticket)
    }
  }

  // Preguntas frecuentes
  if (base === '/preguntas-frecuentes') {
    if (m === 'GET') return json([...preguntas].sort((a, b) => a.orden - b.orden))
    if (m === 'POST') {
      const d = await cuerpo<Omit<PreguntaFrecuente, 'id'>>(req)
      if (!d.pregunta?.trim() || !d.respuesta?.trim()) return error(422, 'validacion', 'Escriba la pregunta y la respuesta.')
      const p = { ...d, activa: d.activa ?? true, orden: d.orden ?? preguntas.length + 1, id: id(++consecutivo) }
      preguntas.push(p)
      return json(p, 201)
    }
  }
  const pre = base.match(/^\/preguntas-frecuentes\/([^/]+)$/)
  if (m === 'PUT' && pre) {
    const i = preguntas.findIndex((p) => p.id === pre[1])
    if (i < 0) return error(404, 'no_encontrado', 'No existe.')
    preguntas[i] = { ...preguntas[i]!, ...(await cuerpo<Partial<PreguntaFrecuente>>(req)) }
    return json(preguntas[i])
  }

  // Conversaciones
  if (m === 'GET' && base === '/conversaciones') {
    return json({ datos: chats.map((c) => c.conversacion).filter((c) => !q.get('estado') || c.estado === q.get('estado')), siguiente: null })
  }
  const conv = base.match(/^\/conversaciones\/([^/]+)(?:\/(mensajes|cierre))?$/)
  if (conv) {
    const c = chats.find((x) => x.conversacion.id === conv[1])
    if (!c) return error(404, 'no_encontrado', 'No existe.')
    if (m === 'GET' && !conv[2]) return json(c)
    if (m === 'POST' && conv[2] === 'cierre') {
      if (c.conversacion.estado === 'cerrada') return error(409, 'conflicto', 'Ya estaba cerrada.')
      c.conversacion.estado = 'cerrada'
      c.conversacion.cerrada_en = ahora()
      return json(c.conversacion)
    }
    if (m === 'POST' && conv[2] === 'mensajes') {
      const abierta = Date.parse(c.conversacion.ultimo_entrante_en) + DIA > Date.now()
      if (c.conversacion.estado === 'cerrada' || !abierta) return error(409, 'conflicto', 'La conversación se cerró o venció la ventana de 24 h.')
      const { texto } = await cuerpo<{ texto: string }>(req)
      const msj = { entrante: false, texto, autor_cuenta_id: cuenta, creado_en: ahora() }
      c.mensajes.push(msj)
      c.conversacion.atendida_por = cuenta
      return json(msj, 201)
    }
  }

  // Comunicados (administración; los del residente los atiende `mi.ts`)
  if (base === '/comunicados') {
    if (m === 'GET') {
      return json({ datos: comunicados.map((c) => ({ comunicado: c, resumen: resumenDe(c) })), siguiente: null })
    }
    if (m === 'POST') {
      const d = await cuerpo<NuevoComunicado>(req)
      const r = validarComunicado(d)
      if (r) return r
      const c: Comunicado = { importante: false, requiere_confirmacion: false, adjuntos: [], ...d, id: id(++consecutivo), estado: 'borrador', creado_en: ahora(), actualizado_en: ahora() }
      comunicados = [c, ...comunicados]
      return json(c, 201)
    }
  }
  const comu = base.match(/^\/comunicados\/([^/]+)(?:\/(publicar|retirar|anular))?$/)
  if (comu) {
    const c = comunicados.find((x) => x.id === comu[1])
    if (!c) return error(404, 'no_encontrado', 'No existe.')
    const accion = comu[2]
    if (m === 'GET' && !accion) return json({ comunicado: c, resumen: resumenDe(c) })
    if (m === 'PUT' && !accion) {
      if (c.estado !== 'borrador') return error(409, 'conflicto', 'Ya no es borrador.')
      const d = await cuerpo<NuevoComunicado>(req)
      const r = validarComunicado(d)
      if (r) return r
      Object.assign(c, d, { actualizado_en: ahora() })
      return json(c)
    }
    if (m === 'POST' && accion === 'publicar') {
      if (c.estado !== 'borrador') return error(409, 'conflicto_estado', 'No es borrador.')
      const { programado_para } = await cuerpo<{ programado_para?: string | null }>(req)
      if (programado_para && Date.parse(programado_para) > Date.now() + 365 * DIA) return error(422, 'validacion', 'Se programa a menos de un año.')
      if (programado_para && Date.parse(programado_para) > Date.now()) Object.assign(c, { estado: 'programado', programado_para })
      else Object.assign(c, { estado: 'enviado', enviado_en: ahora(), programado_para: null })
      return json(c)
    }
    if (m === 'POST' && accion === 'retirar') {
      if (c.estado !== 'programado') return error(409, 'conflicto_estado', 'No está programado.')
      Object.assign(c, { estado: 'borrador', programado_para: null })
      return json(c)
    }
    if (m === 'POST' && accion === 'anular') {
      if (c.estado === 'enviado' || c.estado === 'anulado') return error(409, 'conflicto_estado', 'Ya se envió.')
      c.estado = 'anulado'
      return json(c)
    }
  }

  // Inventario
  if (base === '/activos') {
    if (m === 'GET') {
      const texto = (q.get('q') ?? '').toLowerCase()
      const lista = activos.filter((a) => (!texto || `${a.codigo} ${a.nombre}`.toLowerCase().includes(texto)) && (!q.get('clase') || a.clase === q.get('clase')) && (!q.get('estado') || a.estado === q.get('estado')))
      return json({ datos: lista, siguiente: null })
    }
    if (m === 'POST') {
      const d = await cuerpo<NuevoActivo>(req)
      if (activos.some((a) => a.codigo === d.codigo)) return error(409, 'conflicto', `Ya existe el código ${d.codigo}.`)
      const a: Activo = { ...d, id: id(++consecutivo), estado: 'operativo', creado_en: ahora() }
      activos.push(a)
      return json(a, 201)
    }
  }
  const act = base.match(/^\/activos\/([^/]+)(?:\/(archivos|movimientos))?$/)
  if (act) {
    const a = activos.find((x) => x.id === act[1])
    if (!a) return error(404, 'no_encontrado', 'No existe.')
    if (m === 'GET' && !act[2]) {
      const suyas = ordenes.filter((o) => o.activo_id === a.id)
      const costo = suyas.reduce((s, o) => s + Number(o.costo_mano_obra) + Number(o.costo_repuestos), 0).toFixed(2)
      return json({ activo: a, archivos: [], movimientos: movimientos.get(a.id) ?? [], ordenes: suyas, costo_total: costo })
    }
    if (a.estado === 'dado_de_baja' && m !== 'GET') return error(409, 'conflicto', 'El activo está dado de baja.')
    if (m === 'PATCH' && !act[2]) {
      Object.assign(a, await cuerpo<Partial<Activo>>(req))
      return json(a)
    }
    if (m === 'POST' && act[2] === 'archivos') return sinContenido()
    if (m === 'POST' && act[2] === 'movimientos') {
      const d = await cuerpo<NuevoMovimiento>(req)
      if ((d.tipo === 'traslado' || d.tipo === 'prestamo') && !d.ubicacion_destino) return error(422, 'validacion', 'Indique a dónde va.')
      if (d.tipo === 'baja' && !d.soporte_archivo_id) return error(422, 'validacion', 'La baja exige un soporte.')
      const mov: MovimientoActivo = { ...d, id: id(++consecutivo), registrado_por: cuenta, ocurrido_en: ahora() }
      movimientos.set(a.id, [mov, ...(movimientos.get(a.id) ?? [])])
      if (d.tipo === 'baja') a.estado = 'dado_de_baja'
      if (d.tipo === 'traslado' && d.ubicacion_destino) a.ubicacion = d.ubicacion_destino
      return json(mov, 201)
    }
  }

  // Mantenimiento
  if (m === 'GET' && base === '/mantenimiento/tablero') {
    const hoy = fecha(0)
    return json({
      preventivas_programadas: 8, preventivas_cumplidas: 6, cumplimiento_porcentaje: '75.00',
      ordenes_vencidas: ordenes.filter((o) => ['programada', 'en_ejecucion'].includes(o.estado) && o.programada_para < hoy).length,
      costo_por_activo: [{ activo_id: id(3502), nombre: 'Motobomba del tanque', costo: '165000.00' }],
    })
  }
  if (m === 'GET' && base === '/mantenimiento/alertas') {
    const hoy = fecha(0)
    return json({
      obligaciones: obligacionesMant.filter((o) => o.activa && o.proxima <= fecha(o.dias_alerta)),
      garantias: activos.filter((a) => a.garantia_vence && a.garantia_vence <= fecha(30)),
      ordenes_vencidas: ordenes.filter((o) => ['programada', 'en_ejecucion'].includes(o.estado) && o.programada_para < hoy),
    })
  }
  if (base === '/ordenes-trabajo') {
    if (m === 'GET') {
      const hoy = fecha(0)
      const lista = ordenes.filter((o) => (!q.get('estado') || o.estado === q.get('estado')) && (!q.get('activo_id') || o.activo_id === q.get('activo_id')) &&
        (q.get('vencidas') !== 'true' || (['programada', 'en_ejecucion'].includes(o.estado) && o.programada_para < hoy)))
      return json({ datos: lista, siguiente: null })
    }
    if (m === 'POST') {
      const d = await cuerpo<NuevaOrden>(req)
      if (!d.descripcion?.trim()) return error(422, 'validacion', 'Describa el trabajo.')
      const o = orden(++consecutivo, d.descripcion, 'programada', {
        tipo: d.tipo, origen: d.ticket_id ? 'ticket' : 'inspeccion', plan_id: null, ticket_id: d.ticket_id, activo_id: d.activo_id, ubicacion: d.ubicacion,
        asignado: d.asignado, programada_para: d.programada_para, checklist: (d.checklist ?? []).map((descripcion) => ({ descripcion, cumplido: false })), creado_en: ahora(),
      })
      ordenes = [o, ...ordenes]
      return json(o, 201)
    }
  }
  const ord = base.match(/^\/ordenes-trabajo\/([^/]+)(?:\/(avance|evidencias))?$/)
  if (ord) {
    const o = ordenes.find((x) => x.id === ord[1])
    if (!o) return error(404, 'no_encontrado', 'No existe.')
    if (m === 'GET' && !ord[2]) return json({ orden: o, evidencias: evidencias.get(o.id) ?? [] })
    if (m === 'POST' && ord[2] === 'evidencias') {
      if (['verificada', 'cancelada'].includes(o.estado)) return error(409, 'conflicto', 'La orden terminó.')
      evidencias.set(o.id, [...(evidencias.get(o.id) ?? []), await cuerpo<{ archivo_id: string; momento: 'antes' | 'despues' | 'soporte' }>(req)])
      return sinContenido()
    }
    if (m === 'POST' && ord[2] === 'avance') {
      const d = await cuerpo<{ accion: string; checklist?: OrdenTrabajo['checklist']; costo_mano_obra?: string; costo_repuestos?: string; observaciones?: string | null; aprobada?: boolean; motivo?: string }>(req)
      const paso: Record<string, OrdenTrabajo['estado'][]> = { iniciar: ['programada'], ejecutar: ['en_ejecucion'], verificar: ['ejecutada'], cancelar: ['programada', 'en_ejecucion'] }
      if (!paso[d.accion]?.includes(o.estado)) return error(409, 'conflicto_estado', 'Ese paso ya no aplica: recargue la orden.')
      if (d.accion === 'iniciar') Object.assign(o, { estado: 'en_ejecucion', iniciada_en: ahora() })
      if (d.accion === 'ejecutar') {
        if (o.checklist.length && (d.checklist?.length ?? 0) !== o.checklist.length) return error(422, 'validacion', 'Diligencie todos los puntos del checklist de la orden.')
        Object.assign(o, {
          estado: 'ejecutada', ejecutada_en: ahora(), ejecutada_por: cuenta, checklist: d.checklist ?? o.checklist,
          costo_mano_obra: d.costo_mano_obra ?? '0', costo_repuestos: d.costo_repuestos ?? '0', observaciones: d.observaciones ?? null,
        })
      }
      if (d.accion === 'verificar') {
        if (o.ejecutada_por === cuenta) return error(409, 'conflicto', 'Quien ejecutó la orden no puede verificarla: debe hacerlo otra cuenta.')
        if (d.aprobada) Object.assign(o, { estado: 'verificada', verificada_en: ahora(), verificada_por: cuenta })
        else Object.assign(o, { estado: 'en_ejecucion', ejecutada_en: null, ejecutada_por: null })
      }
      if (d.accion === 'cancelar') {
        if (!d.motivo?.trim()) return error(422, 'validacion', 'Indique el motivo.')
        Object.assign(o, { estado: 'cancelada', observaciones: `Cancelada: ${d.motivo}` })
      }
      return json(o)
    }
  }
  if (base === '/planes-mantenimiento') {
    if (m === 'GET') return json(planes)
    if (m === 'POST') {
      const d = await cuerpo<NuevoPlan>(req)
      if (!d.actividad?.trim() || d.recurrencia.intervalo < 1) return error(422, 'validacion', 'Escriba la actividad y un intervalo de al menos 1.')
      const p: PlanMantenimiento = { anticipacion_dias: 3, checklist: [], activo: true, ...d, id: id(++consecutivo) }
      planes.push(p)
      return json(p, 201)
    }
  }
  const plan = base.match(/^\/planes-mantenimiento\/([^/]+)$/)
  if (m === 'PUT' && plan) {
    const i = planes.findIndex((p) => p.id === plan[1])
    if (i < 0) return error(404, 'no_encontrado', 'No existe.')
    planes[i] = { ...planes[i]!, ...(await cuerpo<NuevoPlan>(req)) }
    return json(planes[i])
  }
  if (m === 'GET' && base === '/obligaciones/sugeridas') {
    return json([
      { codigo: 'certificacion_ascensores', nombre: 'Certificación de ascensores', descripcion: 'Inspección anual por organismo acreditado.', periodicidad_meses: 12 },
      { codigo: 'lavado_tanques', nombre: 'Lavado de tanques', descripcion: 'Lavado y desinfección de tanques de agua potable.', periodicidad_meses: 6 },
      { codigo: 'fumigacion', nombre: 'Fumigación', descripcion: 'Control de plagas en zonas comunes.', periodicidad_meses: 3 },
    ])
  }
  if (base === '/obligaciones') {
    if (m === 'GET') return json(obligacionesMant)
    if (m === 'POST') {
      const d = await cuerpo<NuevaObligacionMantenimiento>(req)
      if (d.codigo_sugerido && obligacionesMant.some((o) => o.codigo_sugerido === d.codigo_sugerido && o.activa)) return error(409, 'conflicto', 'Esa obligación ya está activa.')
      if (!d.nombre?.trim() || !d.periodicidad_meses || !d.proxima) return error(422, 'validacion', 'Faltan el nombre, la periodicidad o la próxima fecha.')
      const o: ObligacionMantenimiento = {
        id: id(++consecutivo), codigo_sugerido: d.codigo_sugerido, nombre: d.nombre, descripcion: d.descripcion, periodicidad_meses: d.periodicidad_meses,
        proxima: d.proxima, dias_alerta: d.dias_alerta ?? 15, activo_id: d.activo_id, activa: true,
      }
      obligacionesMant.push(o)
      return json(o, 201)
    }
  }
  const obl = base.match(/^\/obligaciones\/([^/]+)(?:\/(cumplimientos))?$/)
  if (obl) {
    const o = obligacionesMant.find((x) => x.id === obl[1])
    if (!o) return error(404, 'no_encontrado', 'No existe.')
    if (m === 'PATCH' && !obl[2]) {
      const d = await cuerpo<NuevaObligacionMantenimiento>(req)
      Object.assign(o, Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined && v !== null)))
      return json(o)
    }
    if (m === 'GET' && obl[2]) return json(cumplimientos.get(o.id) ?? [])
    if (m === 'POST' && obl[2]) {
      const d = await cuerpo<{ realizada_el: string; observacion?: string | null }>(req)
      if (d.realizada_el > fecha(0)) return error(422, 'validacion', 'La fecha no puede ser futura.')
      cumplimientos.set(o.id, [{ realizada_el: d.realizada_el, observacion: d.observacion, registrado_por: cuenta, registrado_en: ahora() }, ...(cumplimientos.get(o.id) ?? [])])
      const prox = new Date(`${d.realizada_el}T12:00:00Z`)
      prox.setUTCMonth(prox.getUTCMonth() + o.periodicidad_meses)
      o.proxima = prox.toISOString().slice(0, 10)
      return json(o, 201)
    }
  }
  return null
}

function resumenDe(c: Comunicado) {
  if (c.estado !== 'enviado') return { destinatarios: 0, por_push: 0, por_correo: 0, por_whatsapp: 0, sin_canal: 0, leidos: 0, enterados: 0 }
  return { destinatarios: 40, por_push: 28, por_correo: 38, por_whatsapp: 6, sin_canal: 2, leidos: 31, enterados: c.requiere_confirmacion ? 18 : 0 }
}

function validarComunicado(d: NuevoComunicado): Response | null {
  if (!d.titulo?.trim() || !d.cuerpo?.trim()) return error(422, 'validacion', 'Escriba el título y el contenido.')
  if (['agrupaciones', 'bienes', 'roles'].includes(d.audiencia.tipo) && !d.audiencia.ids?.length) return error(422, 'validacion', 'Elija a quién va.')
  return null
}
