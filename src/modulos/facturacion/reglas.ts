/**
 * Reglas y textos de la facturación (funciones puras). El backend calcula y decide; aquí se
 * estima lo que se ve mientras se escribe (totales con IVA por clasificación), se eligen los
 * botones según el estado y se ordenan los pasos de RADIAN y de la habilitación.
 */
import type {
  ClasificacionTributaria,
  ConceptoNotaDebito,
  ConceptoReclamo,
  DocumentoElectronico,
  EstadoDocumentoElectronico,
  EstadoEnvioSet,
  EstadoFacturaRecibida,
  EstadoFacturaVenta,
  EstadoHabilitacion,
  EventoRadian,
  FacturaVenta,
  Habilitacion,
  ItemFacturacion,
  LineaVentaNueva,
  MedioPagoManual,
  NuevaFacturaVenta,
  TipoDocumentoElectronico,
  TipoEventoRadian,
} from '@/api/tipos'
import { comparar, esDecimal, multiplicar, porcentajeDe, sumar } from '@/formato/decimales'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'

export const ESTADO_FACTURA: Record<EstadoFacturaVenta, { texto: string; tono: Tono }> = {
  borrador: { texto: 'Borrador', tono: 'neutro' },
  emitida: { texto: 'Emitida', tono: 'info' },
  pagada_parcial: { texto: 'Pagada en parte', tono: 'aviso' },
  pagada: { texto: 'Pagada', tono: 'exito' },
  anulada: { texto: 'Anulada', tono: 'peligro' },
}

export const ESTADO_DOCUMENTO: Record<EstadoDocumentoElectronico, { texto: string; tono: Tono }> = {
  por_enviar: { texto: 'Por enviar', tono: 'neutro' },
  enviado: { texto: 'Enviado a la DIAN', tono: 'info' },
  validado: { texto: 'Validado', tono: 'exito' },
  rechazado: { texto: 'Rechazado', tono: 'peligro' },
  contingencia: { texto: 'En contingencia', tono: 'aviso' },
}

export const TIPO_DOCUMENTO_ELECTRONICO: Record<TipoDocumentoElectronico, string> = {
  factura: 'Factura electrónica',
  nota_credito: 'Nota crédito',
  nota_debito: 'Nota débito',
  documento_soporte: 'Documento soporte',
  nota_ajuste_ds: 'Nota de ajuste del documento soporte',
}

export const CLASIFICACION: Record<ClasificacionTributaria, string> = {
  expensa: 'Expensa (cuota de administración)',
  cuota_extraordinaria: 'Cuota extraordinaria',
  uso_sin_cobro: 'Uso de bien común sin cobro',
  alquiler_servicio: 'Alquiler o servicio',
  venta: 'Venta',
  otra: 'Otra',
}

export const MEDIO_PAGO: Record<MedioPagoManual, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  consignacion: 'Consignación',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
  pse: 'PSE',
  otro: 'Otro',
}

export const CONCEPTO_NOTA_DEBITO: Record<ConceptoNotaDebito, string> = {
  intereses: 'Intereses',
  gastos_por_cobrar: 'Gastos por cobrar',
  cambio_del_valor: 'Cambio del valor',
  otro: 'Otro',
}

export const CONCEPTO_RECLAMO: Record<ConceptoReclamo, string> = {
  inconsistencias: 'Documento con inconsistencias',
  no_entregada_total: 'Mercancía no entregada',
  no_entregada_parcial: 'Mercancía entregada en parte',
  servicio_no_prestado: 'Servicio no prestado',
}

export const ESTADO_RECIBIDA: Record<EstadoFacturaRecibida, { texto: string; tono: Tono }> = {
  pendiente: { texto: 'Pendiente de registrar', tono: 'aviso' },
  registrada: { texto: 'Registrada', tono: 'exito' },
  rechazada: { texto: 'Rechazada', tono: 'peligro' },
}

export const EVENTO_RADIAN: Record<TipoEventoRadian, string> = {
  acuse: 'Acuse de recibo',
  recibo_bien: 'Recibo del bien o servicio',
  aceptacion: 'Aceptación expresa',
  reclamo: 'Reclamo',
  aceptacion_tacita: 'Aceptación tácita',
}

export const ESTADO_HABILITACION: Record<EstadoHabilitacion, string> = {
  registrado: 'Software registrado',
  en_pruebas: 'En pruebas',
  habilitado: 'Habilitado',
  produccion: 'En producción',
}

