/**
 * Llamadas del módulo «Facturación» (`/entidades/{id}/facturacion/…`). Sirve con
 * `facturacion_electronica` sin contabilidad o con `contabilidad`; sin contabilidad no se envían
 * cuentas ni centros de costo (el backend responde 422).
 */
import { type ArchivoRecibido, descargar, type Descarga, recibirArchivo } from '@/api/archivos'
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  CertificadoFirma,
  DatosItemFacturacion,
  DetalleDocumentoElectronico,
  DetalleFacturaRecibida,
  DocumentoElectronico,
  EnvioSet,
  EstadoDocumentoElectronico,
  EstadoFacturaRecibida,
  EstadoFacturaVenta,
  EventoRadian,
  FacturaProveedor,
  FacturaRecibida,
  FacturaVenta,
  Habilitacion,
  InformeContabilizacion,
  ItemFacturacion,
  NotaDebito,
  NuevaFacturaProveedor,
  NuevaFacturaVenta,
  NuevoEventoRadian,
  NuevoItemFacturacion,
  PagoManual,
  RangoSincronizado,
  SetPruebas,
  SoftwareFacturacion,
  TipoDocumentoElectronico,
} from '@/api/tipos'

const e = (id: string) => ({ path: { entidad_id: id } })
const fac = (id: string, facturaId: string) => ({ path: { entidad_id: id, factura_id: facturaId } })
const doc = (id: string, documentoId: string) => ({ path: { entidad_id: id, documento_id: documentoId } })
const rec = (id: string, recibidaId: string) => ({ path: { entidad_id: id, recibida_id: recibidaId } })

export interface Periodo {
  desde: string
  hasta: string
}

// Catálogo

export function items(id: string, conInactivos = false): Promise<ItemFacturacion[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/facturacion/items', { params: { ...e(id), query: { con_inactivos: conInactivos || undefined } } }))
}

export function crearItem(id: string, datos: NuevoItemFacturacion, clave: string): Promise<ItemFacturacion> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/items', { params: e(id), body: datos, headers: idempotencia(clave) }))
}

/** Reemplaza los datos (el código no cambia); desactivarlo lo saca de las facturas nuevas. */
export function guardarItem(id: string, itemId: string, datos: DatosItemFacturacion): Promise<ItemFacturacion> {
  return exigir(api().PUT('/api/v1/entidades/{entidad_id}/facturacion/items/{item_id}', { params: { path: { entidad_id: id, item_id: itemId } }, body: datos }))
}

// Facturas de venta

export interface FiltrosFacturas {
  estado?: EstadoFacturaVenta
  personaId?: string
  desde?: string
  hasta?: string
}

export function facturas(id: string, f: FiltrosFacturas = {}): Promise<FacturaVenta[]> {
  return exigir(
    api().GET('/api/v1/entidades/{entidad_id}/facturacion/facturas', {
      params: { ...e(id), query: { estado: f.estado, persona_id: f.personaId, desde: f.desde, hasta: f.hasta } },
    }),
  )
}

export function factura(id: string, facturaId: string): Promise<FacturaVenta> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/facturacion/facturas/{factura_id}', { params: fac(id, facturaId) }))
}

/** Crea el borrador (el IVA de cada línea lo elige quien factura). */
export function crearFactura(id: string, datos: NuevaFacturaVenta, clave: string): Promise<FacturaVenta> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/facturas', { params: e(id), body: datos, headers: idempotencia(clave) }))
}

export async function borrarFactura(id: string, facturaId: string): Promise<void> {
  await exigir(api().DELETE('/api/v1/entidades/{entidad_id}/facturacion/facturas/{factura_id}', { params: fac(id, facturaId) }))
}

/** Le asigna el número interno del año y, con contabilidad, la contabiliza. */
export function emitirFactura(id: string, facturaId: string): Promise<FacturaVenta> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/facturas/{factura_id}/emision', { params: fac(id, facturaId) }))
}

/** Sin pagos ni factura electrónica validada (con ella, nota crédito). */
export function anularFactura(id: string, facturaId: string, motivo: string): Promise<FacturaVenta> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/facturas/{factura_id}/anulacion', { params: fac(id, facturaId), body: { motivo } }))
}

