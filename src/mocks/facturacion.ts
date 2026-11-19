/**
 * Demo de la facturación (`/entidades/{id}/facturacion/…`). Tres entidades, como en
 * `demo.ts`: la PH (solo contabilidad), «DAD Servicios Contables» (contabilidad y factura
 * electrónica, ya en producción) y «Comercial Andina» (solo factura electrónica, sin
 * contabilidad y sin habilitar: para recorrer el asistente). El proveedor es el `simulado`.
 *
 * Comercial Andina trae facturas en cada estado y documentos en cada estado (validado,
 * contingencia, rechazado, por enviar), una nota débito, un documento soporte y tres
 * recibidas (pendiente sin eventos, con acuse, registrada). Se reinicia en cada sesión.
 */
import type {
  CertificadoFirma,
  DatosItemFacturacion,
  DocumentoElectronico,
  EventoDocumento,
  EventoRadian,
  FacturaProveedor,
  FacturaRecibida,
  FacturaVenta,
  Habilitacion,
  ItemFacturacion,
  LineaVenta,
  LineaVentaNueva,
  NotaDebito,
  NuevaFacturaProveedor,
  NuevaFacturaVenta,
  NuevoEventoRadian,
  NuevoItemFacturacion,
  PagoManual,
  SetPruebas,
  SoftwareFacturacion,
  TipoDocumentoElectronico,
} from '@/api/tipos'
import { TERCEROS } from './contabilidad'
import { cuerpo, error, fechaDemo, json, type Manejador, sinContenido } from './http'
import { FACTURAS_VENTA } from './tesoreria'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const PH = id(1)
const DAD = id(3)
/** Empresa demo solo con `facturacion_electronica` (usuario `facturador`). */
export const ANDINA = id(4)
/** Lo mismo que las capacidades de `demo.ts`. */
const CON_CONTABILIDAD = new Set([PH, DAD])
const CON_FE = new Set([DAD, ANDINA])

const PEDRO = id(5002)
const VIGILANCIA = id(5501)
const ASEO = id(5502)

interface Estado {
  items: ItemFacturacion[]
  facturas: FacturaVenta[]
  documentos: DocumentoElectronico[]
  eventosDoc: Map<string, EventoDocumento[]>
  radianPropios: Map<string, EventoRadian[]>
  compras: FacturaProveedor[]
  recibidas: FacturaRecibida[]
  radian: Map<string, EventoRadian[]>
  habilitacion: Habilitacion
  numero: number
  numeros: Record<string, number>
}

let estados = new Map<string, Estado>()
let consecutivo = 70000

const ahora = () => new Date().toISOString()
const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString()
const n2 = (v: number) => v.toFixed(2)
const cufe = (n: number) => (n.toString(16).padStart(8, '0') + 'a1b2c3d4e5f6').repeat(5).slice(0, 96)
const admiteIva = (c: string) => c === 'venta' || c === 'alquiler_servicio'
const PREFIJO: Record<TipoDocumentoElectronico, string> = { factura: 'SETP', nota_credito: 'NC26', nota_debito: 'ND26', documento_soporte: 'DS', nota_ajuste_ds: 'NA26' }

function item(n: number, codigo: string, descripcion: string, precio: string | null, tarifa: string, clasificacion: ItemFacturacion['clasificacion'], extra: Partial<ItemFacturacion> = {}): ItemFacturacion {
  return { id: id(n), codigo, descripcion, unidad: '94', precio, tarifa_iva: tarifa, clasificacion, cuenta_id: null, activo: true, actualizado_en: hace(30), ...extra }
}

function lineaDe(l: LineaVentaNueva, items: ItemFacturacion[]): LineaVenta {
  const it = items.find((x) => x.id === l.item_id)
  const clasificacion = l.clasificacion ?? it?.clasificacion ?? 'otra'
  const tarifa = admiteIva(clasificacion) ? Number(l.tarifa_iva ?? it?.tarifa_iva ?? '0') : 0
  const subtotal = Number(l.cantidad) * Number(l.valor_unitario ?? it?.precio ?? '0')
  return {
    descripcion: l.descripcion ?? it?.descripcion ?? '', item_id: l.item_id ?? null, cuenta_id: null, centro_costo_id: null,
    cantidad: l.cantidad, valor_unitario: n2(Number(l.valor_unitario ?? it?.precio ?? '0')), tarifa_iva: String(tarifa),
    subtotal: n2(subtotal), iva: n2((subtotal * tarifa) / 100), clasificacion,
  }
}

function factura(n: number, persona: string, dias: number, descripcion: string, lineas: LineaVenta[], extra: Partial<FacturaVenta> = {}): FacturaVenta {
  const subtotal = lineas.reduce((t, l) => t + Number(l.subtotal), 0)
  const iva = lineas.reduce((t, l) => t + Number(l.iva), 0)
  return {
    id: id(n), persona_id: persona, numero: null, fecha: fechaDemo(dias), vencimiento: fechaDemo(dias + 30), descripcion,
    subtotal: n2(subtotal), iva: n2(iva), total: n2(subtotal + iva), pagado: '0', estado: 'borrador', creada_en: hace(-dias),
    lineas, ...extra,
  }
}