export const ESTADO_ENVIO: Record<EstadoEnvioSet, { texto: string; tono: Tono }> = {
  enviado: { texto: 'Enviado', tono: 'info' },
  aceptado: { texto: 'Aceptado', tono: 'exito' },
  rechazado: { texto: 'Rechazado', tono: 'peligro' },
  sin_respuesta: { texto: 'Sin respuesta', tono: 'aviso' },
}

/** Unidades de medida de la DIAN más usadas (código → nombre). */
export const UNIDADES: Record<string, string> = {
  '94': 'Unidad',
  HUR: 'Hora',
  DAY: 'Día',
  MON: 'Mes',
  KGM: 'Kilogramo',
  MTR: 'Metro',
  LTR: 'Litro',
  ZZ: 'Mutuamente definida',
}

/** Solo una venta o un alquiler/servicio admite IVA (las expensas y cuotas no lo llevan). */
export const admiteIva = (c: ClasificacionTributaria) => c === 'venta' || c === 'alquiler_servicio'

// Líneas de la factura -------------------------------------------------------------------------

/** Línea tal como se escribe (textos; los vacíos se toman del ítem del catálogo). */
export interface LineaEditable {
  clave: string
  item_id: string
  descripcion: string
  cantidad: string
  valor_unitario: string
  tarifa_iva: string
  clasificacion: ClasificacionTributaria
  /** Código de la cuenta de ingreso: solo con contabilidad. */
  cuenta: string
  centro: string
}

let consecutivoLinea = 0

export function lineaVacia(clasificacion: ClasificacionTributaria = 'venta'): LineaEditable {
  return { clave: `l${++consecutivoLinea}`, item_id: '', descripcion: '', cantidad: '1', valor_unitario: '', tarifa_iva: '0', clasificacion, cuenta: '', centro: '' }
}

/**
 * Llena la línea con el ítem elegido: descripción, precio sugerido, IVA y clasificación (y la
 * cuenta, si se lleva contabilidad). Se conserva la cantidad.
 */
export function conItem(l: LineaEditable, item: ItemFacturacion, codigoCuenta: (id: string) => string | undefined): LineaEditable {
  return {
    ...l,
    item_id: item.id,
    descripcion: item.descripcion,
    valor_unitario: item.precio ?? l.valor_unitario,
    tarifa_iva: admiteIva(item.clasificacion) ? item.tarifa_iva : '0',
    clasificacion: item.clasificacion,
    cuenta: item.cuenta_id ? (codigoCuenta(item.cuenta_id) ?? l.cuenta) : l.cuenta,
  }
}

const numero = (t: string) => (esDecimal(t.trim()) ? t.trim() : '0')

/** Subtotal e IVA estimados de una línea (redondeados a centavos; el backend calcula el real). */
export function calcularLinea(l: Pick<LineaEditable, 'cantidad' | 'valor_unitario' | 'tarifa_iva' | 'clasificacion'>): { subtotal: string; iva: string } {
  const subtotal = porcentajeDe(multiplicar(numero(l.cantidad), numero(l.valor_unitario)), '100')
  const iva = admiteIva(l.clasificacion) ? porcentajeDe(subtotal, numero(l.tarifa_iva)) : '0.00'
  return { subtotal, iva }
}

/** Totales estimados de la factura. */
export function totalesFactura(lineas: LineaEditable[]): { subtotal: string; iva: string; total: string } {
  const calculadas = lineas.map(calcularLinea)
  const subtotal = sumar('0', ...calculadas.map((c) => c.subtotal))
  const iva = sumar('0', ...calculadas.map((c) => c.iva))
  return { subtotal, iva, total: sumar(subtotal, iva) }
}

/** Encabezado y líneas del editor de una factura. */
export interface FacturaEditable {
  cliente: { id: string; nombre: string; detalle?: string | null } | null
  fecha: string
  vencimiento: string
  descripcion: string
  lineas: LineaEditable[]
}

export function facturaVacia(hoy: string, vencimiento: string): FacturaEditable {
  return { cliente: null, fecha: hoy, vencimiento, descripcion: '', lineas: [lineaVacia()] }
}

/**
 * Problemas que impiden guardar, en palabras. Sin contabilidad, la línea no envía cuenta ni
 * centro de costo (el backend respondería 422).
 */
