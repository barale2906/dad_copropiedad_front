/**
 * Demo de Zonas comunes: recursos con su política y horario, disponibilidad calculada (horario −
 * reservas − alistamiento), reservas en cada estado, cobro por recurso, restricciones,
 * parqueaderos, sorteos y bienes privados. La PH demo está en Bogotá (UTC−5, sin horario de
 * verano). Se reinicia en cada inicio de sesión.
 */
import type {
  AsignacionParqueadero,
  CambiosRecurso,
  CobroRecurso,
  EntregaReserva,
  EstadoRecurso,
  EstadoReserva,
  NuevaAsignacionParqueadero,
  NuevaReserva,
  NuevaRestriccion,
  NuevoParqueadero,
  NuevoRecurso,
  NuevoSorteo,
  PoliticaReserva,
  Recurso,
  Reserva,
  Restriccion,
  Sorteo,
} from '@/api/tipos'
import { cuerpo, error, json, type Manejador, sinContenido } from './http'
import { bienesDemo, PROPIOS } from './unidades'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const DESFASE_H = 5
const HORA = 3_600_000
const DIA = 24 * HORA

/** Día local (`YYYY-MM-DD`) a `dias` de hoy en Bogotá. */
function diaLocal(dias = 0): string {
  return new Date(Date.now() - DESFASE_H * HORA + dias * DIA).toISOString().slice(0, 10)
}

/** Fecha local + hora local (`HH:MM[:SS]`) → ISO UTC. */
const aUtc = (dia: string, hhmm: string) =>
  new Date(Date.parse(`${dia}T${hhmm.slice(0, 5)}:00Z`) + DESFASE_H * HORA).toISOString().replace('.000Z', 'Z')

const POLITICA: PoliticaReserva = {
  modo: 'franja_inmediata',
  duracion_minima_min: 60,
  duracion_maxima_min: 240,
  granularidad_min: 60,
  anticipacion_minima_horas: 2,
  anticipacion_maxima_dias: 30,
  max_reservas_mes: 4,
  max_simultaneas: 1,
  alistamiento_min: 0,
  quien: 'ambos',
  tenedor_requiere_autorizacion: false,
  aforo: null,
  tarifa: '0',
  cobro_por: 'reserva',
  tarifa_festivo: null,
  deposito: '0',
  cancelacion_sin_penalidad_horas: 24,
  penalidad_porcentaje: '0',
  max_invitados: 0,
  metodo_entrega: 'sin_entrega',
}

const todosLosDias = (inicio: string, fin: string) => ({
  franjas: [1, 2, 3, 4, 5, 6, 7].map((dia) => ({ dia, inicio, fin, aplica_festivos: true })),
  excepciones: [],
})

function bienComun(
  n: number,
  nombre: string,
  categoria: NonNullable<Recurso['bien_comun']>['categoria'],
  politica: Partial<PoliticaReserva>,
  horario = todosLosDias('08:00:00', '22:00:00'),
): Recurso {
  return {
    id: id(n), tipo: 'bien_comun', nombre, estado: 'disponible', ubicacion: null, descripcion: null,
    politica: { ...POLITICA, ...politica }, horario,
    bien_comun: { categoria, area_m2: null, es_esencial: false, reglas: `Reglamento de uso de ${nombre.toLowerCase()}.` },
  }
}

let recursos: Recurso[] = []
let reservas: Reserva[] = []
let cobros = new Map<string, CobroRecurso>()
let restricciones: Restriccion[] = []
let asignaciones: AsignacionParqueadero[] = []
let sorteos: Sorteo[] = []
/** Semillas aún no reveladas (el backend solo publica su compromiso hasta ejecutar). */
let semillas = new Map<string, string>()
let consecutivo = 8000

const nombreRecurso = (recursoId: string) => recursos.find((r) => r.id === recursoId)?.nombre ?? ''
const codigoBien = (bienId: string) => bienesDemo().find((b) => b.id === bienId)?.codigo ?? ''

function reservaDemo(n: number, recursoId: string, dias: number, desde: string, hasta: string, estado: EstadoReserva, bien = 0, valor = '0'): Reserva {
  const dia = diaLocal(dias)
  return {
    id: id(n), recurso_id: recursoId, recurso_nombre: nombreRecurso(recursoId), bien_privado_id: bienesDemo()[bien]!.id,
    bien_codigo: bienesDemo()[bien]!.codigo, inicio: aUtc(dia, desde), fin: aUtc(dia, hasta),
    invitados: 0, estado, valor, deposito: '0', penalidad: '0', estado_pago: valor === '0' ? 'no_aplica' : 'pendiente',
    canal: 'web', creada_en: new Date(Date.now() - 2 * DIA).toISOString(),
  }
}

