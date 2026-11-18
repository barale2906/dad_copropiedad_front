/**
 * Demo de las asambleas: una reunión en cada estado (en preparación, convocada, con el registro
 * abierto y sin quórum, instalada con quórum, cerrada con acta publicada y cancelada). El padrón
 * son los 40 bienes del demo (2,5 % cada uno; el representante de cada bien es su «Titular»).
 * Valida lo que valida el backend: antelación de 15 días en ordinarias, orden del día para
 * convocar, quórum para instalar (más de la mitad en primera convocatoria), un bien en un solo
 * asistente, rótulos sin repetir y el diagrama de estados. Se reinicia en cada inicio de sesión.
 */
import type {
  Asistente,
  CoincidenciaMesa,
  Constancia,
  DocumentoReunion,
  NuevaReunion,
  NuevoAsistente,
  Poder,
  PuntoOrdenDia,
  Reunion,
} from '@/api/tipos'
import { cuerpo, error, json, type Manejador, sinContenido } from './http'
import { bienesDemo } from './unidades'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const DIA = 86_400_000
const enDias = (d: number, hora = 15) => {
  const f = new Date(Date.now() + d * DIA)
  f.setUTCHours(hora, 0, 0, 0)
  return f.toISOString()
}
const ahora = () => new Date().toISOString()
const COEF = '0.025'

interface ReunionDemo {
  reunion: Reunion
  puntos: PuntoOrdenDia[]
  documentos: DocumentoReunion[]
  asistentes: Asistente[]
  poderes: Poder[]
  morosos: Set<string>
  constancias: Constancia[]
}

let reuniones: ReunionDemo[] = []
let consecutivo = 4800

const titular = (i: number) => ({ persona: id(5100 + i), nombre: `Titular ${bienesDemo()[i]?.codigo ?? ''}`, documento: String(80000000 + i) })

function reunion(n: number, titulo: string, estado: Reunion['estado'], extra: Partial<Reunion> = {}): Reunion {
  return {
    id: id(n), titulo, tipo: 'ordinaria', convocatoria: 'primera', modalidad: 'presencial', estado, fecha_programada: enDias(20),
    lugar: 'Salón social', configuracion: { base_computo: 'coeficiente', efecto_mora: 'sin_voto', exigir_soporte_poder: true, max_bienes_apoderado: 3 },
    acta_estado: 'pendiente', ...extra,
  }
}

const punto = (n: number, orden: number, titulo: string, estado: PuntoOrdenDia['estado'] = 'pendiente'): PuntoOrdenDia => ({ id: id(n), orden, titulo, estado })

/** Asistente con los bienes de los índices dados (como propietario, o como apoderado si se indica). */
function asistente(n: number, indices: number[], extra: Partial<Asistente> = {}, apoderado = false): Asistente {
  const b = bienesDemo()
  const t = titular(indices[0] ?? 0)
  return {
    id: id(n), persona_id: t.persona, nombre: t.nombre, metodo: 'mesa', whatsapp_confirmado: false, presente: true,
    bienes: indices.map((i) => ({ bien_privado_id: b[i]?.id ?? '', codigo: b[i]?.codigo ?? '', coeficiente: COEF, calidad: apoderado ? 'apoderado' : 'propietario', moroso: false })),
    ...extra,
  }
}

const base = (r: Reunion): ReunionDemo => ({ reunion: r, puntos: [], documentos: [], asistentes: [], poderes: [], morosos: new Set(), constancias: [] })