/** Pago a mano: solo sin contabilidad (con ella, 409: se paga con un recibo de caja). */
export function pagarFactura(id: string, facturaId: string, pago: PagoManual): Promise<FacturaVenta> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/facturas/{factura_id}/pago', { params: fac(id, facturaId), body: pago }))
}

// Documentos electrónicos

/** Pedirla otra vez devuelve el mismo documento (mismo CUFE) y lo reintenta si quedó en contingencia. */
export function facturaElectronica(id: string, facturaId: string): Promise<DocumentoElectronico> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/facturas/{factura_id}/factura-electronica', { params: fac(id, facturaId) }))
}

/** Transcribe una factura expedida en papel con el talonario de contingencia (máximo 48 horas). */
export function transcribirContingencia(id: string, facturaId: string, numeroTalonario: number): Promise<DocumentoElectronico> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/facturacion/facturas/{factura_id}/factura-contingencia', {
      params: fac(id, facturaId),
      body: { numero_talonario: numeroTalonario },
    }),
  )
}

export function notaCredito(id: string, facturaId: string, motivo: string): Promise<DocumentoElectronico> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/facturas/{factura_id}/nota-credito', { params: fac(id, facturaId), body: { motivo } }))
}

export function notaDebito(id: string, facturaId: string, datos: NotaDebito): Promise<DocumentoElectronico> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/facturas/{factura_id}/nota-debito', { params: fac(id, facturaId), body: datos }))
}

export interface FiltrosDocumentos {
  tipo?: TipoDocumentoElectronico
  estado?: EstadoDocumentoElectronico
}

export function documentos(id: string, f: FiltrosDocumentos = {}): Promise<DocumentoElectronico[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/facturacion/documentos', { params: { ...e(id), query: { tipo: f.tipo, estado: f.estado } } }))
}

export function documento(id: string, documentoId: string): Promise<DetalleDocumentoElectronico> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/facturacion/documentos/{documento_id}', { params: doc(id, documentoId) }))
}

/** Fuerza el reintento de uno por enviar o en contingencia (además del automático cada 30 min). */
export function reintentarDocumento(id: string, documentoId: string): Promise<DocumentoElectronico> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/documentos/{documento_id}/reintento', { params: doc(id, documentoId) }))
}

/** La representación gráfica en PDF, para verla dentro de la app. */
export function pdfDocumento(id: string, documentoId: string): Promise<ArchivoRecibido> {
  return recibirArchivo(
    api().GET('/api/v1/entidades/{entidad_id}/facturacion/documentos/{documento_id}/pdf', { params: doc(id, documentoId), parseAs: 'blob' }),
    'documento.pdf',
  )
}

/** El ZIP que recibe el adquirente (`AttachedDocument` y PDF). */
export function paqueteDocumento(id: string, documentoId: string): Promise<Descarga> {
  return descargar(
    api().GET('/api/v1/entidades/{entidad_id}/facturacion/documentos/{documento_id}/paquete', { params: doc(id, documentoId), parseAs: 'blob' }),
    'documento.zip',
  )
}

export function eventosDocumento(id: string, documentoId: string): Promise<EventoRadian[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/facturacion/documentos/{documento_id}/eventos', { params: doc(id, documentoId) }))
}

/** Evento 034 de una factura propia a crédito que el cliente no aceptó ni reclamó (la DIAN verifica el plazo). */
export function aceptacionTacita(id: string, documentoId: string): Promise<EventoRadian> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/documentos/{documento_id}/aceptacion-tacita', { params: doc(id, documentoId) }))
}

// Compras y documento soporte

/** Sin contabilidad va sin cuentas, centros ni retenciones; con ella es una cuenta por pagar. */
export function registrarCompra(id: string, datos: NuevaFacturaProveedor, clave: string): Promise<FacturaProveedor> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/compras', { params: e(id), body: datos, headers: idempotencia(clave) }))
}

export function documentoSoporte(id: string, compraId: string): Promise<DocumentoElectronico> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/compras/{factura_id}/documento-soporte', { params: fac(id, compraId) }))
}

/** Anula el documento soporte validado (y la compra) con una nota de ajuste. */
export function notaAjuste(id: string, compraId: string, motivo: string): Promise<DocumentoElectronico> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/compras/{factura_id}/nota-ajuste', { params: fac(id, compraId), body: { motivo } }))
}

// Recibidas y RADIAN