/** Reinicia el demo. */
export function iniciarZonasComunes(): void {
  consecutivo = 8000
  recursos = [
    bienComun(6001, 'Salón social principal', 'salon_social', {
      modo: 'franja_con_aprobacion', duracion_minima_min: 240, duracion_maxima_min: 360, granularidad_min: 60,
      anticipacion_minima_horas: 48, tarifa: '150000.00', deposito: '200000.00', alistamiento_min: 60,
      penalidad_porcentaje: '20', cancelacion_sin_penalidad_horas: 72, aforo: 80, max_invitados: 60, metodo_entrega: 'entrega_con_inventario',
    }),
    bienComun(6002, 'Salón comunal torre 2', 'salon_comunal', { modo: 'franja_con_aprobacion', duracion_minima_min: 120, duracion_maxima_min: 240, tarifa: '60000.00', metodo_entrega: 'entrega_llaves' }),
    bienComun(6003, 'Piscina', 'piscina', { duracion_minima_min: 60, duracion_maxima_min: 120, granularidad_min: 60, aforo: 25, max_invitados: 3 }, todosLosDias('09:00:00', '18:00:00')),
    bienComun(6004, 'Cancha múltiple', 'cancha', { tarifa: '10000.00', cobro_por: 'hora', duracion_maxima_min: 120 }),
    bienComun(6005, 'Zona BBQ', 'bbq', { tarifa: '40000.00', modo: 'franja_con_aprobacion', duracion_minima_min: 180, duracion_maxima_min: 300 }),
    bienComun(6006, 'Gimnasio', 'gimnasio', { modo: 'libre' }, todosLosDias('05:00:00', '22:00:00')),
    {
      id: id(6101), tipo: 'parqueadero', nombre: 'Visitantes V-01', estado: 'disponible', ubicacion: 'Sótano 1',
      politica: { ...POLITICA, duracion_maxima_min: 480 }, horario: todosLosDias('06:00:00', '23:00:00'),
      parqueadero: { codigo: 'V-01', tipo_vehiculo: 'carro', naturaleza: 'visitantes' },
    },
    ...[1, 2, 3].map((n) => ({
      id: id(6110 + n), tipo: 'parqueadero' as const, nombre: `Comunal C-0${n}`, estado: 'disponible' as const, ubicacion: 'Sótano 2',
      politica: { ...POLITICA, modo: 'sorteo' as const }, horario: { franjas: [], excepciones: [] },
      parqueadero: { codigo: `C-0${n}`, tipo_vehiculo: (n === 3 ? 'moto' : 'carro') as 'moto' | 'carro', naturaleza: 'comunal' as const },
    })),
    {
      id: id(6150), tipo: 'agenda_administracion', nombre: 'Citas con la administración', estado: 'disponible', ubicacion: 'Oficina de administración',
      descripcion: 'Atención personal de 30 minutos.',
      politica: { ...POLITICA, duracion_minima_min: 30, duracion_maxima_min: 30, granularidad_min: 30, anticipacion_minima_horas: 2 },
      horario: todosLosDias('08:00:00', '17:00:00'),
    },
  ]
  const salon = id(6001)
  reservas = [
    reservaDemo(6201, salon, 5, '14:00', '20:00', 'solicitada', 1, '150000.00'),
    reservaDemo(6202, id(6005), 3, '12:00', '17:00', 'solicitada', 2, '40000.00'),
    reservaDemo(6203, id(6002), 0, '10:00', '12:00', 'aprobada', 0, '60000.00'),
    reservaDemo(6204, id(6004), 0, '07:00', '09:00', 'en_curso', 3, '20000.00'),
    reservaDemo(6205, id(6003), 2, '10:00', '11:00', 'aprobada', 0),
    reservaDemo(6206, id(6003), -3, '15:00', '16:00', 'finalizada', 0),
    reservaDemo(6207, salon, -10, '14:00', '20:00', 'con_novedad', 4, '150000.00'),
    reservaDemo(6208, id(6004), -1, '18:00', '19:00', 'cancelada', 0, '10000.00'),
  ]
  cobros = new Map(recursos.map((r) => [r.id, { destino: r.id === id(6005) ? 'cartera' : 'manual', item_facturacion_id: null }]))
  restricciones = [
    { id: id(6301), bien_privado_id: bienesDemo()[4]!.id, motivo: 'Mora en las cuotas de administración', desde: new Date(Date.now() - 20 * DIA).toISOString(), hasta: null },
  ]
  asignaciones = []
  semillas = new Map([[id(6401), '7d1e5c3a9b8f0e2d4c6a8b1f3e5d7c9a']])
  sorteos = [
    {
      id: id(6401), nombre: 'Parqueaderos comunales 2027', recursos: [id(6111), id(6112), id(6113)],
      vigencia_desde: `${diaLocal(30)}T05:00:00Z`, vigencia_hasta: `${diaLocal(395)}T05:00:00Z`, estado: 'abierto',
      compromiso: 'a3f1c9e07b2d4e58a1c6f0e9d8b7a6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9', semilla: null,
      criterios: { puntos_discapacidad: 3, puntos_no_favorecido: 2 },
      resultado: [], inscritos: [bienesDemo()[1]!.id, bienesDemo()[2]!.id], ejecutado_en: null,
    },
  ]
}