export function iniciarAsambleas(): void {
  consecutivo = 4800
  const preparacion = base(reunion(4001, 'Asamblea ordinaria 2027', 'borrador', { fecha_programada: enDias(30) }))
  preparacion.puntos = [punto(4011, 1, 'Verificación del quórum'), punto(4012, 2, 'Aprobación del presupuesto 2027')]
  const convocada = base(reunion(4002, 'Asamblea extraordinaria: fachada', 'convocada', { tipo: 'extraordinaria', fecha_programada: enDias(8), convocada_en: enDias(-7) }))
  convocada.puntos = [punto(4021, 1, 'Cuota extraordinaria para la fachada')]
  convocada.constancias = [
    { persona_id: titular(0).persona, nombre: titular(0).nombre, canal: 'whatsapp', estado_envio: 'enviado', acuse: 'read', enviado_en: enDias(-7) },
    { persona_id: titular(1).persona, nombre: titular(1).nombre, canal: 'whatsapp', estado_envio: 'enviado', acuse: 'delivered', enviado_en: enDias(-7) },
    { persona_id: titular(2).persona, nombre: titular(2).nombre, canal: 'correo', estado_envio: 'fallido', enviado_en: enDias(-7) },
  ]
  const registro = base(reunion(4003, 'Asamblea ordinaria 2026', 'en_registro', { fecha_programada: enDias(0, 13), convocada_en: enDias(-20) }))
  registro.puntos = [punto(4031, 1, 'Verificación del quórum'), punto(4032, 2, 'Informe de gestión'), punto(4033, 3, 'Elección del consejo')]
  registro.asistentes = [asistente(4301, [0, 1]), asistente(4302, [4]), asistente(4303, [10], { presente: false })]
  registro.poderes = [{ id: id(4351), bien_privado_id: bienesDemo()[6]?.id ?? '', apoderado_persona_id: id(5001), soporte_archivo_id: id(1), estado: 'pendiente', registrado_en: enDias(0, 13) }]
  registro.asistentes.push({ ...asistente(4304, [6], {}, true), persona_id: id(5001), nombre: 'Marta Residente' })
  const instalada = base(reunion(4004, 'Asamblea ordinaria de mitad de año', 'instalada', { fecha_programada: enDias(0, 12), instalada_en: enDias(0, 12), convocada_en: enDias(-25) }))
  instalada.puntos = [punto(4041, 1, 'Verificación del quórum', 'terminado'), punto(4042, 2, 'Aprobación de estados financieros', 'en_curso'), punto(4043, 3, 'Proposiciones')]
  instalada.asistentes = Array.from({ length: 11 }, (_, k) => asistente(4401 + k, [k * 2, k * 2 + 1]))
  const cerrada = base(reunion(4005, 'Asamblea ordinaria 2025', 'cerrada', { fecha_programada: enDias(-200), cerrada_en: enDias(-200), acta_estado: 'publicada' }))
  const cancelada = base(reunion(4006, 'Asamblea extraordinaria (aplazada)', 'cancelada', { fecha_programada: enDias(-40), motivo_cancelacion: 'Cambio de fecha por obras.' }))
  reuniones = [preparacion, convocada, registro, instalada, cerrada, cancelada]
}

function quorumDe(r: ReunionDemo) {
  const total = bienesDemo().length
  const cuentan = r.asistentes
    .filter((a) => a.presente)
    .flatMap((a) => a.bienes)
    .filter((b) => !(r.reunion.configuracion.efecto_mora === 'sin_voto_ni_quorum' && r.morosos.has(b.bien_privado_id)))
  const pct = ((cuentan.length / total) * 100).toFixed(2)
  return {
    coeficiente_presente: (cuentan.length * Number(COEF)).toFixed(8), coeficiente_total: '1.00000000', porcentaje_coeficiente: pct,
    unidades_presentes: cuentan.length, unidades_total: total, asistentes: r.asistentes.filter((a) => a.presente).length,
  }
}

const hayQuorum = (r: ReunionDemo) => r.reunion.convocatoria !== 'primera' || Number(quorumDe(r).porcentaje_coeficiente) > 50

const TRANSICIONES: Record<string, { desde: Reunion['estado'][]; hacia: Reunion['estado'] }> = {
  abrir_registro: { desde: ['convocada'], hacia: 'en_registro' },
  instalar: { desde: ['en_registro'], hacia: 'instalada' },
  suspender: { desde: ['instalada'], hacia: 'suspendida' },
  reanudar: { desde: ['suspendida'], hacia: 'instalada' },
  cerrar: { desde: ['instalada', 'suspendida', 'convocada'], hacia: 'cerrada' },
  cancelar: { desde: ['borrador', 'convocada', 'en_registro'], hacia: 'cancelada' },
}