function documento(n: number, tipo: TipoDocumentoElectronico, origenId: string, numero: number | null, total: string, estado: DocumentoElectronico['estado'], extra: Partial<DocumentoElectronico> = {}): DocumentoElectronico {
  return {
    id: id(n), tipo, origen_tipo: tipo === 'documento_soporte' || tipo === 'nota_ajuste_ds' ? 'cxp.factura' : 'ventas.factura', origen_id: origenId,
    prefijo: PREFIJO[tipo], numero, cufe: numero ? cufe(n) : null, estado, proveedor: 'simulado', intentos: estado === 'contingencia' ? 3 : 1,
    total, creado_en: hace(5), enviado_en: estado === 'por_enviar' ? null : hace(5), validado_en: estado === 'validado' ? hace(5) : null,
    respuesta: estado === 'rechazado' ? 'Regla FAJ43b: el NIT del adquirente no está registrado.' : estado === 'contingencia' ? 'La DIAN no respondió (tiempo agotado).' : null,
    ...extra,
  }
}

function vacio(): Estado {
  return { items: [], facturas: [], documentos: [], eventosDoc: new Map(), radianPropios: new Map(), compras: [], recibidas: [], radian: new Map(), habilitacion: { envios: [] }, numero: 0, numeros: {} }
}

const CERTIFICADO: CertificadoFirma = {
  id: id(79001), sujeto: 'CN=DAD Servicios Contables S.A.S.,O=DAD,C=CO', emisor: 'CN=Certicámara S.A.,C=CO', serial: '5A3F99',
  vigente_desde: hace(300), vigente_hasta: new Date(Date.now() + 400 * 86_400_000).toISOString(), por_vencer: false,
}

/** Reinicia el demo en cada inicio de sesión. */
export function iniciarFacturacion(): void {
  consecutivo = 70000
  estados = new Map([[PH, vacio()], [DAD, vacio()], [ANDINA, vacio()]])

  const ph = estados.get(PH)!
  ph.items = [
    item(71001, 'SAL', 'Alquiler del salón social', '420168.07', '19', 'alquiler_servicio'),
    item(71002, 'PVI', 'Parqueadero de visitantes (día)', '15000.00', '19', 'alquiler_servicio'),
  ]
  // Las facturas que ya usa la tesorería (recibos aplicados): el mismo objeto, para que los abonos se vean.
  ph.facturas = FACTURAS_VENTA as unknown as FacturaVenta[]
  ph.numero = 131

  const dad = estados.get(DAD)!
  dad.items = [item(72001, 'ASE-H', 'Asesoría contable (hora)', '150000.00', '19', 'alquiler_servicio', { unidad: 'HUR' })]
  dad.habilitacion = { software_id: id(79100), test_set_id: id(79101), estado: 'produccion', ambiente: 'produccion', certificado: CERTIFICADO, envios: [] }

  const andina = estados.get(ANDINA)!
  andina.items = [
    item(73001, 'CAF-500', 'Café de origen 500 g', '28000.00', '19', 'venta'),
    item(73002, 'INST', 'Instalación de máquina de café', '120000.00', '19', 'alquiler_servicio', { unidad: 'HUR' }),
    item(73003, 'TAZ', 'Taza de cerámica', '18000.00', '19', 'venta', { activo: false }),
  ]
  const [cafe, inst] = andina.items
  const l = (it: ItemFacturacion, cantidad: string) => lineaDe({ item_id: it.id, cantidad }, andina.items)
  andina.facturas = [
    factura(74001, VIGILANCIA, -1, 'Café para la oficina de noviembre', [l(cafe!, '10')]),
    factura(74002, VIGILANCIA, -20, 'Café y café en grano de octubre', [l(cafe!, '20')], { numero: 1, estado: 'emitida', emitida_en: hace(20) }),
    factura(74003, ASEO, -12, 'Instalación en la sede norte', [l(inst!, '3')], { numero: 2, estado: 'emitida', emitida_en: hace(12) }),
    factura(74004, PEDRO, -30, 'Café para la tienda', [l(cafe!, '5')], { numero: 3, estado: 'pagada', emitida_en: hace(30) }),
    factura(74005, ASEO, -8, 'Instalación cancelada', [l(inst!, '1')], { numero: 4, estado: 'anulada', emitida_en: hace(8), motivo_anulacion: 'El cliente canceló el servicio.' }),
    factura(74006, PEDRO, -3, 'Café de diciembre', [l(cafe!, '2')], { numero: 5, estado: 'emitida', emitida_en: hace(3) }),
  ]
  andina.facturas[3]!.pagado = andina.facturas[3]!.total
  andina.numero = 5
  const fe = documento(75001, 'factura', id(74002), 990000001, andina.facturas[1]!.total, 'validado')
  andina.documentos = [
    documento(75004, 'factura', id(74006), null, andina.facturas[5]!.total, 'por_enviar'),
    documento(75003, 'factura', id(74004), 990000003, andina.facturas[3]!.total, 'rechazado'),
    documento(75002, 'factura', id(74003), 990000002, andina.facturas[2]!.total, 'contingencia'),
    fe,
  ]
  // Nota débito por intereses de la factura validada: un documento más y una factura que la referencia.
  const nd = factura(74007, VIGILANCIA, -2, 'Intereses de mora de la factura 1', [lineaDe({ descripcion: 'Intereses de mora', cantidad: '1', valor_unitario: '12000', clasificacion: 'otra' }, [])], {
    numero: 6, estado: 'emitida', emitida_en: hace(2), nota_debito_de: id(74002), concepto_nota_debito: 'intereses',
  })
  andina.facturas.push(nd)
  andina.documentos.unshift(documento(75005, 'nota_debito', nd.id, 1, nd.total, 'validado', { referencia_id: fe.id }))
  andina.numero = 6
  andina.numeros = { factura: 990000003, nota_debito: 1, documento_soporte: 1 }
  andina.eventosDoc.set(fe.id, [
    { tipo: 'creado', ocurrido_en: hace(20) },
    { tipo: 'enviado', detalle: 'Transmitido por el proveedor simulado', ocurrido_en: hace(20) },
    { tipo: 'validado', detalle: 'Documento validado por la DIAN', ocurrido_en: hace(20) },
  ])
  andina.compras = [compra(76001, ASEO, 'Mantenimiento de la cafetera', '250000.00', '0.00')]
  andina.documentos.push(documento(75006, 'documento_soporte', id(76001), 1, '250000.00', 'validado'))
  andina.recibidas = [
    recibidaDemo(77001, '900111222', 'Vigilancia Andina S.A.S.', 'FV', '8812', '1500000.00', '285000.00', 'pendiente', VIGILANCIA, 1),
    recibidaDemo(77002, '800333444', 'Aseo Total Ltda.', 'AT', '601', '320000.00', '60800.00', 'pendiente', ASEO, 4),
    recibidaDemo(77003, '899999001', 'Empresa de Energía S.A. E.S.P.', 'EE', '45122', '410000.00', '0.00', 'registrada', id(5503), 9),
  ]
  andina.radian.set(id(77002), [radian(77102, 'acuse')])
}