const activa = (r: Reserva) => ['solicitada', 'aprobada', 'en_curso'].includes(r.estado)

/** Franjas libres: horario de cada día − reservas activas (con alistamiento) − lo que ya pasó. */
function libres(r: Recurso, desde: string, hasta: string) {
  const ocupadas = reservas
    .filter((x) => x.recurso_id === r.id && activa(x))
    .map((x) => [Date.parse(x.inicio), Date.parse(x.fin) + r.politica.alistamiento_min * 60_000] as const)
  // Como el backend: la anticipación mínima se redondea a la hora siguiente.
  const minimo = Math.ceil((Date.now() + r.politica.anticipacion_minima_horas * HORA) / HORA) * HORA
  const franjas: { inicio: string; fin: string }[] = []
  for (let t = Date.parse(`${desde}T12:00:00Z`); t <= Date.parse(`${hasta}T12:00:00Z`); t += DIA) {
    const dia = new Date(t).toISOString().slice(0, 10)
    const iso = ((new Date(t).getUTCDay() + 6) % 7) + 1
    for (const f of r.horario.franjas ?? []) {
      if (f.dia !== iso) continue
      let tramos: [number, number][] = [[Math.max(Date.parse(aUtc(dia, f.inicio)), minimo), Date.parse(aUtc(dia, f.fin))]]
      for (const [oi, of] of ocupadas) {
        tramos = tramos.flatMap(([a, b]): [number, number][] =>
          of <= a || oi >= b ? [[a, b]] : ([[a, oi], [of, b]] as [number, number][]).filter(([x, y]) => y > x),
        )
      }
      for (const [a, b] of tramos) if (b > a) franjas.push({ inicio: new Date(a).toISOString().replace('.000Z', 'Z'), fin: new Date(b).toISOString().replace('.000Z', 'Z') })
    }
  }
  return franjas
}

function valorDe(r: Recurso, inicio: string, fin: string): string {
  const tarifa = Number(r.politica.tarifa)
  const horas = (Date.parse(fin) - Date.parse(inicio)) / HORA
  return (r.politica.cobro_por === 'hora' ? tarifa * horas : tarifa).toFixed(2)
}