export function erroresFactura(f: FacturaEditable): string[] {
  const errores: string[] = []
  if (!f.cliente) errores.push('Elija el cliente.')
  if (!f.descripcion.trim()) errores.push('Escriba la descripción de la factura.')
  if (f.vencimiento && f.fecha && f.vencimiento < f.fecha) errores.push('El vencimiento no puede ser anterior a la fecha.')
  if (f.lineas.length === 0) errores.push('Agregue al menos una línea.')
  f.lineas.forEach((l, i) => {
    const n = i + 1
    if (!l.item_id && !l.descripcion.trim()) errores.push(`La línea ${n} necesita un producto o una descripción.`)
    if (!esDecimal(l.cantidad.trim()) || comparar(numero(l.cantidad), '0') <= 0) errores.push(`La cantidad de la línea ${n} debe ser mayor que cero.`)
    if (!l.item_id && !esDecimal(l.valor_unitario.trim())) errores.push(`Escriba el valor unitario de la línea ${n}.`)
    if (!admiteIva(l.clasificacion) && comparar(numero(l.tarifa_iva), '0') !== 0) errores.push(`La línea ${n} no admite IVA por su clasificación.`)
  })
  return errores
}

/** El editor → `NuevaFacturaVentaPeticion`. Con `contabilidad` en falso no envía cuentas ni centros. */
export function peticionFactura(f: FacturaEditable, contabilidad: boolean): NuevaFacturaVenta {
  return {
    persona_id: f.cliente?.id ?? '',
    fecha: f.fecha,
    vencimiento: f.vencimiento,
    descripcion: f.descripcion.trim(),
    lineas: f.lineas.map((l) => peticionLinea(l, contabilidad)),
  }
}

/** Una línea del editor → `LineaVentaPeticion` (lo vacío lo completa el ítem del catálogo). */
export function peticionLinea(l: LineaEditable, contabilidad: boolean): LineaVentaNueva {
  const linea: LineaVentaNueva = {
    item_id: l.item_id || null,
    descripcion: l.descripcion.trim() || null,
    cantidad: l.cantidad.trim(),
    valor_unitario: l.valor_unitario.trim() || null,
    tarifa_iva: admiteIva(l.clasificacion) ? l.tarifa_iva.trim() || '0' : '0',
    clasificacion: l.clasificacion,
  }
  if (contabilidad) {
    linea.cuenta = l.cuenta || null
    linea.centro_costo = l.centro || null
  }
  return linea
}

// Botones según el estado ----------------------------------------------------------------------

export type AccionFactura =
  | 'emitir'
  | 'borrar'
  | 'pagar'
  | 'anular'
  | 'factura_electronica'
  | 'reintentar'
  | 'contingencia'
  | 'nota_credito'
  | 'nota_debito'
  | 'aceptacion_tacita'

export interface ContextoFactura {
  /** `facturacion.facturas.gestionar`. */
  gestionar: boolean
  /** `facturacion.emitir`. */
  emitir: boolean
  /** Módulo `facturacion_electronica`. */
  electronica: boolean
  /** Módulo `contabilidad`: el pago va con un recibo de caja. */
  contabilidad: boolean
  /** Hoy en la zona de la entidad (`YYYY-MM-DD`), para la aceptación tácita. */
  hoy: string
}

const COBRABLE: EstadoFacturaVenta[] = ['emitida', 'pagada_parcial']

/**
 * Qué se puede hacer con una factura según su estado, su documento electrónico (el de tipo
 * `factura`, si existe) y lo que la cuenta y la entidad tienen. Con factura electrónica
 * validada no se anula: se emite una nota crédito.
 */
export function accionesFactura(f: FacturaVenta, documento: DocumentoElectronico | null, c: ContextoFactura): AccionFactura[] {
  const a: AccionFactura[] = []
  if (f.estado === 'borrador') {
    if (c.gestionar) a.push('emitir', 'borrar')
    return a
  }
  if (f.estado === 'anulada') return a
  const validado = documento?.estado === 'validado'
  const sinPagos = comparar(f.pagado, '0') === 0
  if (c.gestionar && !c.contabilidad && COBRABLE.includes(f.estado)) a.push('pagar')
  if (c.gestionar && !validado && sinPagos && documento?.estado !== 'enviado') a.push('anular')
  if (c.electronica && c.emitir) {
    if (!documento) a.push('factura_electronica', 'contingencia')
    else if (documento.estado === 'por_enviar' || documento.estado === 'contingencia') a.push('reintentar')
    if (validado) {
      a.push('nota_credito')
      if (!f.nota_debito_de) a.push('nota_debito')
      if (f.vencimiento > f.fecha && c.hoy > f.fecha) a.push('aceptacion_tacita')
    }
  }
  return a
}