function compra(n: number, persona: string, descripcion: string, base: string, iva: string): FacturaProveedor {
  const total = n2(Number(base) + Number(iva))
  return {
    id: id(n), persona_id: persona, prefijo: '', numero: String(n), fecha: fechaDemo(-6), vencimiento: fechaDemo(24), descripcion, subtotal: base, iva,
    retenciones: '0.00', neto_pagar: total, pagado: '0', estado: 'registrada', registrada_en: hace(6), lineas: [],
  }
}

function recibidaDemo(n: number, nit: string, nombre: string, prefijo: string, numero: string, subtotal: string, iva: string, estado: FacturaRecibida['estado'], persona: string, dias: number): FacturaRecibida {
  return {
    id: id(n), archivo_id: id(n + 500), emisor_nit: nit, emisor_nombre: nombre, prefijo, numero, fecha: fechaDemo(-dias), vencimiento: fechaDemo(30 - dias),
    cufe: cufe(n), subtotal, iva, total: n2(Number(subtotal) + Number(iva)), estado, persona_id: persona, recibida_en: hace(dias),
    factura_proveedor_id: estado === 'registrada' ? id(n + 900) : null,
  }
}

function radian(n: number, tipo: EventoRadian['tipo'], extra: Partial<EventoRadian> = {}): EventoRadian {
  return { id: id(n), tipo, estado: 'enviado', numero: String(n - 77000), cude: cufe(n), xml_archivo_id: id(n + 300), creado_en: hace(1), ...extra }
}

const PDF = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'

function archivo(contenido: string, tipo: string, nombre: string, huella = false): Response {
  const headers: Record<string, string> = { 'Content-Type': tipo, 'Content-Disposition': `attachment; filename="${nombre}"`, 'X-Request-Id': 'demo' }
  if (huella) headers['X-Contenido-Sha256'] = 'b7e4d1a9'.repeat(8)
  return new Response(contenido, { headers })
}

function emitirDocumento(s: Estado, tipo: TipoDocumentoElectronico, origen: string, total: string, extra: Partial<DocumentoElectronico> = {}): DocumentoElectronico {
  s.numeros[tipo] = (s.numeros[tipo] ?? 0) + 1
  const d = documento(++consecutivo, tipo, origen, s.numeros[tipo] ?? 1, total, 'validado', { creado_en: ahora(), enviado_en: ahora(), validado_en: ahora(), ...extra })
  s.documentos.unshift(d)
  s.eventosDoc.set(d.id, [{ tipo: 'creado', ocurrido_en: ahora() }, { tipo: 'validado', detalle: 'Documento validado (simulado)', ocurrido_en: ahora() }])
  return d
}

const documentoFactura = (s: Estado, facturaId: string) => s.documentos.find((d) => d.origen_id === facturaId && d.tipo === 'factura')

