/**
 * Llamadas del módulo «Cartera» de la PH (`/copropiedades/{id}/cartera/…`). Exige los módulos
 * `contabilidad_ph` y `contabilidad`. Los saldos nunca se editan: se calculan; cualquier
 * corrección es una acción con motivo.
 */
import { recibirArchivo, type ArchivoRecibido } from '@/api/archivos'
import { api, exigir, idempotencia } from '@/api/cliente'
import type {
  AcuerdoPago,
  AjusteCartera,
  Aplicado,
  BienCartera,
  CalculoMora,
  CambioConceptoCobro,
  CarteraEdades,
  CarteraInicial,
  Causado,
  CausacionIntereses,
  CertificadoCartera,
  CertificadoEmitido,
  ConceptoCobro,
  CuadreCartera,
  CuentaCobro,
  CuentaTesoreria,
  CuotaExtraordinaria,
  DatosPagoBien,
  DetalleCausacion,
  DetalleLiquidacion,
  EjecucionPresupuestal,
  EnvioCuentasCobro,
  EstadoCuenta,
  EstadoFondo,
  FilaCarteraInicial,
  Liquidado,
  LiquidacionCartera,
  MesFlujo,
  ModuloContribucion,
  Morosos,
  NotaCreditoCartera,
  NuevaCuotaExtraordinaria,
  NuevaPoliticaCartera,
  NuevoAcuerdoPago,
  NuevoCobroCartera,
  NuevoConceptoCobro,
  NuevoModuloContribucion,
  NuevoPresupuesto,
  NuevoRecaudo,
  NuevoRubroPresupuesto,
  Obligacion,
  PoliticaCartera,
  Presupuesto,
  Recaudo,
  RecaudoExtracto,
  Recibo,
  SaldoBien,
  SincronizacionMora,
  TasaReferencia,
  TipoCertificadoCartera,
  VistaLiquidacion,
} from '@/api/tipos'

const ph = (id: string) => ({ path: { copropiedad_id: id } })
const con = <T extends Record<string, string>>(id: string, extra: T) => ({ path: { copropiedad_id: id, ...extra } })

// Configuración

export function modulosContribucion(id: string): Promise<ModuloContribucion[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/modulos-contribucion', { params: ph(id) }))
}

export function crearModulo(id: string, datos: NuevoModuloContribucion): Promise<ModuloContribucion> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/modulos-contribucion', { params: ph(id), body: datos }))
}

export function guardarModulo(id: string, moduloId: string, datos: NuevoModuloContribucion): Promise<ModuloContribucion> {
  return exigir(api().PUT('/api/v1/copropiedades/{copropiedad_id}/cartera/modulos-contribucion/{modulo_id}', { params: con(id, { modulo_id: moduloId }), body: datos }))
}

export function conceptos(id: string): Promise<ConceptoCobro[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/conceptos', { params: ph(id) }))
}

export function crearConcepto(id: string, datos: NuevoConceptoCobro): Promise<ConceptoCobro> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/conceptos', { params: ph(id), body: datos }))
}

/** El código, el tipo y el criterio no cambian. */
export function guardarConcepto(id: string, conceptoId: string, datos: CambioConceptoCobro): Promise<ConceptoCobro> {
  return exigir(api().PUT('/api/v1/copropiedades/{copropiedad_id}/cartera/conceptos/{concepto_id}', { params: con(id, { concepto_id: conceptoId }), body: datos }))
}

/** Versiones de la política, la más reciente primero. */
export function politicas(id: string): Promise<PoliticaCartera[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/politicas', { params: ph(id) }))
}

export function crearPolitica(id: string, datos: NuevaPoliticaCartera): Promise<PoliticaCartera> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/politicas', { params: ph(id), body: datos }))
}

/** Bienes con su referencia de pago, pagador y deudor. */
export function bienes(id: string): Promise<BienCartera[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/bienes', { params: ph(id) }))
}

export function guardarDatosPago(id: string, bienId: string, datos: DatosPagoBien): Promise<BienCartera> {
  return exigir(api().PUT('/api/v1/copropiedades/{copropiedad_id}/cartera/bienes/{bien_privado_id}/datos-pago', { params: con(id, { bien_privado_id: bienId }), body: datos }))
}