function crearReserva(d: NuevaReserva): Response {
  const r = recursos.find((x) => x.id === d.recurso_id)
  if (!r) return error(404, 'no_encontrado', 'El recurso no existe.')
  const repetida = reservas.find((x) => x.observacion === d.idempotency_key)
  if (repetida) return json(repetida, 201)
  if (r.estado !== 'disponible') return error(422, 'validacion', 'El recurso no está disponible en este momento.')
  const restriccion = restricciones.find((x) => x.bien_privado_id === d.bien_privado_id && !x.hasta)
  if (restriccion) return error(422, 'validacion', `El bien no puede reservar: ${restriccion.motivo.toLowerCase()}.`)
  const minutos = (Date.parse(d.fin) - Date.parse(d.inicio)) / 60_000
  if (minutos < r.politica.duracion_minima_min || minutos > r.politica.duracion_maxima_min) {
    return error(422, 'validacion', 'La duración no cumple la política del recurso.')
  }
  const choca = reservas.some((x) => x.recurso_id === r.id && activa(x) && Date.parse(x.inicio) < Date.parse(d.fin) && Date.parse(d.inicio) < Date.parse(x.fin))
  if (choca) return error(409, 'conflicto', 'Esa franja acaba de ocuparse. Elija otra.')
  const valor = valorDe(r, d.inicio, d.fin)
  const nueva: Reserva = {
    id: id(++consecutivo), recurso_id: r.id, recurso_nombre: r.nombre, bien_privado_id: d.bien_privado_id,
    bien_codigo: codigoBien(d.bien_privado_id), inicio: d.inicio, fin: d.fin,
    invitados: d.invitados ?? 0, estado: r.politica.modo === 'franja_con_aprobacion' ? 'solicitada' : 'aprobada',
    valor, deposito: r.politica.deposito, penalidad: '0', estado_pago: Number(valor) > 0 ? 'pendiente' : 'no_aplica',
    canal: d.canal ?? 'web', motivo: d.motivo, observacion: d.idempotency_key, creada_en: new Date().toISOString(),
  }
  reservas.push(nueva)
  return json(nueva, 201)
}

const TRANSICIONES: Record<string, { desde: EstadoReserva[]; hacia: EstadoReserva }> = {
  aprobar: { desde: ['solicitada'], hacia: 'aprobada' },
  rechazar: { desde: ['solicitada'], hacia: 'rechazada' },
  cancelar: { desde: ['solicitada', 'aprobada'], hacia: 'cancelada' },
  entrega: { desde: ['aprobada'], hacia: 'en_curso' },
  recibo: { desde: ['en_curso'], hacia: 'finalizada' },
  'no-asistio': { desde: ['aprobada'], hacia: 'no_asistio' },
}

async function ciclo(req: Request, accion: string, r: Reserva): Promise<Response> {
  if (accion === 'pago') {
    if (cobros.get(r.recurso_id)?.destino !== 'manual') return error(422, 'validacion', 'Este recurso se cobra por la cartera o con factura.')
    r.estado_pago = (await cuerpo<{ estado_pago: Reserva['estado_pago'] }>(req)).estado_pago
    return json(r)
  }
  if (accion === 'factura') {
    if (cobros.get(r.recurso_id)?.destino !== 'factura') return error(422, 'validacion', 'Este recurso no se cobra con factura.')
    return json({ id: id(++consecutivo) }, 201)
  }
  const t = TRANSICIONES[accion]
  if (!t) return error(404, 'no_encontrado', 'Acción desconocida.')
  if (!t.desde.includes(r.estado)) return error(409, 'conflicto_estado', 'La reserva cambió de estado. Recargue la lista.')
  r.estado = t.hacia
  if (accion === 'rechazar' || accion === 'cancelar') r.motivo = (await cuerpo<{ motivo: string }>(req)).motivo
  if (accion === 'cancelar') {
    const p = recursos.find((x) => x.id === r.recurso_id)?.politica
    if (p && (Date.parse(r.inicio) - Date.now()) / HORA < p.cancelacion_sin_penalidad_horas && Number(p.penalidad_porcentaje) > 0) {
      r.penalidad = ((Number(r.valor) * Number(p.penalidad_porcentaje)) / 100).toFixed(2)
    }
  }
  if (accion === 'recibo') {
    const e = await cuerpo<EntregaReserva>(req)
    if (e.novedad || (e.valor_danos && Number(e.valor_danos) > 0)) r.estado = 'con_novedad'
    r.observacion = e.novedad ?? null
  }
  return json(r)
}

function filtrarReservas(req: Request): Response {
  const q = new URL(req.url).searchParams
  const mias = q.get('mias') === 'true'
  const lista = reservas.filter(
    (r) =>
      (!mias || PROPIOS.includes(r.bien_privado_id)) &&
      (!q.get('recurso_id') || r.recurso_id === q.get('recurso_id')) &&
      (!q.get('bien_privado_id') || r.bien_privado_id === q.get('bien_privado_id')) &&
      (!q.get('estado') || r.estado === q.get('estado')) &&
      (!q.get('desde') || r.fin > (q.get('desde') ?? '')) &&
      (!q.get('hasta') || r.inicio < (q.get('hasta') ?? '')),
  )
  return json(lista.map((r) => ({ ...r, observacion: r.observacion?.length === 36 ? null : r.observacion })))
}

