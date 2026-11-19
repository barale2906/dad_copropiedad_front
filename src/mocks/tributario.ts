/**
 * Demo del módulo tributario: terceros (buscar, crear —reutiliza la persona con el mismo
 * documento— y datos fiscales), catálogo (IVA, ICA y formatos de exógena), perfil tributario por
 * entidad (la PH con una versión confirmada y un borrador; la empresa sin perfil, para el aviso),
 * resoluciones de numeración (la clave técnica no vuelve), preparación de retención, IVA e ICA
 * (422 sin perfil confirmado), exógena y beneficiarios finales. Se reinicia en cada inicio de sesión.
 */
import type {
  Beneficiario,
  CatalogoTributario,
  DatosFiscales,
  GeneracionExogena,
  NuevaResolucion,
  NuevoBeneficiario,
  NuevoPerfilTributario,
  NuevoTercero,
  PerfilTributario,
  Resolucion,
} from '@/api/tipos'
import { TERCEROS } from './contabilidad'
import { cuentaDemoId } from './cuenta'
import { cuerpo, error, fechaDemo, json, type Manejador, sinContenido } from './http'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const ahora = () => new Date().toISOString()
const PH = id(1)

let perfiles: Record<string, PerfilTributario[]> = {}
let resoluciones: Resolucion[] = []
let generaciones: GeneracionExogena[] = []
let beneficiarios: Beneficiario[] = []
let consecutivo = 40000
let cuentaActual = ''

const anio = () => Number(fechaDemo().slice(0, 4))

function catalogo(): CatalogoTributario {
  const a = anio()
  const formato = (n: number, codigo: string, nombre: string, an: number) => ({
    id: id(n), anio: an, codigo, version: 1, nombre, resolucion: 'Resolución DIAN 000162 de 2023', cuantia_menor: '100000',
    campos: [{ concepto: '5002', cuenta_prefijo: '5110', columna: 'pago_deducible', lado: 'debito' as const }], creado_en: '2026-01-15T12:00:00Z',
  })
  return {
    iva: [
      { id: id(41001), codigo: 'general', nombre: 'Tarifa general', tratamiento: 'gravado', tarifa: '19', fuente: 'Estatuto Tributario art. 468', vigente_desde: '2017-01-01' },
      { id: id(41002), codigo: 'diferencial', nombre: 'Tarifa diferencial', tratamiento: 'gravado', tarifa: '5', fuente: 'Estatuto Tributario art. 468-1', vigente_desde: '2017-01-01' },
      { id: id(41003), codigo: 'excluido', nombre: 'Excluido', tratamiento: 'excluido', tarifa: '0', fuente: 'Estatuto Tributario art. 424', vigente_desde: '2017-01-01' },
    ],
    ica: [{ id: id(41101), municipio_dane: '11001', actividad: '8110', nombre: 'Servicios de apoyo a instalaciones', tarifa_por_mil: '9.66', fuente: 'Acuerdo 65 de 2002', vigente_desde: '2020-01-01' }],
    formatos_exogena: [
      formato(41201, '1001', 'Pagos y abonos en cuenta y retenciones practicadas', a - 1),
      formato(41202, '1007', 'Ingresos recibidos', a - 1),
      formato(41203, '1001', 'Pagos y abonos en cuenta y retenciones practicadas', a),
    ],
  }
}

