/**
 * Demo de la protección de datos (política, solicitudes, autorizaciones, datos tratados), las
 * personas de la PH, las organizaciones con sus contratos y la búsqueda de cuentas.
 */
import type {
  Asignacion,
  AutorizacionTratamiento,
  ContratoServicio,
  FichaOrganizacion,
  FinalidadTratamiento,
  MedioAutorizacion,
  NuevaOrganizacion,
  NuevaPolitica,
  NuevoContrato,
  Politica,
  SolicitudTitular,
  TipoSolicitudTitular,
} from '@/api/tipos'
import { cuerpo, error, json, type Manejador } from './http'
import { personasDemo } from './unidades'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`


/** Cuentas que encuentra la búsqueda exacta por usuario o correo. */
const CUENTAS = [
  { id: id(801), nombre: 'Andrés Administrador', claves: ['admin', 'admin@demo.dad'] },
  { id: id(806), nombre: 'Carlos Vigilante', claves: ['carlos', 'carlos@seguridad.co'] },
]

let politicas: Politica[] = []
let solicitudes: SolicitudTitular[] = []
let autorizaciones: (AutorizacionTratamiento & { persona_id: string })[] = []
let organizaciones: (FichaOrganizacion & { nit: string })[] = []
let contratos: ContratoServicio[] = []
let consecutivo = 6000

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString()
const fecha = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10)

/** Reinicia el demo en cada inicio de sesión. */
export function iniciarProteccion(): void {
  consecutivo = 6000
  politicas = [{ id: id(5101), version: 1, texto: 'Política de tratamiento de datos del conjunto…', archivo_id: null, vigente_desde: hace(200) }]
  solicitudes = [
    { id: id(5201), persona_id: id(5001), tipo: 'consulta', estado: 'radicada', detalle: '¿Qué datos míos tienen?', radicada_en: hace(12), vence_el: fecha(-1), dias_habiles_restantes: 0 },
    { id: id(5202), persona_id: id(5002), tipo: 'rectificacion', estado: 'en_tramite', detalle: 'Mi teléfono cambió.', radicada_en: hace(5), vence_el: fecha(8), prorrogada_hasta: fecha(16), motivo_prorroga: 'Verificación con la portería.', dias_habiles_restantes: 9 },
    { id: id(5203), persona_id: id(5003), tipo: 'supresion', estado: 'respondida', radicada_en: hace(40), vence_el: fecha(-25), respuesta: 'Datos suprimidos.', respondida_en: hace(30), dias_habiles_restantes: null },
  ]
  autorizaciones = [
    { id: id(5301), persona_id: id(5001), finalidad: 'administracion', medio: 'escrito', politica_version: 1, otorgada_en: hace(150) },
    { id: id(5302), persona_id: id(5001), finalidad: 'publicidad', medio: 'app', politica_version: 1, otorgada_en: hace(100), revocada_en: hace(10) },
  ]
  organizaciones = [
    { id: id(5401), nit: '900123456-8', razon_social: 'Seguridad Total Ltda.', naturaleza: 'juridica', tipos: ['seguridad'], estado: 'reclamada' },
  ]
  contratos = [
    { id: id(5501), organizacion_id: id(5401), tipo_servicio: 'seguridad', vigente_desde: hace(300), vigente_hasta: null, estado: 'vigente', valor: '12500000.00' },
  ]
}

function pagina<T extends { id: string }>(req: Request, lista: T[]) {
  const url = new URL(req.url)
  const limite = Number(url.searchParams.get('limite') ?? 50)
  const despues = url.searchParams.get('despues')
  const inicio = despues ? lista.findIndex((x) => x.id === despues) + 1 : 0
  const datos = lista.slice(inicio, inicio + limite)
  return json({ datos, siguiente: inicio + limite < lista.length ? (datos.at(-1)?.id ?? null) : null })
}


function vigente(): Politica | null {
  return politicas.find((p) => Date.parse(p.vigente_desde) <= Date.now()) ?? null
}

async function solicitud(req: Request, accion: string, s: SolicitudTitular): Promise<Response> {
  if (s.estado === 'respondida') return error(409, 'conflicto_estado', 'La solicitud ya se respondió.')
  if (accion === 'tramite') {
    if (s.estado !== 'radicada') return error(409, 'conflicto_estado', 'La solicitud ya está en trámite.')
    s.estado = 'en_tramite'
  } else if (accion === 'prorroga') {
    if (s.prorrogada_hasta) return error(422, 'validacion', 'La prórroga es única y ya se usó.')
    const { motivo } = await cuerpo<{ motivo: string }>(req)
    s.prorrogada_hasta = fecha(s.tipo === 'consulta' ? 7 : 11)
    s.motivo_prorroga = motivo
    s.dias_habiles_restantes = (s.dias_habiles_restantes ?? 0) + (s.tipo === 'consulta' ? 5 : 8)
  } else {
    const r = await cuerpo<{ respuesta?: string | null; archivo_id?: string | null }>(req)
    if (!r.respuesta && !r.archivo_id) return error(422, 'validacion', 'Escriba la respuesta o adjunte un documento.')
    Object.assign(s, { estado: 'respondida', respuesta: r.respuesta, respuesta_archivo_id: r.archivo_id, respondida_en: new Date().toISOString(), dias_habiles_restantes: null })
  }
  return json(s)
}

export const proteccion: Manejador = async (req, ruta) => {
  const m = req.method
  const cuentaBuscada = ruta.match(/^\/entidades\/[^/]+\/cuentas$/)
  if (m === 'GET' && cuentaBuscada) {
    const q = (new URL(req.url).searchParams.get('identificador') ?? '').trim().toLowerCase()
    const c = CUENTAS.find((x) => x.claves.includes(q))
    return c ? json({ id: c.id, nombre: c.nombre }) : error(404, 'no_encontrado', 'No hay una cuenta activa con ese identificador.')
  }

  const base = ruta.match(/^\/copropiedades\/[^/]+(\/.*)$/)?.[1]
  if (!base) return null

  // Política
  if (m === 'GET' && base === '/proteccion-datos/politica') return json(vigente())
  if (m === 'GET' && base === '/proteccion-datos/politicas') return json(politicas)
  if (m === 'POST' && base === '/proteccion-datos/politicas') {
    const p = await cuerpo<NuevaPolitica>(req)
    if (!p.texto && !p.archivo_id) return error(422, 'validacion', 'Escriba el texto de la política o adjunte el PDF.')
    if (p.vigente_desde && Date.parse(p.vigente_desde) < Date.now() - 60_000) return error(422, 'validacion', 'La vigencia no puede ser pasada.')
    const nueva: Politica = { id: id(++consecutivo), version: (politicas[0]?.version ?? 0) + 1, texto: p.texto, archivo_id: p.archivo_id, vigente_desde: p.vigente_desde ?? new Date().toISOString() }
    politicas = [nueva, ...politicas]
    return json(nueva, 201)
  }

  // Solicitudes
  if (m === 'GET' && base === '/proteccion-datos/solicitudes') {
    const url = new URL(req.url)
    const estado = url.searchParams.get('estado')
    const personaId = url.searchParams.get('persona_id')
    const vencen = url.searchParams.get('vencen_hasta')
    const lista = solicitudes.filter(
      (s) =>
        (!estado || s.estado === estado) &&
        (!personaId || s.persona_id === personaId) &&
        (!vencen || (s.estado !== 'respondida' && (s.prorrogada_hasta ?? s.vence_el) <= vencen)),
    )
    return pagina(req, lista)
  }
  if (m === 'POST' && base === '/proteccion-datos/solicitudes') {
    const d = await cuerpo<{ persona_id: string; tipo: TipoSolicitudTitular; detalle?: string | null }>(req)
    const s: SolicitudTitular = { id: id(++consecutivo), persona_id: d.persona_id, tipo: d.tipo, estado: 'radicada', detalle: d.detalle, radicada_en: new Date().toISOString(), vence_el: fecha(d.tipo === 'consulta' ? 14 : 21), dias_habiles_restantes: d.tipo === 'consulta' ? 10 : 15 }
    solicitudes = [s, ...solicitudes]
    return json(s, 201)
  }
  const accion = base.match(/^\/proteccion-datos\/solicitudes\/([^/]+)\/(tramite|prorroga|respuesta)$/)
  if (m === 'POST' && accion) {
    const s = solicitudes.find((x) => x.id === accion[1])
    return s ? solicitud(req, accion[2] ?? '', s) : error(404, 'no_encontrado', 'La solicitud no existe.')
  }

  // Personas y autorizaciones
  const per = base.match(/^\/personas\/([^/]+)(\/.+)$/)
  if (per) {
    const p = personasDemo().find((x) => x.id === per[1])
    if (!p) return error(404, 'no_encontrado', 'La persona no existe.')
    const resto = per[2] ?? ''
    const suyas = () => autorizaciones.filter((a) => a.persona_id === p.id)
    if (m === 'GET' && resto === '/autorizaciones-tratamiento') return json(suyas())
    if (m === 'POST' && resto === '/autorizaciones-tratamiento') {
      const pol = vigente()
      if (!pol) return error(422, 'validacion', 'No hay una política vigente.')
      const d = await cuerpo<{ finalidades: FinalidadTratamiento[]; medio: MedioAutorizacion; evidencia_archivo_id?: string | null }>(req)
      for (const f of d.finalidades) {
        autorizaciones.push({ id: id(++consecutivo), persona_id: p.id, finalidad: f, medio: d.medio, politica_version: pol.version, evidencia_archivo_id: d.evidencia_archivo_id, otorgada_en: new Date().toISOString() })
      }
      return json({ finalidades: d.finalidades }, 201)
    }
    if (m === 'POST' && resto === '/autorizaciones-tratamiento/revocacion') {
      const { finalidades } = await cuerpo<{ finalidades: FinalidadTratamiento[] }>(req)
      const ahora = new Date().toISOString()
      const revocar = suyas().filter((a) => !a.revocada_en && finalidades.includes(a.finalidad))
      revocar.forEach((a) => (a.revocada_en = ahora))
      return json({ revocadas: revocar.length })
    }
    if (m === 'GET' && resto === '/datos-tratados') {
      return json({ persona: p, autorizaciones: suyas(), solicitudes: solicitudes.filter((s) => s.persona_id === p.id) })
    }
  }

  // Organizaciones y contratos
  if (m === 'GET' && base === '/organizaciones') {
    const nit = (new URL(req.url).searchParams.get('nit') ?? '').replace(/[.\s]/g, '')
    const o = organizaciones.find((x) => x.nit === nit || x.nit.split('-')[0] === nit)
    if (!o) return error(404, 'no_encontrado', 'No existe: se puede crear.')
    return json({ id: o.id, razon_social: o.razon_social, naturaleza: o.naturaleza, tipos: o.tipos, estado: o.estado })
  }
  if (m === 'POST' && base === '/organizaciones') {
    const d = await cuerpo<NuevaOrganizacion>(req)
    const existente = organizaciones.find((x) => x.nit === d.nit)
    if (existente) return json({ id: existente.id, creada: false })
    const o = { id: id(++consecutivo), nit: d.nit, razon_social: d.razon_social, naturaleza: d.naturaleza, tipos: d.tipos, estado: 'sin_reclamar' as const }
    organizaciones.push(o)
    return json({ id: o.id, creada: true })
  }
  if (m === 'GET' && base === '/contratos-servicio') return json(contratos)
  if (m === 'POST' && base === '/contratos-servicio') {
    const d = await cuerpo<NuevoContrato>(req)
    const c: ContratoServicio = { id: id(++consecutivo), organizacion_id: d.organizacion_id, tipo_servicio: d.tipo_servicio, vigente_desde: d.vigente_desde ?? new Date().toISOString(), vigente_hasta: d.vigente_hasta, estado: 'vigente', valor: d.valor }
    contratos = [c, ...contratos]
    return json(c, 201)
  }
  const sobreContrato = base.match(/^\/contratos-servicio\/([^/]+)\/(terminar|asignaciones)$/)
  if (m === 'POST' && sobreContrato) {
    const c = contratos.find((x) => x.id === sobreContrato[1])
    if (!c) return error(404, 'no_encontrado', 'El contrato no existe.')
    if (c.estado !== 'vigente') return error(409, 'conflicto', 'El contrato no está vigente.')
    if (sobreContrato[2] === 'terminar') {
      c.estado = 'terminado'
      c.vigente_hasta = new Date().toISOString()
      return json({ roles_vencidos: 2 })
    }
    const d = await cuerpo<{ cuenta_id: string; rol_id: string }>(req)
    const a: Asignacion = { id: id(++consecutivo), cuenta_id: d.cuenta_id, rol_id: d.rol_id, vigente_desde: new Date().toISOString(), vigente_hasta: null, origen: 'contrato_servicio' }
    return json(a, 201)
  }
  return null
}
