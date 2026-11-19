/**
 * Números de los documentos de facturación (funciones puras). Los usan la facturación, la
 * tesorería (recibos aplicados a facturas) y la cartera de clientes.
 */

/** Factura de venta: «FV-120» al emitirse (su comprobante `FV`); «Borrador» antes. */
export function numeroFacturaVenta(f: { numero?: number | null }): string {
  return f.numero ? `FV-${f.numero}` : 'Borrador'
}

/**
 * Documento electrónico: prefijo y número juntos, como los imprime la DIAN («FE1001», «NC2603»).
 * Sin número todavía (por enviar), solo el prefijo.
 */
export function numeroDocumento(d: { prefijo: string; numero?: number | null }): string {
  return d.numero ? `${d.prefijo}${d.numero}` : `${d.prefijo} (sin número)`
}