function parqueaderos() {
  return recursos
    .filter((r) => r.tipo === 'parqueadero')
    .map((r) => ({ recurso: r, asignacion: asignaciones.find((a) => a.recurso_id === r.id && !a.hasta) ?? null }))
}

export const zonasComunes: Manejador = async (req, ruta) => {
  const m = req.method
  const base = ruta.match(/^\/copropiedades\/[^/]+(\/.*)$/)?.[1]
  if (!base) return null

  if (base === '/recursos') {
    if (m === 'GET') {
      const q = new URL(req.url).searchParams
      return json(recursos.filter((r) => (!q.get('tipo') || r.tipo === q.get('tipo')) && (!q.get('categoria') || r.bien_comun?.categoria === q.get('categoria'))))
    }
    if (m === 'POST') {
      const d = await cuerpo<NuevoRecurso>(req)
      if (!d.nombre?.trim()) return error(422, 'validacion', 'Escriba el nombre del recurso.')
      const r: Recurso = { id: id(++consecutivo), estado: 'disponible', horario: d.horario ?? { franjas: [], excepciones: [] }, ...d }
      recursos.push(r)
      cobros.set(r.id, { destino: 'manual', item_facturacion_id: null })
      return json(r, 201)
    }
  }
  const rec = base.match(/^\/recursos\/([^/]+)(\/[a-z]+)?$/)
  if (rec) {
    const r = recursos.find((x) => x.id === rec[1])
    if (!r) return error(404, 'no_encontrado', 'El recurso no existe.')
    const resto = rec[2] ?? ''
    if (m === 'GET' && resto === '') return json(r)
    if (m === 'PATCH' && resto === '') {
      const c = await cuerpo<CambiosRecurso>(req)
      Object.assign(r, Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined && v !== null)))
      return json(r)
    }
    if (m === 'POST' && resto === '/estado') {
      const { estado } = await cuerpo<{ estado: EstadoRecurso }>(req)
      r.estado = estado
      let canceladas = 0
      if (estado !== 'disponible') {
        for (const x of reservas) {
          if (x.recurso_id === r.id && ['solicitada', 'aprobada'].includes(x.estado) && Date.parse(x.inicio) > Date.now()) {
            x.estado = 'cancelada'
            canceladas++
          }
        }
      }
      return json({ reservas_canceladas: canceladas })
    }
    if (m === 'GET' && resto === '/disponibilidad') {
      const q = new URL(req.url).searchParams
      const desde = q.get('desde') ?? diaLocal()
      const hasta = q.get('hasta') ?? desde
      if (hasta < desde) return error(422, 'validacion', 'El rango de fechas no es válido.')
      return json(r.estado === 'disponible' ? libres(r, desde, hasta) : [])
    }
    if (resto === '/cobro') {
      if (m === 'GET') return json(cobros.get(r.id) ?? { destino: 'manual' })
      if (m === 'PUT') {
        const c = await cuerpo<CobroRecurso>(req)
        if (c.destino === 'factura' && !c.item_facturacion_id) return error(422, 'validacion', 'Elija el ítem de facturación.')
        cobros.set(r.id, c)
        return json(c)
      }
    }
  }

  if (base === '/reservas') {
    if (m === 'GET') return filtrarReservas(req)
    if (m === 'POST') return crearReserva(await cuerpo<NuevaReserva>(req))
  }
  const res = base.match(/^\/reservas\/([^/]+)(?:\/([a-z-]+))?$/)
  if (res) {
    const r = reservas.find((x) => x.id === res[1])
    if (!r) return error(404, 'no_encontrado', 'La reserva no existe.')
    if (m === 'GET' && !res[2]) return json({ reserva: r, entregas: [] })
    if (m === 'POST' && res[2]) return ciclo(req, res[2], r)
  }

  if (base === '/restricciones-reserva') {
    if (m === 'GET') return json(restricciones.filter((x) => !x.hasta))
    if (m === 'POST') {
      const d = await cuerpo<NuevaRestriccion>(req)
      const r: Restriccion = { id: id(++consecutivo), ...d, desde: new Date().toISOString(), hasta: d.hasta ?? null }
      restricciones.push(r)
      return json(r, 201)
    }
  }
  const levantar = base.match(/^\/restricciones-reserva\/([^/]+)\/levantar$/)
  if (m === 'POST' && levantar) {
    const r = restricciones.find((x) => x.id === levantar[1])
    if (r) r.hasta = new Date().toISOString()
    return sinContenido()
  }

  if (base === '/parqueaderos') {
    if (m === 'GET') return json(parqueaderos())
    if (m === 'POST') {
      const d = await cuerpo<NuevoParqueadero>(req)
      if (recursos.some((r) => r.parqueadero?.codigo === d.codigo)) return error(409, 'conflicto', `Ya existe el parqueadero ${d.codigo}.`)
      const r: Recurso = {
        id: id(++consecutivo), tipo: 'parqueadero', nombre: `Parqueadero ${d.codigo}`, estado: 'disponible', ubicacion: d.ubicacion,
        politica: d.politica ?? { ...POLITICA, modo: 'sorteo' }, horario: d.horario ?? { franjas: [], excepciones: [] },
        parqueadero: { codigo: d.codigo, tipo_vehiculo: d.tipo_vehiculo, naturaleza: d.naturaleza, bien_privado_id: d.bien_privado_id },
      }
      recursos.push(r)
      return json(r, 201)
    }
  }
  const asignar = base.match(/^\/parqueaderos\/([^/]+)\/asignaciones$/)
  if (m === 'POST' && asignar) {
    if (asignaciones.some((a) => a.recurso_id === asignar[1] && !a.hasta)) return error(409, 'conflicto', 'El parqueadero ya está asignado. Libérelo primero.')
    const d = await cuerpo<NuevaAsignacionParqueadero>(req)
    const a: AsignacionParqueadero = { id: id(++consecutivo), recurso_id: asignar[1] ?? '', bien_privado_id: d.bien_privado_id, origen: d.origen, desde: d.desde ?? new Date().toISOString(), hasta: d.hasta ?? null }
    asignaciones.push(a)
    return json(a, 201)
  }
  const liberar = base.match(/^\/asignaciones-parqueadero\/([^/]+)\/liberar$/)
  if (m === 'POST' && liberar) {
    const a = asignaciones.find((x) => x.id === liberar[1])
    if (a) a.hasta = new Date().toISOString()
    return sinContenido()
  }

  if (base === '/sorteos') {
    if (m === 'GET') return json(sorteos)
    if (m === 'POST') {
      const d = await cuerpo<NuevoSorteo>(req)
      if (d.recursos.length === 0) return error(422, 'validacion', 'Elija al menos un parqueadero.')
      const s: Sorteo = {
        id: id(++consecutivo), nombre: d.nombre, recursos: d.recursos, vigencia_desde: d.vigencia_desde, vigencia_hasta: d.vigencia_hasta,
        estado: 'abierto', compromiso: 'f'.repeat(16) + String(consecutivo).padStart(48, '0'), semilla: null,
        criterios: d.criterios ?? { puntos_discapacidad: 0, puntos_no_favorecido: 0 },
        resultado: [], inscritos: [], ejecutado_en: null,
      }
      sorteos.push(s)
      semillas.set(s.id, `c0ffee${consecutivo}`)
      return json(s, 201)
    }
  }
  const sorteo = base.match(/^\/sorteos\/([^/]+)\/(inscripciones|ejecutar)$/)
  if (m === 'POST' && sorteo) {
    const s = sorteos.find((x) => x.id === sorteo[1])
    if (!s) return error(404, 'no_encontrado', 'El sorteo no existe.')
    if (s.estado !== 'abierto') return error(409, 'conflicto', 'El sorteo ya se ejecutó.')
    if (sorteo[2] === 'inscripciones') {
      const { bien_privado_id } = await cuerpo<{ bien_privado_id: string }>(req)
      if (s.inscritos.includes(bien_privado_id)) return error(409, 'conflicto', 'Ese bien ya está inscrito.')
      s.inscritos.push(bien_privado_id)
      return sinContenido()
    }
    s.estado = 'ejecutado'
    s.semilla = semillas.get(s.id) ?? null
    s.ejecutado_en = new Date().toISOString()
    s.resultado = s.inscritos.slice(0, s.recursos.length)
    const nuevas = s.resultado.map((b, i) => ({
      id: id(++consecutivo), recurso_id: s.recursos[i] ?? '', bien_privado_id: b, origen: 'sorteo' as const,
      desde: s.vigencia_desde, hasta: s.vigencia_hasta, sorteo_id: s.id,
    }))
    return json({ sorteo: s, asignaciones: nuevas })
  }
  return null
}
