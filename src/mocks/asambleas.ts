/**
 * Demo de las asambleas: una reunión en cada estado (en preparación, convocada, con el registro
 * abierto y sin quórum, instalada con quórum y preguntas en cada estado, cerrada con acta
 * publicada, cerrada con el acta por generar y cancelada). El padrón
 * son los 40 bienes del demo (2,5 % cada uno; el representante de cada bien es su «Titular»).
 * Valida lo que valida el backend: antelación de 15 días en ordinarias, orden del día para
 * convocar, quórum para instalar (más de la mitad en primera convocatoria), un bien en un solo
 * asistente, rótulos sin repetir, el diagrama de estados, la `Idempotency-Key` de los votos y
 * que un bien vote una sola vez. El escrutinio sigue la forma de `domain::Escrutinio`. Se
 * reinicia en cada inicio de sesión.
 */
import type {
  Asistente,
  CoincidenciaMesa,
  Constancia,
  DatosActa,
  DecisionEscrutinio,
  DocumentoReunion,
  Escrutinio,
  NuevaPregunta,
  NuevaReunion,
  NuevoAsistente,
  NuevoVoto,
  Poder,
  Pregunta,
  PuntoOrdenDia,
  Reunion,
  Voto,
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

interface VotoDemo {
  bien: string
  opciones: string[]
  canal: NuevoVoto['canal']
  asistente: Asistente
  apoderado: boolean
  en: string
}

interface PreguntaDemo {
  p: Pregunta
  votos: VotoDemo[]
  resultado: Escrutinio | null
}

interface ReunionDemo {
  reunion: Reunion
  preguntas: PreguntaDemo[]
  puntos: PuntoOrdenDia[]
  documentos: DocumentoReunion[]
  asistentes: Asistente[]
  poderes: Poder[]
  morosos: Set<string>
  constancias: Constancia[]
}

let reuniones: ReunionDemo[] = []
let consecutivo = 4800
/** Respuestas de voto por `Idempotency-Key` (un reintento devuelve la original). */
let votosPorClave = new Map<string, Voto>()

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

const base = (r: Reunion): ReunionDemo => ({ reunion: r, preguntas: [], puntos: [], documentos: [], asistentes: [], poderes: [], morosos: new Set(), constancias: [] })

/** Opciones de una pregunta nueva (sí/no: «Sí», «No» y «Abstención» si se pide). */
function opcionesDe(n: number, d: NuevaPregunta) {
  const textos = d.tipo === 'si_no' ? ['Sí', 'No', ...(d.con_abstencion === false ? [] : ['Abstención'])].map((texto) => ({ texto, en_blanco: false, candidatos: [] as string[] })) : (d.opciones ?? [])
  return textos.map((o, k) => ({ id: id(n * 10 + k), orden: k + 1, texto: o.texto, en_blanco: o.en_blanco ?? false, candidatos: o.candidatos ?? [] }))
}

function pregunta(n: number, orden: number, d: NuevaPregunta, extra: Partial<Pregunta> = {}): Pregunta {
  return {
    id: id(n), orden, enunciado: d.enunciado, tipo: d.tipo, tipo_voto: d.tipo_voto ?? 'nominal', base_computo: d.base_computo ?? 'coeficiente',
    regla_mayoria: d.regla_mayoria ?? { regla: 'simple' }, max_selecciones: d.tipo === 'seleccion_multiple' ? (d.max_selecciones ?? 2) : 1,
    cupos: d.cupos ?? null, cargo: d.cargo ?? null, estado: 'borrador', punto_id: d.punto_id ?? null,
    temporizador_segundos: d.temporizador_segundos ?? null, opciones: opcionesDe(n, d), ...extra,
  }
}

/** Mismas reglas que `Pregunta::validar_definicion` del backend. */
function problemaDefinicion(p: Pregunta): string | null {
  if (!p.enunciado?.trim()) return 'Escriba la pregunta.'
  const validas = p.opciones.filter((o) => !o.en_blanco).length
  if (p.opciones.length < 2) return 'La pregunta necesita al menos dos opciones.'
  if (new Set(p.opciones.map((o) => o.texto.toLowerCase())).size !== p.opciones.length) return 'Las opciones no pueden repetirse.'
  if (p.tipo !== 'eleccion' && validas !== p.opciones.length) return 'El voto en blanco solo aplica en elecciones.'
  if (p.tipo === 'seleccion_multiple' && (p.max_selecciones < 2 || p.max_selecciones > validas)) return 'La selección múltiple permite de 2 al número de opciones.'
  if (p.tipo === 'eleccion' && (!p.cupos || !validas)) return 'Una elección necesita cupos y al menos una plancha o candidato.'
  if (p.tipo !== 'eleccion' && (p.cupos != null || p.cargo != null)) return 'Los cupos y el cargo solo aplican a elecciones.'
  return null
}

/** Votos de ejemplo: los asistentes `desde..hasta` eligen la opción `k` por todos sus bienes. */
function votosDemo(r: ReunionDemo, p: Pregunta, reparto: [desde: number, hasta: number, k: number][]): VotoDemo[] {
  return reparto.flatMap(([desde, hasta, k]) =>
    r.asistentes.slice(desde, hasta).flatMap((a) =>
      a.bienes.map((b) => ({ bien: b.bien_privado_id, opciones: [p.opciones[k]?.id ?? ''], canal: 'presencial' as const, asistente: a, apoderado: b.calidad === 'apoderado', en: enDias(0, 12) })),
    ),
  )
}

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
  const registro = base(reunion(4003, 'Asamblea ordinaria 2026', 'en_registro', { fecha_programada: enDias(0, 13), convocada_en: enDias(-20), modalidad: 'mixta', enlace_video: 'https://meet.google.com/dad-demo-2026' }))
  registro.puntos = [punto(4031, 1, 'Verificación del quórum'), punto(4032, 2, 'Informe de gestión'), punto(4033, 3, 'Elección del consejo')]
  registro.asistentes = [asistente(4301, [0, 1]), asistente(4302, [4]), asistente(4303, [10], { presente: false })]
  registro.poderes = [{ id: id(4351), bien_privado_id: bienesDemo()[6]?.id ?? '', apoderado_persona_id: id(5001), soporte_archivo_id: id(1), estado: 'pendiente', registrado_en: enDias(0, 13) }]
  registro.asistentes.push({ ...asistente(4304, [6], {}, true), persona_id: id(5001), nombre: 'Marta Residente' })
  const instalada = base(reunion(4004, 'Asamblea ordinaria de mitad de año', 'instalada', { fecha_programada: enDias(0, 12), instalada_en: enDias(0, 12), convocada_en: enDias(-25) }))
  instalada.puntos = [punto(4041, 1, 'Verificación del quórum', 'terminado'), punto(4042, 2, 'Aprobación de estados financieros', 'en_curso'), punto(4043, 3, 'Proposiciones')]
  instalada.asistentes = Array.from({ length: 11 }, (_, k) => asistente(4401 + k, [k * 2, k * 2 + 1]))
  const estados = pregunta(6001, 1, { enunciado: '¿Aprueba los estados financieros de 2026?', tipo: 'si_no', punto_id: id(4042) }, { estado: 'abierta', abierta_en: enDias(0, 12) })
  const vigilancia = pregunta(6002, 2, { enunciado: '¿Qué empresa de vigilancia se contrata?', tipo: 'seleccion_unica', opciones: [{ texto: 'Seguridad Andina' }, { texto: 'Vigías del Norte' }] })
  const consejo = pregunta(6003, 3, {
    enunciado: 'Elección del consejo de administración', tipo: 'eleccion', cupos: 3, cargo: 'consejero',
    opciones: [{ texto: 'Plancha 1', candidatos: [titular(0).persona, titular(2).persona] }, { texto: 'Plancha 2', candidatos: [titular(4).persona] }, { texto: 'Voto en blanco', en_blanco: true }],
  })
  const cuota = pregunta(6004, 4, { enunciado: '¿Aprueba la cuota extraordinaria para la fachada?', tipo: 'si_no', tipo_voto: 'reservado', regla_mayoria: { regla: 'calificada_70' } }, {
    estado: 'cerrada', abierta_en: enDias(0, 12), cerrada_en: enDias(0, 12),
  })
  instalada.preguntas = [
    { p: estados, votos: votosDemo(instalada, estados, [[0, 6, 0], [6, 7, 1]]), resultado: null },
    { p: vigilancia, votos: [], resultado: null },
    { p: consejo, votos: [], resultado: null },
    { p: cuota, votos: votosDemo(instalada, cuota, [[0, 8, 0], [8, 10, 1]]), resultado: null },
  ]
  const pc = instalada.preguntas[3]
  if (pc) pc.resultado = escrutinioDe(instalada, pc)
  const cerrada = base(reunion(4005, 'Asamblea ordinaria 2025', 'cerrada', { fecha_programada: enDias(-200), cerrada_en: enDias(-200), acta_estado: 'publicada', acta_archivo_id: id(4590), acta_firmada_archivo_id: id(4591) }))
  const parqueaderos = base(reunion(4007, 'Asamblea extraordinaria: parqueaderos', 'cerrada', {
    tipo: 'extraordinaria', fecha_programada: enDias(-2, 14), instalada_en: enDias(-2, 14), cerrada_en: enDias(-2, 16), convocada_en: enDias(-12),
  }))
  parqueaderos.puntos = [punto(4071, 1, 'Verificación del quórum', 'terminado'), punto(4072, 2, 'Reglamento de parqueaderos', 'terminado')]
  parqueaderos.asistentes = Array.from({ length: 12 }, (_, k) => asistente(4701 + k, [k * 2, k * 2 + 1]))
  const reglamento = pregunta(6071, 1, { enunciado: '¿Aprueba el reglamento de parqueaderos?', tipo: 'si_no' }, { estado: 'cerrada', abierta_en: enDias(-2, 15), cerrada_en: enDias(-2, 15) })
  parqueaderos.preguntas = [{ p: reglamento, votos: votosDemo(parqueaderos, reglamento, [[0, 9, 0], [9, 11, 1], [11, 12, 2]]), resultado: null }]
  const pr = parqueaderos.preguntas[0]
  if (pr) pr.resultado = escrutinioDe(parqueaderos, pr)
  const cancelada = base(reunion(4006, 'Asamblea extraordinaria (aplazada)', 'cancelada', { fecha_programada: enDias(-40), motivo_cancelacion: 'Cambio de fecha por obras.' }))
  reuniones = [preparacion, convocada, registro, instalada, parqueaderos, cerrada, cancelada]
  votosPorClave = new Map()
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

/** Bienes que votan: presentes y, si la mora resta el voto, sin los morosos. */
function habilitadosDe(r: ReunionDemo): string[] {
  const restaMora = r.reunion.configuracion.efecto_mora !== 'informativo'
  return r.asistentes.filter((a) => a.presente).flatMap((a) => a.bienes).filter((b) => !(restaMora && r.morosos.has(b.bien_privado_id))).map((b) => b.bien_privado_id)
}

const conteo = (n: number) => ({ coeficiente: (n * Number(COEF)).toFixed(8), unidades: n })
const pct = (n: number, de: number) => (de ? ((n / de) * 100).toFixed(4) : '0')

/** Escrutinio como lo calcula `domain::resultados` (todos los bienes pesan 2,5 %). */
function escrutinioDe(r: ReunionDemo, pd: PreguntaDemo): Escrutinio {
  const p = pd.p
  const votantes = new Set(pd.votos.map((v) => v.bien))
  const habilitados = new Set([...habilitadosDe(r), ...votantes]).size
  const total = bienesDemo().length
  const votosDe = (opcion: string) => pd.votos.filter((v) => v.opciones.includes(opcion)).length
  const umbral = (v: number) => {
    const reg = p.regla_mayoria
    if (reg.regla === 'calificada_70') return v >= total * 0.7
    if (reg.regla === 'personalizada') return v >= ((reg.sobre === 'total' ? total : habilitados) * Number(reg.porcentaje ?? '50')) / 100
    return v > habilitados / 2
  }
  const decide = (k: number) => p.tipo !== 'eleccion' && (p.tipo !== 'si_no' || k === 0)
  const opciones = p.opciones.map((o, k) => {
    const v = votosDe(o.id)
    return {
      opcion_id: o.id, texto: o.texto, en_blanco: o.en_blanco, votos: conteo(v), porcentaje_coeficiente: pct(v, habilitados), porcentaje_unidades: pct(v, habilitados),
      aprobada: decide(k) ? umbral(v) : null, aprobada_en_otra_base: decide(k) ? umbral(v) : null, cupos: null,
    }
  })
  let decision: DecisionEscrutinio
  if (p.tipo === 'si_no') decision = { decision: opciones[0]?.aprobada ? 'aprobada' : 'no_aprobada' }
  else if (p.tipo === 'seleccion_multiple') decision = { decision: 'por_opcion' }
  else if (p.tipo === 'seleccion_unica') {
    const max = Math.max(0, ...opciones.map((o) => o.votos.unidades))
    const primeras = opciones.filter((o) => max > 0 && o.votos.unidades === max)
    const g = primeras[0]
    decision = primeras.length === 1 && g?.aprobada ? { decision: 'ganadora', opcion_id: g.opcion_id } : { decision: 'sin_ganadora', empate: primeras.length > 1 }
  } else {
    const cupos = p.cupos ?? 1
    const planchas = opciones.filter((o) => !o.en_blanco)
    const suma = planchas.reduce((t, o) => t + o.votos.unidades, 0)
    const cociente = suma ? suma / cupos : 0
    const reparto = planchas.map((o) => {
      const exacto = cociente ? o.votos.unidades / cociente : 0
      return { opcion_id: o.opcion_id, por_cociente: Math.floor(exacto), por_residuo: 0, residuo: (exacto - Math.floor(exacto)).toFixed(4) }
    })
    let libres = suma ? cupos - reparto.reduce((t, c) => t + c.por_cociente, 0) : cupos
    for (const c of [...reparto].sort((a, b) => Number(b.residuo) - Number(a.residuo))) {
      if (libres <= 0 || Number(c.residuo) === 0) break
      c.por_residuo = 1
      libres--
    }
    decision = { decision: 'reparto', cociente: cociente.toFixed(4), cupos: reparto, empate: false, sin_asignar: Math.max(0, libres) }
  }
  return {
    base_computo: p.base_computo, regla: p.regla_mayoria, habilitados: conteo(habilitados), total: conteo(total), votantes: conteo(votantes.size), sin_votar: conteo(Math.max(0, habilitados - votantes.size)),
    opciones, decision, advertencia_unidades: p.base_computo === 'unidades',
  }
}

const enVivo = (r: ReunionDemo, pd: PreguntaDemo) => ({ pregunta: pd.p, escrutinio: pd.resultado ?? escrutinioDe(r, pd) })

/** Datos del acta como los arma `datos_acta` del backend. */
function datosActa(r: ReunionDemo): DatosActa {
  const reu = r.reunion
  const hora = (t?: string | null) => (t ? new Date(t).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : null)
  const q = quorumDe(r)
  return {
    copropiedad: 'Conjunto Demo', nit: '900123456-8', titulo: reu.titulo, tipo: reu.tipo, convocatoria: reu.convocatoria.replace('_', ' '), modalidad: reu.modalidad,
    lugar: reu.lugar ?? null, fecha: hora(reu.fecha_programada) ?? '', instalada: hora(reu.instalada_en), cerrada: hora(reu.cerrada_en),
    orden_del_dia: [...r.puntos].sort((a, b) => a.orden - b.orden).map((x) => `${x.orden}. ${x.titulo}`),
    quorum: [{ momento: 'instalacion', hora: hora(reu.instalada_en) ?? '', coeficiente: q.coeficiente_presente, porcentaje_coeficiente: q.porcentaje_coeficiente, unidades: q.unidades_presentes, unidades_total: q.unidades_total, asistentes: q.asistentes }],
    asistentes: r.asistentes.map((a) => ({ nombre: a.nombre, bienes: a.bienes.map((b) => b.codigo), coeficiente: (a.bienes.length * Number(COEF)).toFixed(8), poderes: [], entrada: hora(reu.instalada_en) ?? 'no ingresó', salidas: [] })),
    morosos: bienesDemo().filter((b) => r.morosos.has(b.id)).map((b) => b.codigo), efecto_mora: reu.configuracion.efecto_mora?.replace(/_/g, ' ') ?? 'informativo',
    preguntas: r.preguntas.filter((x) => x.p.estado !== 'borrador').map((x) => {
      const e = x.p.estado === 'anulada' ? null : (x.resultado ?? escrutinioDe(r, x))
      const op = (oid: string) => x.p.opciones.find((o) => o.id === oid)?.texto ?? ''
      return {
        orden: x.p.orden, enunciado: x.p.enunciado, tipo: x.p.tipo.replace('_', ' '), tipo_voto: x.p.tipo_voto, abierta: hora(x.p.abierta_en), cerrada: hora(x.p.cerrada_en), escrutinio: e,
        decision: x.p.estado === 'anulada' ? 'anulada' : e?.decision.decision.replace('_', ' ') ?? 'sin escrutinio',
        detalle: x.p.tipo_voto === 'nominal' ? x.votos.map((v) => ({ bien: bienesDemo().find((b) => b.id === v.bien)?.codigo ?? '', coeficiente: COEF, opcion: v.opciones.map(op).join(', '), canal: v.canal, hora: hora(v.en) ?? '', apoderado: v.apoderado })) : [],
        elegidos: [],
      }
    }),
    advertencias: reu.configuracion.efecto_mora && reu.configuracion.efecto_mora !== 'informativo' ? [`Efecto de la mora en esta asamblea: ${reu.configuracion.efecto_mora.replace(/_/g, ' ')} (decidido por la copropiedad).`] : [],
    generada: hora(ahora()) ?? '',
  }
}

const csv = (filas: string[][], nombre: string) =>
  new Response(filas.map((f) => f.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${nombre}"` },
  })

const hayQuorum = (r: ReunionDemo) => r.reunion.convocatoria !== 'primera' || Number(quorumDe(r).porcentaje_coeficiente) > 50

const TRANSICIONES: Record<string, { desde: Reunion['estado'][]; hacia: Reunion['estado'] }> = {
  abrir_registro: { desde: ['convocada'], hacia: 'en_registro' },
  instalar: { desde: ['en_registro'], hacia: 'instalada' },
  suspender: { desde: ['instalada'], hacia: 'suspendida' },
  reanudar: { desde: ['suspendida'], hacia: 'instalada' },
  cerrar: { desde: ['instalada', 'suspendida', 'convocada'], hacia: 'cerrada' },
  cancelar: { desde: ['borrador', 'convocada', 'en_registro'], hacia: 'cancelada' },
}

/** Mismas reglas del voto en la mesa y en la papeleta: idempotencia, presencia, estado, opciones, mora y un voto por bien. */
function emitirVoto(req: Request, r: ReunionDemo, x: PreguntaDemo, a: Asistente | undefined, opciones: string[], canal: NuevoVoto['canal'], noInscrito: string): Response {
  const clave = req.headers.get('Idempotency-Key')
  if (!clave) return error(422, 'validacion', 'Falta la cabecera Idempotency-Key.')
  const repetido = votosPorClave.get(clave)
  if (repetido) return json({ ...repetido, registrado: false }, 201)
  if (!a || !a.presente) return error(403, 'no_inscrito', noInscrito)
  if (x.p.estado !== 'abierta') return error(409, 'conflicto_estado', 'La votación ya cerró.')
  const max = x.p.tipo === 'seleccion_multiple' ? x.p.max_selecciones : 1
  if (!opciones.length || opciones.length > max || opciones.some((o) => !x.p.opciones.some((y) => y.id === o))) {
    return error(422, 'validacion', 'El número de opciones elegidas no corresponde a la pregunta.')
  }
  const restaMora = r.reunion.configuracion.efecto_mora !== 'informativo'
  const yaVotaron = new Set(x.votos.map((v) => v.bien))
  const habilitados = a.bienes.filter((b) => !(restaMora && b.moroso) && !yaVotaron.has(b.bien_privado_id))
  const omitidos = a.bienes.filter((b) => !habilitados.includes(b)).map((b) => b.codigo)
  if (!habilitados.length) return error(409, 'ya_voto', 'Sus bienes ya votaron esta pregunta.')
  habilitados.forEach((b) => x.votos.push({ bien: b.bien_privado_id, opciones, canal, asistente: a, apoderado: b.calidad === 'apoderado', en: ahora() }))
  const voto: Voto = { registrado: true, asistente_id: a.id, nombre: a.nombre, bienes: habilitados.map((b) => b.codigo), omitidos }
  votosPorClave.set(clave, voto)
  return json(voto, 201)
}

/** Token demo de la papeleta: el prefijo más el id del asistente (el real es opaco). */
export const PREFIJO_PAPELETA = 'demo-papeleta-'

/**
 * Papeleta virtual sin sesión (`X-Papeleta`): la reunión, el asistente, sus preguntas abiertas,
 * el ingreso y la salida (solo en virtuales o mixtas) y el voto por la web.
 */
export const papeletaDemo: Manejador = async (req, ruta) => {
  const base = ruta.match(/^\/copropiedades\/[^/]+\/papeleta(\/ingreso|\/salida|\/votos)?$/)
  if (!base) return null
  const token = req.headers.get('X-Papeleta') ?? ''
  const asistenteId = token.startsWith(PREFIJO_PAPELETA) ? token.slice(PREFIJO_PAPELETA.length) : ''
  const r = reuniones.find((x) => x.asistentes.some((a) => a.id === asistenteId))
  const a = r?.asistentes.find((x) => x.id === asistenteId)
  if (!r || !a || ['cerrada', 'cancelada'].includes(r.reunion.estado)) return error(401, 'no_autenticado', 'La papeleta no es válida.')
  const m = req.method
  const accion = base[1]
  if (m === 'GET' && !accion) {
    const votados = (x: PreguntaDemo) => a.bienes.every((b) => x.votos.some((v) => v.bien === b.bien_privado_id))
    const abiertas = r.preguntas.filter((x) => x.p.estado === 'abierta').map((x) => ({ pregunta: x.p, ya_voto: votados(x) }))
    return json({ reunion: r.reunion, asistente: a, preguntas_abiertas: abiertas })
  }
  if (m === 'POST' && (accion === '/ingreso' || accion === '/salida')) {
    const entra = accion === '/ingreso'
    if (entra && (r.reunion.modalidad === 'presencial' || a.presente)) return error(409, 'conflicto', a.presente ? 'Ya está presente.' : 'La reunión es presencial: regístrese en la mesa.')
    if (!entra && !a.presente) return error(409, 'conflicto', 'No estaba presente.')
    a.presente = entra
    return json(a)
  }
  if (m === 'POST' && accion === '/votos') {
    const d = await cuerpo<{ pregunta_id: string; opciones: string[] }>(req)
    const x = r.preguntas.find((y) => y.p.id === d.pregunta_id)
    if (!x) return error(404, 'no_encontrado', 'La pregunta no existe.')
    return emitirVoto(req, r, x, a, d.opciones, 'web', 'Registre su ingreso o acuda a la mesa para votar.')
  }
  return null
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
    if (accion === 'cerrar') {
      reu.cerrada_en = ahora()
      r.preguntas.filter((x) => x.p.estado === 'abierta').forEach((x) => {
        x.resultado = escrutinioDe(r, x)
        Object.assign(x.p, { estado: 'cerrada', cerrada_en: ahora() })
      })
    }
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
      preguntas_abiertas: r.preguntas.filter((x) => x.p.estado === 'abierta').map((x) => enVivo(r, x)),
      ultima_cerrada: (() => {
        const c = r.preguntas.filter((x) => x.p.estado === 'cerrada').sort((x, y) => (y.p.cerrada_en ?? '').localeCompare(x.p.cerrada_en ?? ''))[0]
        return c ? enVivo(r, c) : null
      })(),
      generado_en: ahora(),
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
      return json({ asistente: nuevo, token_papeleta: `${PREFIJO_PAPELETA}${nuevo.id}`, avisos }, 201)
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

  // Preguntas y votos
  if (sub === '/preguntas') {
    if (m === 'GET') return json(r.preguntas.map((x) => x.p).sort((a, c) => a.orden - c.orden))
    if (m === 'POST') {
      if (['cerrada', 'cancelada'].includes(reu.estado)) return error(409, 'conflicto_estado', 'La reunión ya terminó.')
      const n = ++consecutivo
      const nueva = pregunta(n, r.preguntas.length + 1, await cuerpo<NuevaPregunta>(req))
      const problema = problemaDefinicion(nueva)
      if (problema) return error(422, 'validacion', problema)
      r.preguntas.push({ p: nueva, votos: [], resultado: null })
      return json(nueva, 201)
    }
  }
  const pre = sub.match(/^\/preguntas\/([^/]+)(\/[a-z]+)?$/)
  if (pre) {
    const x = r.preguntas.find((y) => y.p.id === pre[1])
    if (!x) return error(404, 'no_encontrado', 'La pregunta no existe.')
    const accion = pre[2] ?? ''
    if (accion === '' && m === 'PUT') {
      if (x.p.estado !== 'borrador') return error(409, 'conflicto_estado', 'La pregunta ya se abrió: no se puede editar.')
      const nueva = pregunta(++consecutivo, x.p.orden, await cuerpo<NuevaPregunta>(req), { id: x.p.id })
      const problema = problemaDefinicion(nueva)
      if (problema) return error(422, 'validacion', problema)
      x.p = nueva
      return json(nueva)
    }
    if (accion === '' && m === 'DELETE') {
      if (x.p.estado !== 'borrador') return error(409, 'conflicto', 'La pregunta ya se abrió: anúlela.')
      r.preguntas = r.preguntas.filter((y) => y !== x)
      return sinContenido()
    }
    if (accion === '/estado' && m === 'PUT') {
      const { accion: a, motivo } = await cuerpo<{ accion: 'abrir' | 'cerrar' | 'anular'; motivo?: string | null }>(req)
      if (a === 'abrir') {
        if (reu.estado !== 'instalada') return error(409, 'conflicto_estado', 'La asamblea no está instalada.')
        if (x.p.estado !== 'borrador') return error(409, 'conflicto_estado', 'La pregunta ya se abrió.')
        const seg = x.p.temporizador_segundos ?? reu.configuracion.temporizador_segundos ?? 0
        Object.assign(x.p, { estado: 'abierta', abierta_en: ahora(), cierra_en: seg ? new Date(Date.now() + seg * 1000).toISOString() : null })
      } else if (a === 'cerrar') {
        if (x.p.estado !== 'abierta') return error(409, 'conflicto_estado', 'La pregunta no está abierta.')
        x.resultado = escrutinioDe(r, x)
        Object.assign(x.p, { estado: 'cerrada', cerrada_en: ahora() })
      } else {
        if (!['borrador', 'abierta'].includes(x.p.estado)) return error(409, 'conflicto_estado', 'Una pregunta cerrada no se anula.')
        if (!motivo?.trim()) return error(422, 'validacion', 'Indique el motivo de la anulación.')
        Object.assign(x.p, { estado: 'anulada' })
      }
      return json(x.p)
    }
    if (accion === '/votos' && m === 'POST') {
      const d = await cuerpo<NuevoVoto>(req)
      const a = r.asistentes.find((y) => (d.asistente_id ? y.id === d.asistente_id : !!d.rotulo && y.rotulo === d.rotulo))
      const noInscrito = d.rotulo ? `El rótulo ${d.rotulo} no corresponde a un asistente presente.` : 'El asistente no está presente en la sala.'
      return emitirVoto(req, r, x, a, d.opciones, d.canal, noInscrito)
    }
    if (accion === '/resultados' && m === 'GET') return json({ pregunta: x.p, escrutinio: x.resultado ?? escrutinioDe(r, x) })
    if (accion === '/detalle' && m === 'GET') {
      return json(x.votos.map((v) => ({
        bien_privado_id: v.bien, codigo: bienesDemo().find((b) => b.id === v.bien)?.codigo ?? '', coeficiente: COEF, opcion_id: v.opciones[0] ?? '',
        canal: v.canal, asistente: v.asistente.nombre, apoderado: v.apoderado, registrado_en: v.en,
      })))
    }
    if (accion === '/eleccion' && m === 'POST') {
      if (x.p.tipo !== 'eleccion' || x.p.estado !== 'cerrada' || !x.p.cargo || x.p.roles_aplicados_en) return error(409, 'conflicto', 'No es una elección cerrada de un cargo o ya se aplicó.')
      const e = x.resultado
      const ganadoras = e?.decision.decision === 'reparto' ? e.decision.cupos.filter((c) => c.por_cociente + c.por_residuo > 0).map((c) => c.opcion_id) : []
      const personas = x.p.opciones.filter((o) => ganadoras.includes(o.id)).flatMap((o) => o.candidatos)
      x.p.roles_aplicados_en = ahora()
      return json(personas.map((pid, k) => ({ persona_id: pid, nombre: bienesDemo().map((_, i) => titular(i)).find((t) => t.persona === pid)?.nombre ?? 'Persona elegida', rol_asignado: k !== 1 })))
    }
  }

  // Acta
  if (sub === '/acta') {
    if (m === 'GET') return json(datosActa(r))
    if (m === 'POST') {
      if (reu.estado !== 'cerrada') return error(409, 'conflicto', 'La reunión no está cerrada.')
      if (['aprobada', 'publicada'].includes(reu.acta_estado)) return error(409, 'conflicto', 'El acta ya se aprobó: no se puede regenerar.')
      Object.assign(reu, { acta_estado: 'generada', acta_archivo_id: id(++consecutivo) })
      return json(reu)
    }
  }
  if (sub === '/acta/estado' && m === 'PUT') {
    const { paso, archivo_id } = await cuerpo<{ paso: 'firmada' | 'aprobar' | 'publicar'; archivo_id?: string | null }>(req)
    if (paso === 'firmada') {
      if (reu.acta_estado !== 'generada') return error(409, 'conflicto', 'Primero genere el acta.')
      if (!archivo_id) return error(422, 'validacion', 'Suba el escaneo firmado.')
      reu.acta_firmada_archivo_id = archivo_id
    } else if (paso === 'aprobar') {
      if (!reu.acta_firmada_archivo_id) return error(409, 'conflicto', 'Suba el acta firmada antes de aprobarla.')
      if (reu.acta_estado !== 'generada') return error(409, 'conflicto_estado', 'El acta no está generada.')
      reu.acta_estado = 'aprobada'
    } else {
      if (reu.acta_estado !== 'aprobada') return error(409, 'conflicto_estado', 'Solo se publica un acta aprobada.')
      reu.acta_estado = 'publicada'
    }
    return json(reu)
  }

  // Reportes
  if (m === 'GET' && sub === '/reportes/asistencia') {
    const filas = r.asistentes.flatMap((a) => a.bienes.map((b) => ({
      asistente: a.nombre, bien: b.codigo, coeficiente: b.coeficiente, calidad: b.calidad, metodo: a.metodo, moroso: b.moroso,
      entrada: reu.instalada_en ?? reu.fecha_programada, salida: a.presente ? null : ahora(), motivo_salida: a.presente ? null : 'se_retiro', whatsapp_confirmado: a.whatsapp_confirmado,
    })))
    if (q.get('formato') === 'csv') return csv([['Asistente', 'Bien', 'Coeficiente', 'Calidad'], ...filas.map((f) => [f.asistente, f.bien, f.coeficiente, f.calidad])], 'asistencia.csv')
    return json(filas)
  }
  const rep = sub.match(/^\/reportes\/votos\/([^/]+)$/)
  if (m === 'GET' && rep) {
    const x = r.preguntas.find((y) => y.p.id === rep[1])
    if (!x) return error(404, 'no_encontrado', 'La pregunta no existe.')
    const op = (oid: string) => x.p.opciones.find((o) => o.id === oid)?.texto ?? ''
    return csv([['Bien', 'Canal', 'Asistente', 'Opción'], ...x.votos.map((v) => [bienesDemo().find((b) => b.id === v.bien)?.codigo ?? '', v.canal, v.asistente.nombre, v.opciones.map(op).join(' + ')])], 'votos.csv')
  }
  if (m === 'GET' && sub === '/reportes/canales') {
    return json(r.preguntas.filter((x) => x.p.estado !== 'borrador').map((x) => ({
      pregunta_id: x.p.id, orden: x.p.orden, enunciado: x.p.enunciado,
      por_canal: x.votos.reduce<Record<string, number>>((t, v) => ({ ...t, [v.canal]: (t[v.canal] ?? 0) + 1 }), {}),
      primero: x.votos[0]?.en ?? null, ultimo: x.votos.at(-1)?.en ?? null,
    })))
  }
  if (m === 'GET' && sub === '/reportes/costo-whatsapp') {
    return json({
      moneda: 'COP', plantillas: 68, servicio: 12, fallidos: 2, tarifa_utilidad: '35.00', tarifa_servicio: '0.00', valor_estimado: '2380.00',
      por_linea: [{ linea: '+57 601 555 0100', es_plantilla: true, enviados: 68, fallidos: 2 }, { linea: '+57 601 555 0100', es_plantilla: false, enviados: 12, fallidos: 0 }],
    })
  }
  return null
}