export function iniciarTributario(usuario: string): void {
  cuentaActual = cuentaDemoId(usuario)
  consecutivo = 40000
  const a = anio()
  const parametros = {
    responsabilidades: ['O-15' as const], agente_retenedor: true, responsable_iva: false, gran_contribuyente: false, autorretenedor: false,
    contribuyente_renta: false, facturador_electronico: true, obligado_rub: false, municipios_ica: ['11001'], actividades_ica: ['8110'], canal_facturacion: 'propio' as const,
  }
  perfiles = {
    [PH]: [
      { id: id(42001), version: 1, vigente_desde: `${a}-01-01`, estado: 'confirmado', parametros, creado_en: `${a}-01-02T12:00:00Z`, confirmado_por: cuentaDemoId('revisor'), confirmado_en: `${a}-01-03T12:00:00Z` },
      { id: id(42002), version: 2, vigente_desde: `${a}-07-01`, estado: 'borrador', parametros: { ...parametros, responsable_iva: true }, observaciones: 'Alquiler de zonas comunes gravado con IVA', creado_en: `${a}-06-20T12:00:00Z` },
    ],
  }
  resoluciones = [
    { id: id(43001), tipo: 'factura', prefijo: 'FE', desde: 1, hasta: 5000, numero_resolucion: '18764000000001', fecha_resolucion: `${a}-01-10`, vigente_desde: `${a}-01-10`, vigente_hasta: `${a + 2}-01-10`, tiene_clave_tecnica: true, activa: true, creada_en: `${a}-01-11T12:00:00Z` },
    { id: id(43002), tipo: 'factura', prefijo: 'FV', desde: 1, hasta: 1000, numero_resolucion: '18762000000999', fecha_resolucion: `${a - 2}-01-10`, vigente_desde: `${a - 2}-01-10`, vigente_hasta: `${a}-01-09`, tiene_clave_tecnica: true, activa: false, creada_en: `${a - 2}-01-11T12:00:00Z` },
  ]
  generaciones = []
  beneficiarios = [{ id: id(44001), persona_id: id(5002), criterio: 'control', vigente_desde: `${a - 1}-03-01`, creado_en: `${a - 1}-03-01T12:00:00Z` }]
}

const confirmado = (entidad: string) => (perfiles[entidad] ?? []).some((p) => p.estado === 'confirmado')