/** Cuentas de tesorería donde entra el recaudo. */
export function cuentasTesoreria(id: string): Promise<CuentaTesoreria[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/cuentas', { params: { path: { entidad_id: id } } }))
}

// Presupuesto

export function presupuestos(id: string, anio?: number): Promise<Presupuesto[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/presupuestos', { params: { ...ph(id), query: { anio } } }))
}

export function presupuesto(id: string, presupuestoId: string): Promise<Presupuesto> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/presupuestos/{presupuesto_id}', { params: con(id, { presupuesto_id: presupuestoId }) }))
}

/** Siguiente versión del año, en borrador. */
export function crearPresupuesto(id: string, datos: NuevoPresupuesto): Promise<Presupuesto> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/presupuestos', { params: ph(id), body: datos }))
}

export function guardarRubros(id: string, presupuestoId: string, rubros: NuevoRubroPresupuesto[]): Promise<Presupuesto> {
  return exigir(api().PUT('/api/v1/copropiedades/{copropiedad_id}/cartera/presupuestos/{presupuesto_id}/rubros', { params: con(id, { presupuesto_id: presupuestoId }), body: { rubros } }))
}

/** La asamblea lo aprobó: pasa a vigente y reemplaza la versión vigente del año. */
export function aprobarPresupuesto(id: string, presupuestoId: string, vigenteDesde: string): Promise<Presupuesto> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/presupuestos/{presupuesto_id}/aprobacion', {
      params: con(id, { presupuesto_id: presupuestoId }),
      body: { vigente_desde: vigenteDesde },
    }),
  )
}

export function ejecucion(id: string, presupuestoId: string, hastaMes: number): Promise<EjecucionPresupuestal> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/presupuestos/{presupuesto_id}/ejecucion', {
      params: { ...con(id, { presupuesto_id: presupuestoId }), query: { hasta_mes: hastaMes } },
    }),
  )
}

/** Copia el vigente del año base con un ajuste porcentual (queda en borrador). */
export function proyectoPresupuesto(id: string, anioBase: number, ajuste: string): Promise<Presupuesto> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/presupuestos/proyecto', { params: ph(id), body: { anio_base: anioBase, ajuste_porcentual: ajuste } }))
}

// Cuotas extraordinarias

export function cuotasExtraordinarias(id: string): Promise<CuotaExtraordinaria[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/cuotas-extraordinarias', { params: ph(id) }))
}

export function crearCuota(id: string, datos: NuevaCuotaExtraordinaria): Promise<CuotaExtraordinaria> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/cuotas-extraordinarias', { params: ph(id), body: datos }))
}

export async function anularCuota(id: string, cuotaId: string): Promise<void> {
  await exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/cuotas-extraordinarias/{cuota_id}/anulacion', { params: con(id, { cuota_id: cuotaId }) }))
}

// Liquidación

/** Calcula la liquidación del periodo sin guardar nada. */
export function vistaLiquidacion(id: string, periodo: string): Promise<VistaLiquidacion> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/liquidaciones/vista-previa', { params: ph(id), body: { periodo } }))
}

/** Liquida y contabiliza el periodo (409 si ya está liquidado). */
export function liquidar(id: string, periodo: string, clave: string): Promise<Liquidado> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/liquidaciones', { params: ph(id), body: { periodo }, headers: idempotencia(clave) }))
}

export function liquidaciones(id: string): Promise<LiquidacionCartera[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/liquidaciones', { params: ph(id) }))
}

export function liquidacion(id: string, liquidacionId: string): Promise<DetalleLiquidacion> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/liquidaciones/{liquidacion_id}', { params: con(id, { liquidacion_id: liquidacionId }) }))
}

/** Sin pagos ni ajustes; con pagos se corrige con notas crédito. */
export function anularLiquidacion(id: string, liquidacionId: string, motivo: string): Promise<LiquidacionCartera> {
  return exigir(
    api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/liquidaciones/{liquidacion_id}/anulacion', { params: con(id, { liquidacion_id: liquidacionId }), body: { motivo } }),
  )
}

/** Envía por correo cada cuenta de cobro a su pagador. */
export function enviarCuentas(id: string, liquidacionId: string): Promise<EnvioCuentasCobro> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/liquidaciones/{liquidacion_id}/envio', { params: con(id, { liquidacion_id: liquidacionId }) }))
}

