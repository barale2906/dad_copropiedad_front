/**
 * Demo de la ficha de la entidad (genérica y de la PH), puntos de atención, mi suscripción y
 * auditoría. Los cambios duran hasta el siguiente inicio de sesión.
 */
import type {
  CambiosCopropiedad,
  Capacidades,
  Cargo,
  DatosCopropiedad,
  EntidadDeLaCuenta,
  EventoAuditado,
  FichaEntidad,
  Horario,
  NuevoPuntoAtencion,
  PuntoAtencion,
} from '@/api/tipos'
import { cuerpo, error, json, type Manejador, sinContenido } from './http'

type EntidadDemo = EntidadDeLaCuenta & { capacidades: Capacidades }

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`

let entidades: EntidadDemo[] = []
let datos = new Map<string, DatosCopropiedad>()
let puntos = new Map<string, PuntoAtencion[]>()
let consecutivo = 2000

const CARGOS: Cargo[] = [
  { rol: 'administrador', rol_nombre: 'Administrador', cuenta_id: id(801), nombre: 'Andrés Administrador', organizacion: null, vigente_desde: '2026-01-15T13:00:00Z' },
  { rol: 'contador', rol_nombre: 'Contador', cuenta_id: id(802), nombre: 'Laura Contadora', organizacion: 'Contables del Norte S.A.S.', vigente_desde: '2026-02-01T13:00:00Z' },
]

const LUNES_A_VIERNES: Horario = {
  franjas: [1, 2, 3, 4, 5].map((dia) => ({ dia, inicio: '08:00:00', fin: '17:00:00', aplica_festivos: false })),
  excepciones: [{ fecha: '2026-12-24', inicio: null, fin: null, motivo: 'Nochebuena' }],
}

function datosIniciales(e: EntidadDemo): DatosCopropiedad {
  return {
    nombre: e.nombre,
    razon_social: e.nombre,
    nit: e.nit,
    tipo: 'residencial',
    forma: 'conjunto',
    direccion: 'Calle 100 # 15-20',
    municipio_dane: '11001',
    departamento: 'Bogotá D. C.',
    barrio: null,
    latitud: null,
    longitud: null,
    estrato: 4,
    telefono: null,
    correo: null,
    sitio_web: null,
    escritura_numero: '1234',
    notaria: 'Notaría 20 de Bogotá',
    escritura_fecha: '2015-03-10',
    matricula_matriz: null,
    reglamento_archivo_id: null,
    certificado_archivo_id: null,
    zona_horaria: 'America/Bogota',
    estado: e.estado,
    plantilla_codigo: '{agrupacion}{numero}',
  }
}

/** Reinicia el demo con las entidades de la sesión. */
export function iniciarFicha(lista: EntidadDemo[]): void {
  entidades = lista
  consecutivo = 2000
  datos = new Map(lista.map((e) => [e.entidad_id, datosIniciales(e)]))
  puntos = new Map(
    lista
      .filter((e) => e.tipo === 'propiedad_horizontal')
      .map((e) => [
        e.entidad_id,
        [{ id: id(1901), tipo: 'oficina_administracion', nombre: 'Oficina de administración', ubicacion: 'Torre 1, piso 1', telefono: '601 555 0101', horario: structuredClone(LUNES_A_VIERNES) }],
      ]),
  )
}

/** Lo que la ficha genérica comparte con la de la PH. */
function generica(d: DatosCopropiedad): FichaEntidad {
  const { nombre, razon_social, nit, direccion, municipio_dane, departamento, barrio, latitud, longitud, telefono, correo, sitio_web, zona_horaria, estado } = d
  return { nombre, razon_social, nit, direccion, municipio_dane, departamento, barrio, latitud, longitud, telefono, correo, sitio_web, zona_horaria, estado }
}

function puede(e: EntidadDemo, permiso: Capacidades['permisos'][number]) {
  return e.capacidades.permisos.includes(permiso)
}

function editar(entidadId: string, cambios: CambiosCopropiedad): DatosCopropiedad | Response {
  const d = datos.get(entidadId)
  if (!d) return error(404, 'no_encontrado', 'No encontrada.')
  if (cambios.nit && !/^\d{9}(-?\d)?$/.test(cambios.nit)) return error(422, 'validacion', 'El NIT no es válido.')
  const nuevo = { ...d, ...cambios } as DatosCopropiedad
  datos.set(entidadId, nuevo)
  return nuevo
}

function auditoria(req: Request): Response {
  const url = new URL(req.url)
  const accion = url.searchParams.get('accion') ?? ''
  const actor = url.searchParams.get('actor_id')
  const desde = url.searchParams.get('despues')
  const base = Date.parse('2026-11-16T15:00:00Z')
  const todos: EventoAuditado[] = Array.from({ length: 60 }, (_, i) => ({
    id: id(3000 + i),
    ocurrido_en: new Date(base - i * 3_600_000).toISOString(),
    actor_id: i % 7 === 0 ? null : i % 2 ? id(801) : id(802),
    accion: ['roles.asignar', 'acceso.visita.decidir', 'cartera.liquidar', 'sesion.iniciar'][i % 4] ?? 'sesion.iniciar',
    entidad: ['asignacion', 'visita', 'liquidacion', 'sesion'][i % 4] ?? 'sesion',
    resultado: i % 9 === 0 ? 'rechazado' : 'ok',
    detalle: (i % 4 === 0 ? { rol: 'contador' } : {}) as Record<string, never>,
  }))
  const filtrados = todos.filter(
    (e) =>
      (!accion || (accion.endsWith('.') ? e.accion.startsWith(accion) : e.accion === accion)) &&
      (!actor || e.actor_id === actor),
  )
  const inicio = desde ? filtrados.findIndex((e) => e.id === desde) + 1 : 0
  const pagina = filtrados.slice(inicio, inicio + 50)
  return json({ datos: pagina, siguiente: inicio + 50 < filtrados.length ? (pagina.at(-1)?.id ?? null) : null })
}

const SUSCRIPCION = {
  suscripcion: {
    id: id(4001), entidad_id: '', ciclo_meses: 1, inicio: '2026-01-01', dias_prueba: 30, plazo_pago_dias: 15,
    correo_facturacion: 'facturacion@losrobles.co', estado: 'activa', suspendida_por_mora: false,
  },
  lineas: [
    { id: id(4101), producto_id: id(4201), producto: 'ph_base', nombre: 'Plan propiedad horizontal', precio_pactado: null, motivo_precio: null, desde: '2026-01-01', hasta: null },
    { id: id(4102), producto_id: id(4202), producto: 'asambleas', nombre: 'Asambleas virtuales', precio_pactado: '250000.00', motivo_precio: 'Descuento de lanzamiento', desde: '2026-03-01', hasta: null },
  ],
  consumo: [
    { metrica: 'unidades', cantidad: 248 },
    { metrica: 'mensajes_whatsapp', cantidad: 1320 },
  ],
  cortes: [
    { id: id(4301), periodo_desde: '2026-10-01', periodo_hasta: '2026-11-01', lineas: [], total: '890000.00', huella: 'x', estado: 'facturado', vencimiento: '2026-11-16' },
    { id: id(4302), periodo_desde: '2026-09-01', periodo_hasta: '2026-10-01', lineas: [], total: '890000.00', huella: 'y', estado: 'pagado', vencimiento: '2026-10-16', pagado_en: '2026-10-10T15:00:00Z' },
  ],
}

export const ficha: Manejador = async (req, ruta) => {
  const m = req.method
  const e = entidades.find((x) => ruta.startsWith(`/entidades/${x.entidad_id}`) || ruta.startsWith(`/copropiedades/${x.entidad_id}`))
  if (!e) return null
  const resto = ruta.replace(/^\/(entidades|copropiedades)\/[^/]+/, '')
  const esPH = ruta.startsWith('/copropiedades/')
  const d = datos.get(e.entidad_id)!

  if (resto === '' && m === 'GET') {
    if (!puede(e, 'copropiedad.datos.ver')) return error(403, 'sin_permiso', 'No tiene permiso para ver la ficha.')
    if (!esPH) return json(generica(d))
    const advertencias = ['falta_revisor_fiscal' as const, ...(d.reglamento_archivo_id ? [] : ['sin_cuadro_vigente' as const])]
    return json({ datos: d, cargos: CARGOS, advertencias })
  }
  if (resto === '' && m === 'PATCH') {
    if (!puede(e, 'copropiedad.datos.editar')) return error(403, 'sin_permiso', 'No tiene permiso para editar la ficha.')
    const r = editar(e.entidad_id, await cuerpo<CambiosCopropiedad>(req))
    if (r instanceof Response) return r
    return json(esPH ? r : generica(r))
  }

  if (esPH && resto === '/puntos-atencion') {
    if (m === 'GET') return json(puntos.get(e.entidad_id) ?? [])
    if (m === 'POST') {
      const p = await cuerpo<NuevoPuntoAtencion>(req)
      const nuevo: PuntoAtencion = { id: id(++consecutivo), ...p, horario: p.horario ?? { franjas: [], excepciones: [] } }
      puntos.set(e.entidad_id, [...(puntos.get(e.entidad_id) ?? []), nuevo])
      return json(nuevo, 201)
    }
  }
  const horario = resto.match(/^\/puntos-atencion\/([^/]+)\/horario$/)
  if (esPH && horario && m === 'PUT') {
    const p = (puntos.get(e.entidad_id) ?? []).find((x) => x.id === horario[1])
    if (!p) return error(404, 'no_encontrado', 'El punto de atención no existe.')
    p.horario = await cuerpo<Horario>(req)
    return sinContenido()
  }

  if (!esPH && resto === '/suscripcion' && m === 'GET') {
    if (e.tipo !== 'propiedad_horizontal') return error(404, 'no_encontrado', 'La entidad no tiene suscripción.')
    return json({ ...SUSCRIPCION, suscripcion: { ...SUSCRIPCION.suscripcion, entidad_id: e.entidad_id } })
  }
  if (!esPH && resto === '/auditoria' && m === 'GET') return auditoria(req)
  return null
}