/** El documento de tipo `factura` de una factura de venta (el más reciente si hubo varios). */
export function documentoDeFactura(documentos: DocumentoElectronico[], facturaId: string): DocumentoElectronico | null {
  return documentos.find((d) => d.origen_id === facturaId && d.tipo === 'factura') ?? null
}

/** Las notas (crédito y débito) que se refieren al documento de una factura. */
export function notasDe(documentos: DocumentoElectronico[], documentoId: string | null): DocumentoElectronico[] {
  return documentoId ? documentos.filter((d) => d.referencia_id === documentoId) : []
}

/** Facturas con sus notas débito debajo (la nota trae `nota_debito_de`), como pide la guía. */
export function agruparNotasDebito(facturas: FacturaVenta[]): (FacturaVenta & { esNota: boolean })[] {
  const notas = new Map<string, FacturaVenta[]>()
  for (const f of facturas) if (f.nota_debito_de) notas.set(f.nota_debito_de, [...(notas.get(f.nota_debito_de) ?? []), f])
  const ids = new Set(facturas.map((f) => f.id))
  const salida: (FacturaVenta & { esNota: boolean })[] = []
  for (const f of facturas) {
    if (f.nota_debito_de && ids.has(f.nota_debito_de)) continue
    salida.push({ ...f, esNota: !!f.nota_debito_de })
    for (const n of notas.get(f.id) ?? []) salida.push({ ...n, esNota: true })
  }
  return salida
}

/** Documentos que requieren atención: rechazados (nunca se validan) o en contingencia. */
export const requiereAtencion = (d: DocumentoElectronico) => d.estado === 'rechazado' || d.estado === 'contingencia'

/** El proveedor simulado transmite sin validez ante la DIAN: se avisa siempre. */
export const esSimulado = (documentos: Pick<DocumentoElectronico, 'proveedor'>[]) => documentos.some((d) => d.proveedor === 'simulado')

// RADIAN ---------------------------------------------------------------------------------------

export type PasoRadian = 'acuse' | 'recibo_bien' | 'decision'

export interface EstadoPasoRadian {
  paso: PasoRadian
  hecho: boolean
  disponible: boolean
}

/** Eventos que cuentan: los rechazados por la DIAN no habilitan el siguiente paso. */
const vigentes = (eventos: Pick<EventoRadian, 'tipo' | 'estado'>[]) => new Set(eventos.filter((e) => e.estado !== 'rechazado').map((e) => e.tipo))

/**
 * Los cuatro eventos RADIAN de una factura recibida en orden: acuse → recibo del bien →
 * aceptación **o** reclamo. Cada paso se habilita cuando el previo existe; la decisión es una.
 */
export function pasosRadian(eventos: Pick<EventoRadian, 'tipo' | 'estado'>[]): EstadoPasoRadian[] {
  const hechos = vigentes(eventos)
  const decidida = hechos.has('aceptacion') || hechos.has('reclamo')
  return [
    { paso: 'acuse', hecho: hechos.has('acuse'), disponible: !hechos.has('acuse') },
    { paso: 'recibo_bien', hecho: hechos.has('recibo_bien'), disponible: hechos.has('acuse') && !hechos.has('recibo_bien') },
    { paso: 'decision', hecho: decidida, disponible: hechos.has('recibo_bien') && !decidida },
  ]
}

/** El acuse y el recibo del bien exigen quién recibe (Código de Comercio, arts. 773 y 774). */
export const exigeQuienRecibe = (t: TipoEventoRadian) => t === 'acuse' || t === 'recibo_bien'

// Habilitación ---------------------------------------------------------------------------------

export type PasoHabilitacion = 'software' | 'certificado' | 'set' | 'consulta' | 'produccion' | 'rangos'

export const PASOS_HABILITACION: { id: PasoHabilitacion; texto: string }[] = [
  { id: 'software', texto: 'Software' },
  { id: 'certificado', texto: 'Certificado' },
  { id: 'set', texto: 'Set de pruebas' },
  { id: 'consulta', texto: 'Resultado' },
  { id: 'produccion', texto: 'Producción' },
  { id: 'rangos', texto: 'Rangos' },
]

/** El paso en que va la habilitación, según el estado que devuelve el backend. */
export function pasoHabilitacion(h: Habilitacion): PasoHabilitacion {
  if (!h.software_id || !h.estado) return 'software'
  if (h.estado === 'produccion') return 'rangos'
  if (h.estado === 'habilitado') return 'produccion'
  if (!h.certificado || h.certificado.por_vencer) return 'certificado'
  if (h.envios.length === 0) return 'set'
  return 'consulta'
}