export function recibidas(id: string, estado?: EstadoFacturaRecibida): Promise<FacturaRecibida[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/facturacion/recibidas', { params: { ...e(id), query: { estado } } }))
}

export function recibida(id: string, recibidaId: string): Promise<DetalleFacturaRecibida> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/facturacion/recibidas/{recibida_id}', { params: rec(id, recibidaId) }))
}

/** Carga el XML (Base64); la misma factura no entra dos veces (409). */
export function cargarRecibida(id: string, nombreArchivo: string, archivoBase64: string): Promise<FacturaRecibida> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/facturacion/recibidas', { params: e(id), body: { nombre_archivo: nombreArchivo, archivo_base64: archivoBase64 } }),
  )
}

export function vincularRecibida(id: string, recibidaId: string, facturaProveedorId: string): Promise<FacturaRecibida> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/facturacion/recibidas/{recibida_id}/vinculo', {
      params: rec(id, recibidaId),
      body: { factura_proveedor_id: facturaProveedorId },
    }),
  )
}

export function rechazarRecibida(id: string, recibidaId: string, motivo: string): Promise<FacturaRecibida> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/recibidas/{recibida_id}/rechazo', { params: rec(id, recibidaId), body: { motivo } }))
}

/** Cada evento exige sus previos (422) y no se repite; la DIAN puede rechazarlo (`estado`). */
export function eventoRadian(id: string, recibidaId: string, evento: NuevoEventoRadian): Promise<EventoRadian> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/recibidas/{recibida_id}/eventos', { params: rec(id, recibidaId), body: evento }))
}

// Contador

export function libroVentas(id: string, p: Periodo): Promise<Descarga> {
  return descargar(api().GET('/api/v1/entidades/{entidad_id}/facturacion/libro-ventas', { params: { ...e(id), query: p }, parseAs: 'blob' }), `libro-ventas-${p.desde}.csv`)
}

export function libroCompras(id: string, p: Periodo): Promise<Descarga> {
  return descargar(api().GET('/api/v1/entidades/{entidad_id}/facturacion/libro-compras', { params: { ...e(id), query: p }, parseAs: 'blob' }), `libro-compras-${p.desde}.csv`)
}

export function paquetePeriodo(id: string, p: Periodo): Promise<Descarga> {
  return descargar(api().GET('/api/v1/entidades/{entidad_id}/facturacion/paquete', { params: { ...e(id), query: p }, parseAs: 'blob' }), `paquete-${p.desde}.zip`)
}

/** Contabiliza lo facturado antes de tener contabilidad; repetir no duplica. */
export function contabilizar(id: string, p: Periodo): Promise<InformeContabilizacion> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/contabilizacion', { params: e(id), body: p }))
}

// Habilitación

export function habilitacion(id: string): Promise<Habilitacion> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/facturacion/habilitacion', { params: e(id) }))
}

/** El PIN se guarda cifrado y no vuelve; cambiar el software vuelve la habilitación a `registrado`. */
export function registrarSoftware(id: string, datos: SoftwareFacturacion): Promise<Habilitacion> {
  return exigir(api().PUT('/api/v1/entidades/{entidad_id}/facturacion/habilitacion/software', { params: e(id), body: datos }))
}

/** El `.p12` y su contraseña no vuelven en ninguna respuesta. */
export function cargarCertificado(id: string, archivoBase64: string, contrasena: string): Promise<CertificadoFirma> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/facturacion/habilitacion/certificado', { params: e(id), body: { archivo_base64: archivoBase64, contrasena } }),
  )
}

export function enviarSetPruebas(id: string, datos: SetPruebas): Promise<EnvioSet[]> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/habilitacion/set-pruebas', { params: e(id), body: datos }))
}

/** Si la DIAN aceptó todos los envíos, la entidad queda `habilitado`. */
export function consultarSetPruebas(id: string): Promise<Habilitacion> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/habilitacion/set-pruebas/consulta', { params: e(id) }))
}

export function pasarAProduccion(id: string): Promise<Habilitacion> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/habilitacion/produccion', { params: e(id) }))
}

/** Registra como resoluciones los rangos autorizados que falten; devuelve los nuevos. */
export function sincronizarRangos(id: string): Promise<RangoSincronizado[]> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/facturacion/habilitacion/rangos', { params: e(id) }))
}
