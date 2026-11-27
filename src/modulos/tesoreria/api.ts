/**
 * Llamadas del módulo «Tesorería» (`/entidades/{id}/contabilidad/{tesoreria,cuentas-por-pagar,
 * cuentas-por-cobrar}/…`). Los documentos no se editan ni se borran: se **anulan** con motivo.
 */
import { descargar } from '@/api/archivos'
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  CambioCuentaTesoreria,
  CertificadoRetencion,
  Conciliacion,
  ConceptoRetencion,
  CuentaTesoreria,
  Egreso,
  EstadoEgreso,
  EstadoFacturaProveedor,
  EstadoMovimientoExtracto,
  Extracto,
  FacturaProveedor,
  FacturaVenta,
  FilaCarteraClientes,
  FormatoExtracto,
  InformeConciliacion,
  LineaLibros,
  LineaRef,
  MapeoColumnas,
  MovimientoExtracto,
  NuevaCuentaTesoreria,
  NuevaFacturaProveedor,
  NuevoEgreso,
  NuevoRecibo,
  Recibo,
  Uvt,
  VistaPreviaExtracto,
} from '@/api/tipos'

const e = (id: string) => ({ path: { entidad_id: id } })
const cta = (id: string, c: string) => ({ path: { entidad_id: id, cuenta_id: c } })
const rec = (id: string, r: string) => ({ path: { entidad_id: id, recibo_id: r } })
const egr = (id: string, x: string) => ({ path: { entidad_id: id, egreso_id: x } })
const fac = (id: string, f: string) => ({ path: { entidad_id: id, factura_id: f } })
const per = (id: string, p: string) => ({ path: { entidad_id: id, persona_id: p } })

// Cuentas de tesorería -----------------------------------------------------------------------

export function cuentasTesoreria(id: string): Promise<CuentaTesoreria[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/cuentas', { params: e(id) }))
}

/** Del número de cuenta solo se guardan los cuatro últimos dígitos. */
export function crearCuentaTesoreria(id: string, datos: NuevaCuentaTesoreria, clave: string): Promise<CuentaTesoreria> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/cuentas', { params: e(id), body: datos, headers: idempotencia(clave) }))
}

export function editarCuentaTesoreria(id: string, cuenta: string, datos: CambioCuentaTesoreria): Promise<CuentaTesoreria> {
  return exigir(api().PUT('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/cuentas/{cuenta_id}', { params: cta(id, cuenta), body: datos }))
}

// Recibos de caja ----------------------------------------------------------------------------

export interface FiltrosRecibos {
  desde?: string
  hasta?: string
  persona_id?: string
  cuenta_tesoreria_id?: string
  sin_identificar?: boolean
}

export function recibos(id: string, f: FiltrosRecibos = {}): Promise<Recibo[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/recibos', { params: { ...e(id), query: f } }))
}

export function recibo(id: string, r: string): Promise<Recibo> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/recibos/{recibo_id}', { params: rec(id, r) }))
}

/** Registra y contabiliza el recibo; lo no aplicado queda como anticipo o por identificar. */
export function crearRecibo(id: string, datos: NuevoRecibo, clave: string): Promise<Recibo> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/recibos', { params: e(id), body: datos, headers: idempotencia(clave) }))
}

/** Aplica lo que falta de un recibo a una factura de venta. */
export function aplicarRecibo(id: string, r: string, facturaVentaId: string, valor: string): Promise<Recibo> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/recibos/{recibo_id}/aplicaciones', {
      params: rec(id, r),
      body: { factura_venta_id: facturaVentaId, valor },
    }),
  )
}

export function anularRecibo(id: string, r: string, motivo: string): Promise<Recibo> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/recibos/{recibo_id}/anulacion', { params: rec(id, r), body: { motivo: motivo.trim() } }))
}

/** Facturas de venta del cliente (`facturacion.ver`), para aplicar un recibo. */
export function facturasVenta(id: string, personaId: string): Promise<FacturaVenta[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/facturacion/facturas', { params: { ...e(id), query: { persona_id: personaId } } }))
}

// Egresos ------------------------------------------------------------------------------------

export function egresos(id: string, estado?: EstadoEgreso): Promise<Egreso[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/egresos', { params: { ...e(id), query: { estado } } }))
}

export function egreso(id: string, x: string): Promise<Egreso> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/egresos/{egreso_id}', { params: egr(id, x) }))
}