/** Crea la factura (o la nota débito) desde una petición con las reglas del backend. */
function nuevaFactura(s: Estado, entidad: string, d: Pick<NuevaFacturaVenta, 'persona_id' | 'fecha' | 'vencimiento' | 'descripcion' | 'lineas'>): FacturaVenta | Response {
  if (!d.persona_id) return error(422, 'validacion', 'Elija el cliente.')
  if (!d.descripcion?.trim()) return error(422, 'validacion', 'Escriba la descripción.')
  if (!d.lineas?.length) return error(422, 'validacion', 'Agregue al menos una línea.')
  if (d.vencimiento < d.fecha) return error(422, 'validacion', 'El vencimiento es anterior a la fecha.')
  for (const l of d.lineas) {
    if (!CON_CONTABILIDAD.has(entidad) && (l.cuenta || l.centro_costo)) return error(422, 'validacion', 'Sin contabilidad, las líneas no llevan cuenta ni centro de costo.')
    const it = s.items.find((x) => x.id === l.item_id)
    if (l.item_id && (!it || !it.activo)) return error(422, 'validacion', 'El producto no existe o está inactivo.')
    if (!it && (!l.descripcion || !l.valor_unitario)) return error(422, 'validacion', 'Una línea sin producto necesita descripción y valor unitario.')
    const clasif = l.clasificacion ?? it?.clasificacion ?? 'otra'
    if (!admiteIva(clasif) && Number(l.tarifa_iva ?? '0') > 0) return error(422, 'validacion', 'Solo una venta o un alquiler/servicio lleva IVA.')
  }
  const lineas = d.lineas.map((l) => lineaDe(l, s.items))
  return factura(++consecutivo, d.persona_id, 0, d.descripcion.trim(), lineas, { fecha: d.fecha, vencimiento: d.vencimiento, creada_en: ahora() })
}

const sinFe = () => error(403, 'modulo_no_habilitado', 'La entidad no tiene contratada la factura electrónica.')