function bienOcupado(r: ReunionDemo, bienId: string) {
  return r.asistentes.some((a) => a.bienes.some((b) => b.bien_privado_id === bienId))
}

export const asambleas: Manejador = async (req, ruta) => {
  const m = req.method
  const b = ruta.match(/^\/copropiedades\/[^/]+\/asambleas(\/.*)?$/)
  if (!b) return null
  const resto = b[1] ?? ''
  const q = new URL(req.url).searchParams

  if (resto === '') {
    if (m === 'GET') return json({ datos: reuniones.map((r) => r.reunion).filter((r) => !q.get('estado') || r.estado === q.get('estado')), siguiente: null })
    if (m === 'POST') {
      const d = await cuerpo<NuevaReunion>(req)
      if (!d.titulo?.trim()) return error(422, 'validacion', 'Escriba el título.')
      const r = base(reunion(++consecutivo, d.titulo, 'borrador', { ...d, convocatoria: d.convocatoria ?? 'primera', configuracion: d.configuracion ?? {} }))
      reuniones = [r, ...reuniones]
      return json(r.reunion, 201)
    }
  }
  if (m === 'GET' && resto === '/actas') return json(reuniones.map((r) => r.reunion).filter((r) => r.acta_estado === 'publicada'))
  if (m === 'POST' && resto === '/rotulos') {
    const d = await cuerpo<{ prefijo: string; cantidad: number }>(req)
    if (!d.prefijo?.trim() || d.cantidad < 1 || d.cantidad > 500) return error(422, 'validacion', 'La cantidad va de 1 a 500.')
    return new Response('%PDF-1.4 rotulos demo', { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="rotulos.pdf"' } })
  }

  const p = resto.match(/^\/([^/]+)(\/.*)?$/)
  if (!p) return null
  const r = reuniones.find((x) => x.reunion.id === p[1])
  if (!r) return error(404, 'no_encontrado', 'La reunión no existe.')
  const sub = p[2] ?? ''
  const reu = r.reunion

  if (sub === '') {
    if (m === 'GET') return json({ reunion: reu, puntos: [...r.puntos].sort((a, c) => a.orden - c.orden), documentos: r.documentos })
    if (m === 'PATCH') {
      const d = await cuerpo<{ datos?: NuevaReunion; configuracion?: Reunion['configuracion'] }>(req)
      if (d.datos && reu.estado !== 'borrador') return error(409, 'conflicto', 'La reunión ya fue convocada: los datos quedaron fijos.')
      if (d.datos) Object.assign(reu, d.datos)
      if (d.configuracion) reu.configuracion = d.configuracion
      return json(reu)
    }
  }
  if (m === 'POST' && sub === '/transiciones') {
    const { accion, motivo } = await cuerpo<{ accion: string; motivo?: string | null }>(req)
    const t = TRANSICIONES[accion]
    if (!t || !t.desde.includes(reu.estado)) return error(409, 'conflicto_estado', 'Ese cambio ya no aplica: recargue la reunión.')
    if (accion === 'instalar' && !hayQuorum(r)) return error(409, 'conflicto', 'No hay quórum: se necesita más de la mitad de los coeficientes.')
    if (accion === 'cancelar' && !motivo?.trim()) return error(422, 'validacion', 'Indique el motivo de la cancelación.')
    reu.estado = t.hacia
    if (accion === 'instalar') reu.instalada_en = ahora()
    if (accion === 'cerrar') reu.cerrada_en = ahora()
    if (accion === 'cancelar') reu.motivo_cancelacion = motivo ?? null
    return json(reu)
  }

  // Orden del día y anexos
  if (sub === '/puntos' && m === 'POST') {
    if (reu.estado !== 'borrador') return error(409, 'conflicto', 'La reunión ya fue convocada.')
    const d = await cuerpo<{ orden: number; titulo: string; descripcion?: string | null }>(req)
    if (r.puntos.some((x) => x.orden === d.orden)) return error(409, 'conflicto', 'Ya hay un punto con ese orden.')
    const nuevo = { ...punto(++consecutivo, d.orden, d.titulo), descripcion: d.descripcion }
    r.puntos.push(nuevo)
    return json(nuevo, 201)
  }
  const pun = sub.match(/^\/puntos\/([^/]+)(\/estado)?$/)
  if (pun) {
    const x = r.puntos.find((y) => y.id === pun[1])
    if (!x) return error(404, 'no_encontrado', 'El punto no existe.')
    if (pun[2] && m === 'PUT') {
      if (reu.estado !== 'instalada') return error(409, 'conflicto_estado', 'La asamblea no está instalada.')
      const { estado } = await cuerpo<{ estado: PuntoOrdenDia['estado'] }>(req)
      if (estado === 'en_curso') r.puntos.forEach((y) => y.estado === 'en_curso' && (y.estado = 'aplazado'))
      x.estado = estado
      return json(x)
    }
    if (reu.estado !== 'borrador') return error(409, 'conflicto', 'La reunión ya fue convocada.')
    if (m === 'PUT') {
      Object.assign(x, await cuerpo<Partial<PuntoOrdenDia>>(req))
      return json(x)
    }
    if (m === 'DELETE') {
      r.puntos = r.puntos.filter((y) => y.id !== x.id)
      return sinContenido()
    }
  }
  if (sub === '/documentos' && m === 'POST') {
    if (!['borrador', 'convocada'].includes(reu.estado)) return error(409, 'conflicto', 'La reunión ya está en curso.')
    const d = await cuerpo<DocumentoReunion>(req)
    r.documentos.push(d)
    return json(d, 201)
  }
  const doc = sub.match(/^\/documentos\/([^/]+)$/)
  if (doc && m === 'DELETE') {
    r.documentos = r.documentos.filter((d) => d.archivo_id !== doc[1])
    return sinContenido()
  }

  // Convocatoria y morosos
  if (m === 'POST' && (sub === '/convocatoria' || sub === '/segunda-convocatoria')) {
    if (sub === '/segunda-convocatoria') {
      if (reu.estado !== 'en_registro' || hayQuorum(r)) return error(409, 'conflicto', 'Hay quórum o la reunión no está en registro.')
      reu.estado = 'cancelada'
      reu.motivo_cancelacion = 'Sin quórum: se convocó la segunda reunión (art. 41).'
      const segunda = base(reunion(++consecutivo, `${reu.titulo} (segunda convocatoria)`, 'convocada', {
        convocatoria: 'segunda', fecha_programada: enDias(3, 1), reunion_origen_id: reu.id, convocada_en: ahora(), configuracion: reu.configuracion,
      }))
      segunda.puntos = r.puntos.map((x) => ({ ...x, id: id(++consecutivo), estado: 'pendiente' }))
      reuniones = [segunda, ...reuniones]
      return json({ reunion: segunda.reunion, bienes_padron: 40, envios_whatsapp: 34, envios_correo: 38, sin_contacto: 2 }, 201)
    }
    if (reu.estado !== 'borrador') return error(409, 'conflicto_estado', 'La reunión no está en preparación.')
    if (!r.puntos.length) return error(422, 'validacion', 'El orden del día necesita al menos un punto.')
    if (reu.tipo === 'ordinaria' && Date.parse(reu.fecha_programada) < Date.now() + 15 * DIA - DIA / 2) {
      return error(422, 'validacion', 'Una asamblea ordinaria se convoca con al menos 15 días calendario de anticipación (art. 39).')
    }
    reu.estado = 'convocada'
    reu.convocada_en = ahora()
    r.constancias = bienesDemo().slice(0, 5).map((_, i) => ({ persona_id: titular(i).persona, nombre: titular(i).nombre, canal: 'whatsapp' as const, estado_envio: 'enviado', acuse: 'sent', enviado_en: ahora() }))
    return json({ reunion: reu, bienes_padron: 40, envios_whatsapp: 34, envios_correo: 38, sin_contacto: 2 })
  }
  if (m === 'GET' && sub === '/convocatoria/constancias') return json(r.constancias)
  if (m === 'PUT' && sub === '/morosos') {
    if (['instalada', 'suspendida', 'cerrada'].includes(reu.estado)) return error(409, 'conflicto', 'La reunión ya se instaló.')
    const { codigos } = await cuerpo<{ codigos: string[] }>(req)
    const encontrados = bienesDemo().filter((x) => codigos.includes(x.codigo))
    r.morosos = new Set(encontrados.map((x) => x.id))
    return json({ marcados: encontrados.length, no_encontrados: codigos.filter((c) => !encontrados.some((x) => x.codigo === c)) })
  }

  // Quórum y tablero
  if (sub === '/quorum') return json(quorumDe(r), m === 'POST' ? 201 : 200)
  if (m === 'GET' && sub === '/tablero') {
    return json({
      reunion: reu, quorum: quorumDe(r), hay_quorum: hayQuorum(r), punto_en_curso: r.puntos.find((x) => x.estado === 'en_curso')?.titulo ?? null,
      preguntas_abiertas: [], ultima_cerrada: null, generado_en: ahora(),
    })
  }

  // Mesa
  if (m === 'GET' && sub === '/mesa') {
    const t = (q.get('texto') ?? '').trim().toUpperCase()
    const lista: CoincidenciaMesa[] = bienesDemo()
      .map((x, i) => ({ x, i }))
      .filter(({ x, i }) => t.length >= 2 && (x.codigo.includes(t) || titular(i).documento.includes(t)))
      .slice(0, 10)
      .map(({ x, i }) => ({
        bien_privado_id: x.id, codigo: x.codigo, coeficiente: COEF, moroso: r.morosos.has(x.id), representante_persona_id: titular(i).persona,
        representante_nombre: titular(i).nombre, representante_telefono: '+57 300 555 01' + String(i).padStart(2, '0'), otros_bienes: [],
        asistente_actual: r.asistentes.find((a) => a.bienes.some((y) => y.bien_privado_id === x.id))?.id ?? null,
      }))
    return json(lista)
  }
  if (sub === '/asistentes') {
    if (m === 'GET') return json(r.asistentes)
    if (m === 'POST') {
      if (!['en_registro', 'instalada', 'suspendida'].includes(reu.estado)) return error(409, 'conflicto_estado', 'El registro no está abierto.')
      const d = await cuerpo<NuevoAsistente>(req)
      const propios = d.bienes_propios ?? []
      const poderes = d.poderes ?? []
      if (!propios.length && !poderes.length) return error(422, 'validacion', 'Indique al menos un bien.')
      if (reu.configuracion.exigir_soporte_poder && poderes.some((x) => !x.soporte_archivo_id)) return error(422, 'validacion', 'Falta el soporte escrito del poder.')
      if (reu.configuracion.max_bienes_apoderado && poderes.length > reu.configuracion.max_bienes_apoderado) return error(409, 'conflicto', 'Supera el máximo de bienes por apoderado.')
      const ocupado = [...propios, ...poderes.map((x) => x.bien_privado_id)].find((x) => bienOcupado(r, x))
      if (ocupado) return error(409, 'conflicto', `El bien ${bienesDemo().find((x) => x.id === ocupado)?.codigo ?? ''} ya está registrado con otro asistente.`)
      const todos = bienesDemo()
      const indice = (bid: string) => todos.findIndex((x) => x.id === bid)
      const nuevo: Asistente = {
        id: id(++consecutivo), persona_id: d.persona_id ?? id(++consecutivo), nombre: d.nombre ?? titular(indice(propios[0] ?? '')).nombre, metodo: d.metodo ?? 'mesa',
        telefono: d.telefono, whatsapp_confirmado: false, presente: true, rotulo: d.rotulo,
        bienes: [
          ...propios.map((bid) => ({ bien_privado_id: bid, codigo: todos[indice(bid)]?.codigo ?? '', coeficiente: COEF, calidad: 'propietario' as const, moroso: r.morosos.has(bid) })),
          ...poderes.map((x) => ({ bien_privado_id: x.bien_privado_id, codigo: todos[indice(x.bien_privado_id)]?.codigo ?? '', coeficiente: COEF, calidad: 'apoderado' as const, moroso: r.morosos.has(x.bien_privado_id) })),
        ],
      }
      poderes.forEach((x) => r.poderes.push({ id: id(++consecutivo), bien_privado_id: x.bien_privado_id, apoderado_persona_id: nuevo.persona_id, soporte_archivo_id: x.soporte_archivo_id, estado: 'pendiente', registrado_en: ahora() }))
      r.asistentes.push(nuevo)
      const avisos = nuevo.bienes.filter((x) => x.moroso).map((x) => `${x.codigo} está en mora: ${reu.configuracion.efecto_mora === 'informativo' ? 'vota igual' : 'no vota'}.`)
      return json({ asistente: nuevo, token_papeleta: null, avisos }, 201)
    }
  }
  const asi = sub.match(/^\/asistentes\/([^/]+)\/(salida|reingreso|rotulo|poderes|confirmacion)$/)
  if (asi) {
    const a = r.asistentes.find((x) => x.id === asi[1])
    if (!a) return error(404, 'no_encontrado', 'El asistente no existe.')
    if (asi[2] === 'salida') {
      if (!a.presente) return error(409, 'conflicto', 'No estaba presente.')
      a.presente = false
      return json(a)
    }
    if (asi[2] === 'reingreso') {
      if (a.presente) return error(409, 'conflicto', 'Ya estaba presente.')
      a.presente = true
      return json(a)
    }
    if (asi[2] === 'rotulo') {
      const { codigo } = await cuerpo<{ codigo?: string | null }>(req)
      if (codigo && r.asistentes.some((x) => x.id !== a.id && x.rotulo === codigo)) return error(409, 'conflicto', `El rótulo ${codigo} ya lo tiene otro asistente.`)
      a.rotulo = codigo ?? null
      return json(a)
    }
    if (asi[2] === 'poderes') {
      const d = await cuerpo<{ bien_privado_id: string; soporte_archivo_id?: string | null }>(req)
      if (bienOcupado(r, d.bien_privado_id)) return error(409, 'conflicto', 'Ese bien ya está registrado con otro asistente.')
      const bien = bienesDemo().find((x) => x.id === d.bien_privado_id)
      a.bienes.push({ bien_privado_id: d.bien_privado_id, codigo: bien?.codigo ?? '', coeficiente: COEF, calidad: 'apoderado', moroso: r.morosos.has(d.bien_privado_id) })
      return json(a, 201)
    }
    return json(a)
  }
  if (m === 'GET' && sub === '/poderes') return json(r.poderes)
  const pod = sub.match(/^\/poderes\/([^/]+)\/estado$/)
  if (pod && m === 'PUT') {
    const x = r.poderes.find((y) => y.id === pod[1])
    if (!x) return error(404, 'no_encontrado', 'El poder no existe.')
    const { estado, motivo } = await cuerpo<{ estado: Poder['estado']; motivo?: string | null }>(req)
    if (x.estado !== 'pendiente') return error(409, 'conflicto_estado', 'El poder ya fue revisado.')
    Object.assign(x, { estado, motivo, revisado_en: ahora() })
    if (estado === 'rechazado') r.asistentes.forEach((a) => (a.bienes = a.bienes.filter((y) => !(y.bien_privado_id === x.bien_privado_id && y.calidad === 'apoderado'))))
    return json(x)
  }
  return null
}