/** Registra el egreso: queda **por autorizar** (lo autoriza otra cuenta). */
export function crearEgreso(id: string, datos: NuevoEgreso, clave: string): Promise<Egreso> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/egresos', { params: e(id), body: datos, headers: idempotencia(clave) }))
}

/** 409 `conflicto` si lo intenta la misma cuenta que lo registró. */
export function autorizarEgreso(id: string, x: string): Promise<Egreso> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/egresos/{egreso_id}/autorizacion', { params: egr(id, x) }))
}

/** Paga (y contabiliza) un egreso autorizado. */
export function pagarEgreso(id: string, x: string, fecha: string | null = null): Promise<Egreso> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/egresos/{egreso_id}/pago', { params: egr(id, x), body: { fecha } }))
}

export function anularEgreso(id: string, x: string, motivo: string): Promise<Egreso> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/egresos/{egreso_id}/anulacion', { params: egr(id, x), body: { motivo: motivo.trim() } }))
}

// Retenciones y UVT --------------------------------------------------------------------------

export function retenciones(id: string, vigentesEn?: string): Promise<ConceptoRetencion[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/retenciones', { params: { ...e(id), query: { vigentes_en: vigentesEn } } }))
}

export function uvt(id: string): Promise<Uvt[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/uvt', { params: e(id) }))
}

// Cuentas por pagar --------------------------------------------------------------------------

export function facturasProveedor(id: string, f: { persona_id?: string; estado?: EstadoFacturaProveedor; desde?: string; hasta?: string } = {}): Promise<FacturaProveedor[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/cuentas-por-pagar/facturas', { params: { ...e(id), query: f } }))
}

export function facturaProveedor(id: string, f: string): Promise<FacturaProveedor> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/cuentas-por-pagar/facturas/{factura_id}', { params: fac(id, f) }))
}

/** Registra la factura (409 si el proveedor ya usó ese número; la excepción exige autorizar egresos). */
export function crearFacturaProveedor(id: string, datos: NuevaFacturaProveedor, clave: string): Promise<FacturaProveedor> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/cuentas-por-pagar/facturas', { params: e(id), body: datos, headers: idempotencia(clave) }))
}

export function causarFactura(id: string, f: string): Promise<FacturaProveedor> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/cuentas-por-pagar/facturas/{factura_id}/causacion', { params: fac(id, f) }))
}

export function anularFactura(id: string, f: string, motivo: string): Promise<FacturaProveedor> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/cuentas-por-pagar/facturas/{factura_id}/anulacion', { params: fac(id, f), body: { motivo: motivo.trim() } }))
}

export interface Rango {
  desde: string
  hasta: string
}

export function certificado(id: string, personaId: string, r: Rango): Promise<CertificadoRetencion> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/cuentas-por-pagar/certificados/{persona_id}', { params: { ...per(id, personaId), query: r } }))
}

export function certificadoPdf(id: string, personaId: string, r: Rango) {
  return descargar(
    api().GET('/api/v1/entidades/{entidad_id}/contabilidad/cuentas-por-pagar/certificados/{persona_id}/pdf', { params: { ...per(id, personaId), query: r }, parseAs: 'blob' }),
    'certificado-retenciones.pdf',
  )
}

/** Envía el certificado al correo del tercero; devuelve a dónde (dato personal: no se guarda). */
export function enviarCertificado(id: string, personaId: string, r: Rango): Promise<{ para: string }> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/cuentas-por-pagar/certificados/{persona_id}/envio', { params: { ...per(id, personaId), query: r } }))
}

// Cartera por edades (clientes y proveedores) ------------------------------------------------

export function carteraPorEdades(id: string, corte: string): Promise<FilaCarteraClientes[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/cuentas-por-cobrar/edades', { params: { ...e(id), query: { corte } } }))
}

/** Lo que se debe a cada proveedor por edades (mismo formato que la cartera de clientes). */
export function porPagarPorEdades(id: string, corte: string): Promise<FilaCarteraClientes[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/cuentas-por-pagar/edades', { params: { ...e(id), query: { corte } } }))
}

// Soportes en PDF -----------------------------------------------------------------------------

/** Recibo de caja en PDF (para entregar a quien pagó). */
export function reciboPdf(id: string, reciboId: string) {
  return descargar(
    api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/recibos/{recibo_id}/pdf', { params: { path: { entidad_id: id, recibo_id: reciboId } }, parseAs: 'blob' }),
    'recibo-caja.pdf',
  )
}