export const tributario: Manejador = async (req, ruta) => {
  const m = req.method
  const q = new URL(req.url).searchParams
  const ter = ruta.match(/^\/entidades\/([^/]+)\/terceros(\/([^/]+)\/datos-fiscales)?$/)
  if (ter) {
    if (!ter[2] && m === 'GET') {
      const t = (q.get('texto') ?? '').toLowerCase()
      return json({ datos: TERCEROS.filter((x) => !t || x.nombre.toLowerCase().includes(t) || (x.documento ?? '').includes(t)).slice(0, Number(q.get('limite') ?? 30)), siguiente: null })
    }
    if (!ter[2] && m === 'POST') {
      const d = await cuerpo<NuevoTercero>(req)
      if (!d.nombre?.trim() || !/^[\dA-Za-z]{3,20}$/.test(d.documento ?? '')) return error(422, 'validacion', 'Escriba el nombre y un documento válido.')
      const existente = TERCEROS.find((x) => x.documento === d.documento)
      if (existente) return json(existente, 201)
      const nuevo = { persona_id: id(++consecutivo), tipo: d.tipo, nombre: d.nombre.trim(), tipo_documento: d.tipo_documento ?? null, documento: d.documento, fiscal: d.fiscal ?? { responsabilidades: [] } }
      TERCEROS.push(nuevo)
      return json(nuevo, 201)
    }
    if (ter[2] && m === 'PUT') {
      const t = TERCEROS.find((x) => x.persona_id === ter[3])
      if (!t) return error(404, 'no_encontrado', 'El tercero no existe.')
      const d = await cuerpo<DatosFiscales>(req)
      if (d.correo_facturacion && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo_facturacion)) return error(422, 'validacion', 'El correo de facturación no es válido.')
      t.fiscal = d
      return json(d)
    }
  }
  const b = ruta.match(/^\/entidades\/([^/]+)\/(tributario|contabilidad\/tributario)(\/.*)?$/)
  if (!b) return null
  const entidad = b[1] ?? ''
  const r = `/${b[2]}${b[3] ?? ''}`

  if (m === 'GET' && r === '/tributario/catalogo') return json(catalogo())
  if (r === '/tributario/perfiles') {
    if (m === 'GET') return json(perfiles[entidad] ?? [])
    if (m === 'POST') {
      const d = await cuerpo<NuevoPerfilTributario>(req)
      const p = d.parametros
      if (p.gran_contribuyente && !(p.responsabilidades ?? []).includes('O-13')) return error(422, 'validacion', 'El perfil no coincide con el RUT: un gran contribuyente lleva la responsabilidad O-13.')
      const lista = perfiles[entidad] ?? []
      const nuevo: PerfilTributario = { id: id(++consecutivo), version: Math.max(0, ...lista.map((x) => x.version)) + 1, vigente_desde: d.vigente_desde, estado: 'borrador', parametros: p, observaciones: d.observaciones ?? null, soporte_archivo_id: d.soporte_archivo_id ?? null, creado_en: ahora() }
      perfiles[entidad] = [...lista, nuevo]
      return json(nuevo, 201)
    }
  }
  const conf = r.match(/^\/tributario\/perfiles\/([^/]+)\/confirmacion$/)
  if (conf && m === 'POST') {
    const p = (perfiles[entidad] ?? []).find((x) => x.id === conf[1])
    if (!p) return error(404, 'no_encontrado', 'La versión no existe.')
    if (p.estado === 'confirmado') return error(409, 'conflicto', 'Esa versión ya estaba confirmada.')
    Object.assign(p, { estado: 'confirmado', confirmado_por: cuentaActual, confirmado_en: ahora() })
    return json(p)
  }
  if (r === '/tributario/resoluciones') {
    if (m === 'GET') return json(resoluciones)
    if (m === 'POST') {
      const d = await cuerpo<NuevaResolucion>(req)
      if (!(d.hasta > d.desde) || d.vigente_hasta <= d.vigente_desde) return error(422, 'validacion', 'Revise el rango y la vigencia.')
      if (resoluciones.some((x) => x.tipo === d.tipo && x.prefijo === d.prefijo && !(d.hasta < x.desde || d.desde > x.hasta))) return error(409, 'conflicto', `Ya hay una resolución con el prefijo ${d.prefijo} en ese rango.`)
      const nueva: Resolucion = {
        id: id(++consecutivo), tipo: d.tipo, prefijo: d.prefijo, desde: d.desde, hasta: d.hasta, numero_resolucion: d.numero_resolucion, fecha_resolucion: d.fecha_resolucion,
        vigente_desde: d.vigente_desde, vigente_hasta: d.vigente_hasta, tiene_clave_tecnica: !!d.clave_tecnica?.trim(), activa: false, creada_en: ahora(),
      }
      resoluciones.push(nueva)
      return json(nueva, 201)
    }
  }
  const act = r.match(/^\/tributario\/resoluciones\/([^/]+)\/activa$/)
  if (act && m === 'PUT') {
    const x = resoluciones.find((y) => y.id === act[1])
    if (!x) return error(404, 'no_encontrado', 'La resolución no existe.')
    x.activa = (await cuerpo<{ activa: boolean }>(req)).activa
    return sinContenido()
  }

  // Preparación de declaraciones
  const desde = q.get('desde') ?? ''
  const hasta = q.get('hasta') ?? ''
  const periodoMalo = (r.endsWith('/retencion') || r.endsWith('/iva') || r.endsWith('/ica')) && (!desde || !hasta || hasta < desde)
  if (m === 'GET' && periodoMalo) return error(422, 'validacion', 'El periodo no es válido: la fecha final va después de la inicial.')
  if (m === 'GET' && r === '/contabilidad/tributario/retencion') {
    return json({
      desde, hasta, obligada: true, total_practicado: '303000.00', total_mayor: '303000.00', diferencia: '0.00',
      detalle: [
        { impuesto: 'renta', concepto: 'Servicios generales (declarantes)', tarifa: '4', base: '6050000.00', valor: '242000.00' },
        { impuesto: 'iva', concepto: 'Retención de IVA (15 %)', tarifa: '15', base: '406666.67', valor: '61000.00' },
      ],
    })
  }
  if (m === 'GET' && r === '/contabilidad/tributario/iva') {
    return json({
      desde, hasta, responsable: false, total_generado: '79831.93', total_descontable: '798000.00', saldo: '-718168.07',
      generado: [{ tarifa: '19', base: '420168.07', iva: '79831.93' }], descontable: [{ tarifa: '19', base: '4200000.00', iva: '798000.00' }],
    })
  }
  if (m === 'GET' && r === '/contabilidad/tributario/ica') {
    if (!confirmado(entidad)) return error(422, 'validacion', 'Sin perfil tributario confirmado no se sabe dónde declara ICA: confírmelo primero.')
    return json({ desde, hasta, ingresos: '18000000.00', reteica_practicada: '40572.00', lineas: [{ municipio_dane: '11001', actividad: '8110', tarifa_por_mil: '9.66', base: '18000000.00', impuesto: '173880.00' }] })
  }
  if (r === '/contabilidad/tributario/exogena') {
    if (m === 'GET') return json(generaciones.filter((g) => g.anio === Number(q.get('anio'))))
    if (m === 'POST') {
      const { formato_id } = await cuerpo<{ formato_id: string }>(req)
      const f = catalogo().formatos_exogena.find((x) => x.id === formato_id)
      if (!f) return error(404, 'no_encontrado', 'El formato no existe.')
      const version = generaciones.filter((g) => g.formato_id === f.id).length + 1
      const csv = 'concepto;tipo_documento;documento;dv;razon_social;direccion;municipio;pago_deducible;retencion\n5002;31;900111222;3;Vigilancia Andina S.A.S.;Cl 80 # 10-20;11001;48400000;1936000\n5002;31;800333444;6;Aseo Total Ltda.;;11001;22200000;888000\n'
      const g: GeneracionExogena = { id: id(++consecutivo), formato_id: f.id, anio: f.anio, version, filas: 2, total: '70600000.00', errores: 1, sha256: 'b7e2f1a9'.repeat(8), archivo_id: id(++consecutivo), generada_en: ahora() }
      generaciones.push(g)
      return json({ generacion: g, csv, errores: ['Aseo Total Ltda. (NIT 800333444): falta la dirección fiscal.'] }, 201)
    }
  }
  if (r === '/contabilidad/tributario/beneficiarios') {
    if (m === 'GET') return json(beneficiarios)
    if (m === 'POST') {
      const d = await cuerpo<NuevoBeneficiario>(req)
      if (d.criterio === 'propiedad' && !(Number(d.porcentaje ?? '0') >= 5)) return error(422, 'validacion', 'Con el criterio de propiedad, la participación es de 5 % o más.')
      if (d.criterio !== 'propiedad' && d.porcentaje) return error(422, 'validacion', 'La participación solo aplica al criterio de propiedad.')
      const nuevo: Beneficiario = { id: id(++consecutivo), persona_id: d.persona_id, criterio: d.criterio, porcentaje: d.porcentaje ?? null, soporte_archivo_id: d.soporte_archivo_id ?? null, vigente_desde: d.vigente_desde, creado_en: ahora() }
      beneficiarios.push(nuevo)
      return json(nuevo, 201)
    }
  }
  const ben = r.match(/^\/contabilidad\/tributario\/beneficiarios\/([^/]+)\/terminacion$/)
  if (ben && m === 'POST') {
    const x = beneficiarios.find((y) => y.id === ben[1])
    if (!x) return error(404, 'no_encontrado', 'El beneficiario no existe.')
    const { hasta: fin } = await cuerpo<{ hasta: string }>(req)
    if (fin < x.vigente_desde) return error(422, 'validacion', 'La fecha de terminación va después del inicio.')
    x.vigente_hasta = fin
    return sinContenido()
  }
  return null
}