export function cuentasCobro(id: string, filtro: { liquidacionId?: string; bienId?: string }): Promise<CuentaCobro[]> {
  return exigir(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/cuentas-cobro', {
      params: { ...ph(id), query: { liquidacion_id: filtro.liquidacionId, bien_privado_id: filtro.bienId } },
    }),
  )
}

export function pdfCuentaCobro(id: string, cuentaId: string): Promise<ArchivoRecibido> {
  return recibirArchivo(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/cuentas-cobro/{cuenta_cobro_id}/pdf', { params: con(id, { cuenta_cobro_id: cuentaId }), parseAs: 'blob' }),
    'cuenta-de-cobro.pdf',
  )
}

// Recaudos

/** Se imputa solo según la política; lo que sobra queda como anticipo. */
export function recaudar(id: string, datos: NuevoRecaudo, clave: string): Promise<Recaudo> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/recaudos', { params: ph(id), body: datos, headers: idempotencia(clave) }))
}

/** Recauda los créditos del extracto cuya referencia es la de un bien, y los concilia. */
export function recaudarPorReferencia(id: string, cuentaId: string, desde: string, hasta: string): Promise<RecaudoExtracto> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/recaudos/por-referencia', { params: ph(id), body: { cuenta_tesoreria_id: cuentaId, desde, hasta } }))
}

export function anularRecaudo(id: string, reciboId: string, motivo: string): Promise<Recibo> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/recaudos/{recibo_id}/anulacion', { params: con(id, { recibo_id: reciboId }), body: { motivo } }))
}

/** Aplica lo sin aplicar de un recibo (anticipo o por identificar) a un bien. */
export function aplicarRecibo(id: string, reciboId: string, bienId: string): Promise<Aplicado[]> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/recibos/{recibo_id}/aplicacion', { params: con(id, { recibo_id: reciboId }), body: { bien_privado_id: bienId } }))
}

/** Recibos de la tesorería que aún no se sabe de quién son (para aplicarlos a una unidad). */
export function recibosPorIdentificar(id: string): Promise<Recibo[]> {
  return exigir(api().GET('/api/v1/entidades/{entidad_id}/contabilidad/tesoreria/recibos', { params: { path: { entidad_id: id }, query: { sin_identificar: true } } }))
}

// Ajustes

export function cobrar(id: string, datos: NuevoCobroCartera, clave: string): Promise<Obligacion> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/cobros', { params: ph(id), body: datos, headers: idempotencia(clave) }))
}

/** Solo un cobro manual sin pagos ni ajustes. */
export async function anularObligacion(id: string, obligacionId: string, motivo: string): Promise<void> {
  await exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/obligaciones/{obligacion_id}/anulacion', { params: con(id, { obligacion_id: obligacionId }), body: { motivo } }))
}

/** Lo liquidado no se edita: se corrige con una nota crédito. */
export function notaCredito(id: string, obligacionId: string, datos: NotaCreditoCartera): Promise<AjusteCartera> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/obligaciones/{obligacion_id}/notas-credito', { params: con(id, { obligacion_id: obligacionId }), body: datos }))
}

/** Con errores no carga nada; `soloValidar` es la vista previa. */
export function carteraInicial(id: string, filas: FilaCarteraInicial[], soloValidar: boolean): Promise<CarteraInicial> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/inicial', { params: ph(id), body: { filas, solo_validar: soloValidar } }))
}

// Saldos

export function estadoCuenta(id: string, bienId: string, corte?: string): Promise<EstadoCuenta> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/bienes/{bien_privado_id}/estado-cuenta', { params: { ...con(id, { bien_privado_id: bienId }), query: { corte } } }))
}

/** Solo los bienes con saldo. */
export function saldos(id: string, corte?: string): Promise<SaldoBien[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/saldos', { params: { ...ph(id), query: { corte } } }))
}

export function cuadre(id: string): Promise<CuadreCartera[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/cuadre', { params: ph(id) }))
}

export function edades(id: string, corte?: string): Promise<CarteraEdades> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/edades', { params: { ...ph(id), query: { corte } } }))
}

// Intereses

export function tasasReferencia(id: string): Promise<TasaReferencia[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/tasas-referencia', { params: ph(id) }))
}