export const facturacion: Manejador = async (req, ruta) => {
  const b = ruta.match(/^\/entidades\/([^/]+)\/facturacion(\/.*)$/)
  if (!b) return null
  const entidad = b[1] ?? ''
  const r = b[2] ?? ''
  const s = estados.get(entidad)
  if (!s) return error(404, 'no_encontrado', 'La entidad no tiene facturación en el demo.')
  const m = req.method
  const q = new URL(req.url).searchParams
  const fe = CON_FE.has(entidad)

  // Catálogo
  if (r === '/items') {
    if (m === 'GET') {
      const t = (q.get('texto') ?? '').toLowerCase()
      return json(s.items.filter((i) => (q.get('con_inactivos') === 'true' || i.activo) && (!t || i.descripcion.toLowerCase().includes(t) || i.codigo.toLowerCase().includes(t))))
    }
    if (m === 'POST') {
      const d = await cuerpo<NuevoItemFacturacion>(req)
      if (!/^[A-Za-z0-9._-]{1,30}$/.test(d.codigo ?? '')) return error(422, 'validacion', 'El código admite de 1 a 30 letras, números, punto, guion o guion bajo.')
      if (s.items.some((i) => i.codigo.toLowerCase() === d.codigo.toLowerCase())) return error(409, 'conflicto', `Ya existe un producto con el código ${d.codigo}.`)
      const v = validarItem(d, entidad)
      if (v) return v
      const nuevo = item(++consecutivo, d.codigo, d.descripcion.trim(), d.precio ?? null, d.tarifa_iva ?? '0', d.clasificacion, { unidad: d.unidad ?? '94', activo: d.activo ?? true, actualizado_en: ahora() })
      s.items.push(nuevo)
      return json(nuevo, 201)
    }
  }
  const it = r.match(/^\/items\/([^/]+)$/)
  if (it) {
    const i = s.items.find((x) => x.id === it[1])
    if (!i) return error(404, 'no_encontrado', 'El producto no existe.')
    if (m === 'GET') return json(i)
    if (m === 'PUT') {
      const d = await cuerpo<DatosItemFacturacion>(req)
      const v = validarItem(d, entidad)
      if (v) return v
      Object.assign(i, { descripcion: d.descripcion.trim(), unidad: d.unidad ?? '94', precio: d.precio ?? null, tarifa_iva: d.tarifa_iva ?? '0', clasificacion: d.clasificacion, activo: d.activo ?? true, actualizado_en: ahora() })
      return json(i)
    }
  }

  // Facturas
  if (r === '/facturas') {
    if (m === 'GET') {
      return json(
        s.facturas
          .filter((f) => (!q.get('estado') || f.estado === q.get('estado')) && (!q.get('persona_id') || f.persona_id === q.get('persona_id')))
          .filter((f) => (!q.get('desde') || f.fecha >= (q.get('desde') ?? '')) && (!q.get('hasta') || f.fecha <= (q.get('hasta') ?? '')))
          .sort((x, y) => x.vencimiento.localeCompare(y.vencimiento))
          .map((f) => ({ ...f, lineas: [] })),
      )
    }
    if (m === 'POST') {
      const f = nuevaFactura(s, entidad, await cuerpo<NuevaFacturaVenta>(req))
      if (f instanceof Response) return f
      s.facturas.unshift(f)
      return json(f, 201)
    }
  }
  const fa = r.match(/^\/facturas\/([^/]+)(\/[a-z-]+)?$/)
  if (fa) {
    const f = s.facturas.find((x) => x.id === fa[1])
    if (!f) return error(404, 'no_encontrado', 'La factura no existe.')
    const accion = fa[2] ?? ''
    if (!accion && m === 'GET') return json(f)
    if (!accion && m === 'DELETE') {
      if (f.estado !== 'borrador') return error(409, 'conflicto_estado', 'Solo se borra una factura en borrador.')
      s.facturas = s.facturas.filter((x) => x !== f)
      return sinContenido()
    }
    if (m !== 'POST') return null
    const doc = documentoFactura(s, f.id)
    if (accion === '/emision') {
      if (f.estado !== 'borrador') return error(409, 'conflicto_estado', 'La factura ya se emitió.')
      Object.assign(f, { estado: 'emitida', numero: ++s.numero, emitida_en: ahora(), comprobante_id: CON_CONTABILIDAD.has(entidad) ? id(++consecutivo) : null })
      return json(f)
    }
    if (accion === '/anulacion') {
      const { motivo } = await cuerpo<{ motivo: string }>(req)
      if (!motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo.')
      if (doc?.estado === 'validado') return error(409, 'conflicto_estado', 'Tiene factura electrónica validada: anúlela con una nota crédito.')
      if (f.estado !== 'emitida' || Number(f.pagado) > 0) return error(409, 'conflicto_estado', 'Solo se anula una factura emitida sin pagos.')
      Object.assign(f, { estado: 'anulada', motivo_anulacion: motivo.trim() })
      return json(f)
    }
    if (accion === '/pago') {
      if (CON_CONTABILIDAD.has(entidad)) return error(409, 'conflicto_estado', 'Con contabilidad, el pago se registra con un recibo de caja de la tesorería.')
      if (f.estado !== 'emitida' && f.estado !== 'pagada_parcial') return error(409, 'conflicto_estado', 'La factura no está por cobrar.')
      const d = await cuerpo<PagoManual>(req)
      if (!d.fecha || !d.medio) return error(422, 'validacion', 'Indique la fecha y el medio de pago.')
      Object.assign(f, { estado: 'pagada', pagado: f.total })
      return json(f)
    }
    if (!fe) return sinFe()
    if (accion === '/factura-electronica') {
      if (f.estado === 'borrador' || f.estado === 'anulada') return error(409, 'conflicto_estado', 'Emita la factura antes de enviarla a la DIAN.')
      if (doc) {
        if (doc.estado === 'contingencia' || doc.estado === 'por_enviar') Object.assign(doc, { estado: 'validado', numero: doc.numero ?? ++s.numero, cufe: doc.cufe ?? cufe(consecutivo), intentos: doc.intentos + 1, validado_en: ahora(), respuesta: null })
        return json(doc)
      }
      return json(emitirDocumento(s, 'factura', f.id, f.total))
    }
    if (accion === '/factura-contingencia') {
      const { numero_talonario } = await cuerpo<{ numero_talonario: number }>(req)
      if (doc) return error(409, 'conflicto', 'La factura ya tiene una factura electrónica.')
      if (!(numero_talonario >= 1 && numero_talonario <= 500)) return error(422, 'validacion', 'El número no está en una resolución de contingencia vigente (el demo admite del 1 al 500).')
      return json(emitirDocumento(s, 'factura', f.id, f.total, { respuesta: `Transcripción tipo 03 del talonario ${numero_talonario}` }))
    }
    if (accion === '/nota-credito') {
      const { motivo } = await cuerpo<{ motivo: string }>(req)
      if (!motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo.')
      if (doc?.estado !== 'validado') return error(409, 'conflicto_estado', 'La factura no tiene factura electrónica validada.')
      if (f.estado === 'anulada') return error(409, 'conflicto_estado', 'La factura ya está anulada.')
      Object.assign(f, { estado: 'anulada', motivo_anulacion: motivo.trim() })
      return json(emitirDocumento(s, 'nota_credito', f.id, f.total, { referencia_id: doc.id }))
    }
    if (accion === '/nota-debito') {
      const d = await cuerpo<NotaDebito>(req)
      if (doc?.estado !== 'validado') return error(409, 'conflicto_estado', 'La factura no tiene factura electrónica validada.')
      if (!d.motivo || d.motivo.trim().length < 5) return error(422, 'validacion', 'El motivo debe tener entre 5 y 300 caracteres.')
      const nota = nuevaFactura(s, entidad, { persona_id: f.persona_id, fecha: d.fecha, vencimiento: d.vencimiento, descripcion: d.motivo, lineas: d.lineas })
      if (nota instanceof Response) return nota
      Object.assign(nota, { estado: 'emitida', numero: ++s.numero, emitida_en: ahora(), nota_debito_de: f.id, concepto_nota_debito: d.concepto })
      s.facturas.unshift(nota)
      return json(emitirDocumento(s, 'nota_debito', nota.id, nota.total, { referencia_id: doc.id }))
    }
    return null
  }

  // Compras y documento soporte
  if (r === '/compras' && m === 'POST') {
    const d = await cuerpo<NuevaFacturaProveedor>(req)
    if (!d.persona_id || !d.descripcion?.trim() || !d.lineas?.length) return error(422, 'validacion', 'Elija el proveedor, escriba la descripción y al menos una línea.')
    if (!CON_CONTABILIDAD.has(entidad) && d.lineas.some((l) => l.cuenta || l.retenciones?.length)) return error(422, 'validacion', 'Sin contabilidad, la compra no lleva cuentas ni retenciones.')
    if (CON_CONTABILIDAD.has(entidad) && d.lineas.some((l) => !l.cuenta)) return error(422, 'validacion', 'Con contabilidad, cada línea lleva su cuenta de gasto.')
    const base = d.lineas.reduce((t, l) => t + Number(l.base), 0)
    const iva = d.lineas.reduce((t, l) => t + Number(l.iva), 0)
    const c: FacturaProveedor = { ...compra(++consecutivo, d.persona_id, d.descripcion.trim(), n2(base), n2(iva)), numero: d.numero, prefijo: d.prefijo ?? '', fecha: d.fecha, vencimiento: d.vencimiento, cufe: d.cufe ?? null, registrada_en: ahora() }
    s.compras.unshift(c)
    return json(c, 201)
  }
  const co = r.match(/^\/compras\/([^/]+)\/(documento-soporte|nota-ajuste)$/)
  if (co && m === 'POST') {
    if (!fe) return sinFe()
    const c = s.compras.find((x) => x.id === co[1])
    if (!c) return error(404, 'no_encontrado', 'La compra no existe.')
    const ds = s.documentos.find((x) => x.origen_id === c.id && x.tipo === 'documento_soporte')
    if (co[2] === 'documento-soporte') return json(ds ?? emitirDocumento(s, 'documento_soporte', c.id, c.neto_pagar))
    const { motivo } = await cuerpo<{ motivo: string }>(req)
    if (!motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo.')
    if (ds?.estado !== 'validado') return error(409, 'conflicto_estado', 'La compra no tiene documento soporte validado.')
    if (c.estado === 'anulada') return error(409, 'conflicto_estado', 'La compra ya está anulada.')
    Object.assign(c, { estado: 'anulada', motivo_anulacion: motivo.trim() })
    return json(emitirDocumento(s, 'nota_ajuste_ds', c.id, c.neto_pagar, { referencia_id: ds.id }))
  }

  // Documentos
  if (r === '/documentos' && m === 'GET') {
    return json(s.documentos.filter((d) => (!q.get('tipo') || d.tipo === q.get('tipo')) && (!q.get('estado') || d.estado === q.get('estado'))))
  }
  const dc = r.match(/^\/documentos\/([^/]+)(\/[a-z-]+)?$/)
  if (dc) {
    const d = s.documentos.find((x) => x.id === dc[1])
    if (!d) return error(404, 'no_encontrado', 'El documento no existe.')
    const accion = dc[2] ?? ''
    if (!accion && m === 'GET') return json({ documento: d, eventos: s.eventosDoc.get(d.id) ?? [{ tipo: 'creado', ocurrido_en: d.creado_en }] })
    if (accion === '/pdf' && m === 'GET') return archivo(PDF, 'application/pdf', `${d.prefijo}${d.numero ?? ''}.pdf`)
    if (accion === '/paquete' && m === 'GET') return archivo('PK demo', 'application/zip', `${d.prefijo}${d.numero ?? ''}.zip`)
    if (accion === '/eventos' && m === 'GET') return json(s.radianPropios.get(d.id) ?? [])
    if (accion === '/reintento' && m === 'POST') {
      if (d.estado === 'validado' || d.estado === 'rechazado') return error(409, 'conflicto_estado', 'El documento ya tiene respuesta definitiva de la DIAN.')
      Object.assign(d, { estado: 'validado', numero: d.numero ?? ++s.numero, cufe: d.cufe ?? cufe(++consecutivo), intentos: d.intentos + 1, validado_en: ahora(), respuesta: null })
      return json(d)
    }
    if (accion === '/aceptacion-tacita' && m === 'POST') {
      if (d.tipo !== 'factura' || d.estado !== 'validado') return error(409, 'conflicto_estado', 'Solo una factura electrónica propia y validada.')
      const lista = s.radianPropios.get(d.id) ?? []
      if (lista.some((e) => e.tipo === 'aceptacion_tacita')) return error(409, 'conflicto', 'Ya se registró la aceptación tácita.')
      const ev = radian(++consecutivo, 'aceptacion_tacita')
      s.radianPropios.set(d.id, [...lista, ev])
      return json(ev, 201)
    }
    return null
  }

  // Recibidas
  if (r === '/recibidas') {
    if (m === 'GET') return json(s.recibidas.filter((x) => !q.get('estado') || x.estado === q.get('estado')))
    if (m === 'POST') {
      const d = await cuerpo<{ nombre_archivo: string; archivo_base64: string }>(req)
      const xml = leerBase64(d.archivo_base64)
      if (!xml.includes('<')) return error(422, 'validacion', 'El archivo no es un XML de factura electrónica.')
      const codigo = xml.match(/<cbc:UUID[^>]*>([^<]+)</)?.[1] ?? cufe(xml.length)
      if (s.recibidas.some((x) => x.cufe === codigo)) return error(409, 'conflicto', 'Esa factura ya se cargó.')
      const nit = xml.match(/<cbc:CompanyID[^>]*>(\d+)</)?.[1] ?? '900111222'
      const tercero = TERCEROS.find((t) => t.documento === nit)
      const nueva: FacturaRecibida = {
        ...recibidaDemo(++consecutivo, nit, tercero?.nombre ?? xml.match(/<cbc:RegistrationName>([^<]+)</)?.[1] ?? 'Proveedor', 'FV', xml.match(/<cbc:ID>([^<]+)</)?.[1] ?? String(consecutivo), '100000.00', '19000.00', 'pendiente', tercero?.persona_id ?? '', 0),
        cufe: codigo, persona_id: tercero?.persona_id ?? null, recibida_en: ahora(),
      }
      s.recibidas.unshift(nueva)
      return json(nueva, 201)
    }
  }
  const rc = r.match(/^\/recibidas\/([^/]+)(\/[a-z]+)?$/)
  if (rc) {
    const x = s.recibidas.find((y) => y.id === rc[1])
    if (!x) return error(404, 'no_encontrado', 'La factura recibida no existe.')
    const accion = rc[2] ?? ''
    if (!accion && m === 'GET') return json({ factura: x, eventos: s.radian.get(x.id) ?? [] })
    if (m !== 'POST') return null
    if (accion === '/vinculo') {
      const { factura_proveedor_id } = await cuerpo<{ factura_proveedor_id: string }>(req)
      if (x.estado !== 'pendiente') return error(409, 'conflicto_estado', 'La factura ya se registró o se rechazó.')
      if (!s.compras.some((c) => c.id === factura_proveedor_id)) return error(422, 'validacion', 'La factura de proveedor no existe.')
      Object.assign(x, { estado: 'registrada', factura_proveedor_id })
      return json(x)
    }
    if (accion === '/rechazo') {
      const { motivo } = await cuerpo<{ motivo: string }>(req)
      if (!motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo.')
      if (x.estado !== 'pendiente') return error(409, 'conflicto_estado', 'La factura ya se registró o se rechazó.')
      Object.assign(x, { estado: 'rechazada', motivo_rechazo: motivo.trim() })
      return json(x)
    }
    if (accion === '/eventos') return registrarEvento(s, x, await cuerpo<NuevoEventoRadian>(req))
    return null
  }

  // Contador
  if (m === 'GET' && (r === '/libro-ventas' || r === '/libro-compras' || r === '/paquete')) {
    const desde = q.get('desde') ?? ''
    const hasta = q.get('hasta') ?? ''
    if (!desde || !hasta || hasta < desde) return error(422, 'validacion', 'Indique un periodo válido.')
    if (r === '/paquete') return archivo('PK demo', 'application/zip', `paquete-${desde}.zip`, true)
    const filas = r === '/libro-ventas'
      ? [['numero', 'cufe', 'cliente', 'subtotal', 'iva', 'total'], ...s.facturas.filter((f) => f.numero && f.fecha >= desde && f.fecha <= hasta).map((f) => [`FV-${f.numero}`, documentoFactura(s, f.id)?.cufe ?? '', f.persona_id, f.subtotal, f.iva, f.total])]
      : [['emisor', 'numero', 'cufe', 'subtotal', 'iva', 'total'], ...s.recibidas.map((x) => [x.emisor_nombre, `${x.prefijo}${x.numero}`, x.cufe, x.subtotal, x.iva, x.total])]
    return archivo(filas.map((f) => f.join(';')).join('\n'), 'text/csv; charset=utf-8', `${r.slice(1)}-${desde}.csv`, true)
  }
  if (r === '/contabilizacion' && m === 'POST') {
    if (!CON_CONTABILIDAD.has(entidad)) return error(403, 'modulo_no_habilitado', 'La entidad no lleva contabilidad.')
    const { desde, hasta } = await cuerpo<{ desde: string; hasta: string }>(req)
    const del = s.facturas.filter((f) => f.numero && f.estado !== 'anulada' && f.fecha >= desde && f.fecha <= hasta)
    return json({
      contabilizadas: del.filter((f) => f.estado !== 'pagada').map((f) => f.id),
      pagadas_a_mano: del.filter((f) => f.estado === 'pagada').map((f) => f.id),
      fallidas: del.length > 2 ? [{ factura_id: del[0]!.id, motivo: 'El periodo de la fecha está cerrado.' }] : [],
    })
  }

  // Habilitación
  if (r.startsWith('/habilitacion')) return habilitar(s, r, m, req)
  return null
}

function validarItem(d: DatosItemFacturacion, entidad: string): Response | null {
  if (!d.descripcion?.trim()) return error(422, 'validacion', 'Escriba la descripción.')
  if (!admiteIva(d.clasificacion) && Number(d.tarifa_iva ?? '0') > 0) return error(422, 'validacion', 'Solo una venta o un alquiler/servicio lleva IVA.')
  if (!CON_CONTABILIDAD.has(entidad) && d.cuenta) return error(422, 'validacion', 'Sin contabilidad, el producto no lleva cuenta.')
  return null
}

function leerBase64(b64: string): string {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
  } catch {
    return ''
  }
}

const ORDEN: Record<string, string[]> = { acuse: [], recibo_bien: ['acuse'], aceptacion: ['acuse', 'recibo_bien'], reclamo: ['acuse', 'recibo_bien'] }

function registrarEvento(s: Estado, x: FacturaRecibida, d: NuevoEventoRadian): Response {
  const previos = ORDEN[d.tipo]
  if (!previos) return error(422, 'validacion', 'Ese evento no aplica a una factura recibida.')
  const lista = s.radian.get(x.id) ?? []
  const hechos = new Set(lista.filter((e) => e.estado !== 'rechazado').map((e) => e.tipo))
  if (hechos.has(d.tipo) || ((d.tipo === 'aceptacion' || d.tipo === 'reclamo') && (hechos.has('aceptacion') || hechos.has('reclamo')))) {
    return error(409, 'conflicto', 'Ese evento ya se registró.')
  }
  if (previos.some((p) => !hechos.has(p as EventoRadian['tipo']))) return error(422, 'validacion', 'Registre antes los eventos previos.')
  if ((d.tipo === 'acuse' || d.tipo === 'recibo_bien') && (!d.quien_recibe?.documento || !d.quien_recibe.nombres || !d.quien_recibe.apellidos)) {
    return error(422, 'validacion', 'Indique quién recibe: documento, nombres y apellidos.')
  }
  if (d.tipo === 'reclamo' && !d.concepto_reclamo) return error(422, 'validacion', 'Elija el concepto del reclamo.')
  const ev = radian(++consecutivo, d.tipo, { motivo: d.motivo ?? null, concepto_reclamo: d.concepto_reclamo ?? null, creado_en: ahora() })
  s.radian.set(x.id, [...lista, ev])
  return json(ev, 201)
}

async function habilitar(s: Estado, r: string, m: string, req: Request): Promise<Response | null> {
  const h = s.habilitacion
  if (r === '/habilitacion' && m === 'GET') return json(h)
  if (r === '/habilitacion/software' && m === 'PUT') {
    const d = await cuerpo<SoftwareFacturacion>(req)
    if (!/^[0-9a-f-]{36}$/i.test(d.software_id ?? '')) return error(422, 'validacion', 'El SoftwareID es el identificador (UUID) que le asignó la DIAN.')
    if (!/^\d{5}$/.test(d.pin ?? '')) return error(422, 'validacion', 'El PIN del software tiene 5 dígitos.')
    s.habilitacion = { ...h, software_id: d.software_id, test_set_id: d.test_set_id ?? null, estado: 'registrado', ambiente: 'habilitacion', envios: [] }
    return json(s.habilitacion)
  }
  if (r === '/habilitacion/certificado' && m === 'POST') {
    const d = await cuerpo<{ archivo_base64: string; contrasena: string }>(req)
    if (!d.archivo_base64) return error(422, 'validacion', 'Elija el archivo .p12 o .pfx.')
    if (d.contrasena === 'mala' || !d.contrasena) return error(422, 'validacion', 'No se pudo abrir el certificado: revise la contraseña.')
    h.certificado = { ...CERTIFICADO, id: id(++consecutivo), sujeto: 'CN=Comercial Andina S.A.S.,O=Andina,C=CO', vigente_desde: ahora() }
    return json(h.certificado)
  }
  if (r === '/habilitacion/set-pruebas' && m === 'POST') {
    const d = await cuerpo<SetPruebas>(req)
    if (!h.software_id || !h.test_set_id) return error(409, 'conflicto_estado', 'Registre el software con su TestSetId.')
    if (!h.certificado) return error(409, 'conflicto_estado', 'Cargue el certificado de firma.')
    const total = d.cantidad + (d.notas_credito ?? 0) + (d.notas_debito ?? 0)
    if (d.cantidad < 1 || total > 50) return error(422, 'validacion', 'El set lleva de 1 a 50 documentos.')
    const tipos: TipoDocumentoElectronico[] = [...Array<TipoDocumentoElectronico>(d.cantidad).fill('factura'), ...Array<TipoDocumentoElectronico>(d.notas_credito ?? 0).fill('nota_credito'), ...Array<TipoDocumentoElectronico>(d.notas_debito ?? 0).fill('nota_debito')]
    h.envios = tipos.map((tipo, i) => ({ id: id(++consecutivo), tipo, numero: `SETP99000${String(i + 1).padStart(4, '0')}`, codigo: cufe(consecutivo), estado: 'enviado', enviado_en: ahora() }))
    h.estado = 'en_pruebas'
    return json(h.envios)
  }
  if (r === '/habilitacion/set-pruebas/consulta' && m === 'POST') {
    if (!h.envios.length) return error(409, 'conflicto_estado', 'Envíe primero el set de pruebas.')
    h.envios = h.envios.map((e) => ({ ...e, estado: 'aceptado', consultado_en: ahora() }))
    h.estado = 'habilitado'
    return json(h)
  }
  if (r === '/habilitacion/produccion' && m === 'POST') {
    if (h.estado !== 'habilitado') return error(409, 'conflicto_estado', 'La entidad aún no está habilitada por la DIAN.')
    Object.assign(h, { estado: 'produccion', ambiente: 'produccion' })
    return json(h)
  }
  if (r === '/habilitacion/rangos' && m === 'POST') {
    if (h.estado !== 'produccion') return error(409, 'conflicto_estado', 'Pase primero a producción.')
    return json([{ id: id(++consecutivo), prefijo: 'FEAN', desde: 1, hasta: 5000, numero_resolucion: '18764000077123', vigente_desde: fechaDemo(), vigente_hasta: fechaDemo(730) }])
  }
  return null
}