/** Comprobante de egreso en PDF (para la firma del beneficiario). */
export function egresoPdf(id: string, egresoId: string) {
  return descargar(
    api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/egresos/{egreso_id}/pdf', { params: { path: { entidad_id: id, egreso_id: egresoId } }, parseAs: 'blob' }),
    'egreso.pdf',
  )
}

// Extractos y conciliación -------------------------------------------------------------------

export interface ArchivoExtracto {
  nombre_archivo: string
  archivo_base64: string
  formato: FormatoExtracto
  mapeo?: MapeoColumnas | null
  saldo_inicial?: string | null
  saldo_final?: string | null
}

export function mapeoGuardado(id: string, cuenta: string): Promise<MapeoColumnas | null> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/cuentas/{cuenta_id}/mapeo-extracto', { params: cta(id, cuenta) })).then((r) => r.mapeo ?? null)
}

export function guardarMapeo(id: string, cuenta: string, mapeo: MapeoColumnas) {
  return exigir(api().PUT('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/cuentas/{cuenta_id}/mapeo-extracto', { params: cta(id, cuenta), body: mapeo }))
}

/** Lee el archivo sin guardar nada: movimientos y errores por fila. */
export function vistaPreviaExtracto(id: string, cuenta: string, datos: ArchivoExtracto): Promise<VistaPreviaExtracto> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/cuentas/{cuenta_id}/extractos/vista-previa', { params: cta(id, cuenta), body: datos }))
}

/** Importa el extracto (409 si ya se cargó en la cuenta) y guarda el mapeo. */
export function importarExtracto(id: string, cuenta: string, datos: ArchivoExtracto): Promise<Extracto> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/cuentas/{cuenta_id}/extractos', { params: cta(id, cuenta), body: datos }))
}

export function extractos(id: string, cuenta: string): Promise<Extracto[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/cuentas/{cuenta_id}/extractos', { params: cta(id, cuenta) }))
}

export function movimientosExtracto(id: string, cuenta: string, f: Rango & { estado?: EstadoMovimientoExtracto }): Promise<MovimientoExtracto[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/cuentas/{cuenta_id}/movimientos', { params: { ...cta(id, cuenta), query: f } }))
}

export function lineasLibros(id: string, cuenta: string, f: Rango & { solo_pendientes?: boolean }): Promise<LineaLibros[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/cuentas/{cuenta_id}/libros', { params: { ...cta(id, cuenta), query: f } }))
}

/** Empareja por valor y fecha (con tolerancia de días, máximo 10). */
export function conciliarAutomatico(id: string, cuenta: string, r: Rango, toleranciaDias = 3): Promise<Conciliacion[]> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/cuentas/{cuenta_id}/conciliacion-automatica', { params: cta(id, cuenta), body: { ...r, tolerancia_dias: toleranciaDias } }),
  )
}

export function conciliaciones(id: string, cuenta: string): Promise<Conciliacion[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/cuentas/{cuenta_id}/conciliaciones', { params: cta(id, cuenta) }))
}

/** Concilia a mano movimientos del extracto con líneas de libros (deben sumar lo mismo). */
export function conciliarManual(id: string, cuenta: string, movimientos: string[], lineas: LineaRef[]): Promise<Conciliacion> {
  return exigir(api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/cuentas/{cuenta_id}/conciliaciones', { params: cta(id, cuenta), body: { movimientos, lineas } }))
}

export function deshacerConciliacion(id: string, conciliacionId: string): Promise<Conciliacion> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/conciliaciones/{conciliacion_id}/deshacer', { params: { path: { entidad_id: id, conciliacion_id: conciliacionId } } }),
  )
}

export function marcarPartida(id: string, movimiento: string, partida: boolean): Promise<MovimientoExtracto> {
  return exigir(
    api().PUT('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/movimientos/{movimiento_id}/partida-conciliatoria', {
      params: { path: { entidad_id: id, movimiento_id: movimiento } },
      body: { partida },
    }),
  )
}

/** Crea un recibo no identificado desde un crédito del extracto. */
export function reciboDesdeMovimiento(id: string, movimiento: string, descripcion: string): Promise<Recibo> {
  return exigir(
    api().POST('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/movimientos/{movimiento_id}/recibo', {
      params: { path: { entidad_id: id, movimiento_id: movimiento } },
      body: { descripcion: descripcion.trim() },
    }),
  )
}

export function informeConciliacion(id: string, cuenta: string, corte: string): Promise<InformeConciliacion> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/cuentas/{cuenta_id}/informe-conciliacion', { params: { ...cta(id, cuenta), query: { corte } } }))
}