export function vistaIntereses(id: string, hasta: string): Promise<CalculoMora> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/intereses/vista-previa', { params: ph(id), body: { hasta } }))
}

export function causarIntereses(id: string, hasta: string, clave: string): Promise<Causado> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/intereses', { params: ph(id), body: { hasta }, headers: idempotencia(clave) }))
}

export function causaciones(id: string): Promise<CausacionIntereses[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/intereses', { params: ph(id) }))
}

export function causacion(id: string, causacionId: string): Promise<DetalleCausacion> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/intereses/{causacion_id}', { params: con(id, { causacion_id: causacionId }) }))
}

export function anularCausacion(id: string, causacionId: string, motivo: string): Promise<CausacionIntereses> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/intereses/{causacion_id}/anulacion', { params: con(id, { causacion_id: causacionId }), body: { motivo } }))
}

// Acuerdos

export function acuerdos(id: string, bienId?: string): Promise<AcuerdoPago[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/acuerdos', { params: { ...ph(id), query: { bien_privado_id: bienId } } }))
}

/** Por todo lo que debe el bien; lo aprueba otra cuenta. */
export function proponerAcuerdo(id: string, datos: NuevoAcuerdoPago, clave: string): Promise<AcuerdoPago> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/acuerdos', { params: ph(id), body: datos, headers: idempotencia(clave) }))
}

/** 409 si lo intenta la misma cuenta que lo propuso (cuatro ojos); suspende la mora. */
export function aprobarAcuerdo(id: string, acuerdoId: string): Promise<AcuerdoPago> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/acuerdos/{acuerdo_id}/aprobacion', { params: con(id, { acuerdo_id: acuerdoId }) }))
}

export function anularAcuerdo(id: string, acuerdoId: string): Promise<AcuerdoPago> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/acuerdos/{acuerdo_id}/anulacion', { params: con(id, { acuerdo_id: acuerdoId }) }))
}

// Certificados

export function certificados(id: string, bienId: string): Promise<CertificadoCartera[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/bienes/{bien_privado_id}/certificados', { params: con(id, { bien_privado_id: bienId }) }))
}

/** El código y el PDF se entregan una sola vez (el paz y salvo, solo si el bien no debe). */
export function emitirCertificado(id: string, bienId: string, tipo: TipoCertificadoCartera): Promise<CertificadoEmitido> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/bienes/{bien_privado_id}/certificados', { params: con(id, { bien_privado_id: bienId }), body: { tipo } }))
}

// Integraciones

/** Reuniones de asamblea (la primera página basta para elegir a cuál enviar los morosos). */
export async function reuniones(id: string) {
  return (await exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/asambleas', { params: { ...ph(id), query: { limite: 30 } } }))).datos
}

/** Fija los morosos de una reunión con los bienes con cartera vencida al corte. */
export function enviarMorosos(id: string, reunionId: string, corte?: string): Promise<Morosos> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/asambleas/{reunion_id}/morosos', { params: con(id, { reunion_id: reunionId }), body: { corte: corte || null } }))
}

/** Restringe las reservas de los bienes con vencido desde el umbral y levanta las que ya no lo superan. */
export function restringirPorMora(id: string, umbral: string): Promise<SincronizacionMora> {
  return exigir(api().POST('/api/v1/copropiedades/{copropiedad_id}/cartera/reservas/restricciones-mora', { params: ph(id), body: { umbral } }))
}

// Informes

export function informeFondo(id: string, anio?: number): Promise<EstadoFondo> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/informes/fondo', { params: { ...ph(id), query: { anio } } }))
}

export function flujoCaja(id: string, desde: string, hasta: string): Promise<MesFlujo[]> {
  return exigir(api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/informes/flujo-caja', { params: { ...ph(id), query: { desde, hasta } } }))
}

export function informeAsamblea(id: string, anio: number, hastaMes: number): Promise<ArchivoRecibido> {
  return recibirArchivo(
    api().GET('/api/v1/copropiedades/{copropiedad_id}/cartera/informes/asamblea', { params: { ...ph(id), query: { anio, hasta_mes: hastaMes } }, parseAs: 'blob' }),
    `informe-asamblea-${anio}.pdf`,
  )
}
