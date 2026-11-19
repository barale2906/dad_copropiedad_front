import { beforeEach, describe, expect, it } from 'vitest'
import type { DocumentoElectronico, FacturaVenta, Habilitacion, ItemFacturacion } from '@/api/tipos'
import { limpiar } from '@/api/tokens'
import { numeroDocumento, numeroFacturaVenta } from '@/formato/facturacion'
import { fechaDemo } from '@/mocks/http'
import * as a from '@/modulos/facturacion/api'
import {
  accionesFactura,
  agruparNotasDebito,
  calcularLinea,
  conItem,
  type ContextoFactura,
  documentoDeFactura,
  erroresFactura,
  esSimulado,
  exigeQuienRecibe,
  facturaVacia,
  lineaVacia,
  notasDe,
  pasoHabilitacion,
  pasosRadian,
  peticionFactura,
  requiereAtencion,
  totalesFactura,
} from '@/modulos/facturacion/reglas'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

const vid = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const PH = vid(1)
const DAD = vid(3)
const ANDINA = vid(4)

const ITEM: ItemFacturacion = {
  id: 'cafe', codigo: 'CAF', descripcion: 'Café', unidad: '94', precio: '28000.00', tarifa_iva: '19', clasificacion: 'venta', cuenta_id: 'c4135', activo: true, actualizado_en: '',
}

function factura(extra: Partial<FacturaVenta> = {}): FacturaVenta {
  return {
    id: 'f1', persona_id: 'p', numero: 7, fecha: '2026-11-01', vencimiento: '2026-12-01', descripcion: 'x', subtotal: '100', iva: '19', total: '119',
    pagado: '0', estado: 'emitida', creada_en: '', lineas: [], ...extra,
  }
}

function doc(extra: Partial<DocumentoElectronico> = {}): DocumentoElectronico {
  return {
    id: 'd1', tipo: 'factura', origen_tipo: 'ventas.factura', origen_id: 'f1', prefijo: 'SETP', numero: 1, estado: 'validado', proveedor: 'propio',
    intentos: 1, total: '119', creado_en: '', ...extra,
  }
}

const ctx = (extra: Partial<ContextoFactura> = {}): ContextoFactura => ({ gestionar: true, emitir: true, electronica: true, contabilidad: false, hoy: '2026-11-19', ...extra })

describe('números de facturación', () => {
  it('la factura lleva FV y su número; sin número es borrador', () => {
    expect(numeroFacturaVenta({ numero: 120 })).toBe('FV-120')
    expect(numeroFacturaVenta({ numero: null })).toBe('Borrador')
    expect(numeroDocumento({ prefijo: 'NC26', numero: 3 })).toBe('NC263')
    expect(numeroDocumento({ prefijo: 'SETP', numero: null })).toBe('SETP (sin número)')
  })
})

describe('líneas y totales', () => {
  it('solo una venta o un alquiler/servicio suma IVA; redondea a centavos', () => {
    expect(calcularLinea({ cantidad: '3', valor_unitario: '1000.005', tarifa_iva: '19', clasificacion: 'venta' })).toEqual({ subtotal: '3000.02', iva: '570.00' })
    expect(calcularLinea({ cantidad: '1', valor_unitario: '500000', tarifa_iva: '19', clasificacion: 'expensa' })).toEqual({ subtotal: '500000.00', iva: '0.00' })
    expect(calcularLinea({ cantidad: 'x', valor_unitario: '', tarifa_iva: '', clasificacion: 'venta' })).toEqual({ subtotal: '0.00', iva: '0.00' })
    const lineas = [
      { ...lineaVacia(), cantidad: '2', valor_unitario: '100', tarifa_iva: '19' },
      { ...lineaVacia('cuota_extraordinaria'), cantidad: '1', valor_unitario: '50', tarifa_iva: '19' },
    ]
    expect(totalesFactura(lineas)).toEqual({ subtotal: '250', iva: '38', total: '288' })
  })

  it('el producto llena la línea y conserva la cantidad; con cuenta, toma su código', () => {
    const l = conItem({ ...lineaVacia(), cantidad: '4' }, ITEM, (id) => (id === 'c4135' ? '413595' : undefined))
    expect(l).toMatchObject({ item_id: 'cafe', descripcion: 'Café', valor_unitario: '28000.00', tarifa_iva: '19', cantidad: '4', cuenta: '413595' })
    expect(conItem(lineaVacia(), { ...ITEM, clasificacion: 'expensa', precio: null }, () => undefined)).toMatchObject({ tarifa_iva: '0', valor_unitario: '', cuenta: '' })
  })

  it('explica qué falta antes de guardar', () => {
    const f = facturaVacia('2026-11-19', '2026-11-01')
    f.lineas = [{ ...lineaVacia('expensa'), cantidad: '0', tarifa_iva: '19' }]
    expect(erroresFactura(f)).toEqual([
      'Elija el cliente.',
      'Escriba la descripción de la factura.',
      'El vencimiento no puede ser anterior a la fecha.',
      'La línea 1 necesita un producto o una descripción.',
      'La cantidad de la línea 1 debe ser mayor que cero.',
      'Escriba el valor unitario de la línea 1.',
      'La línea 1 no admite IVA por su clasificación.',
    ])
    expect(erroresFactura({ ...facturaVacia('2026-11-19', '2026-12-19'), lineas: [] })).toContain('Agregue al menos una línea.')
    const lista = { ...facturaVacia('2026-11-19', '2026-12-19'), cliente: { id: 'p', nombre: 'P' }, descripcion: 'Café', lineas: [{ ...lineaVacia(), item_id: 'cafe' }] }
    expect(erroresFactura(lista)).toEqual([])
  })

  it('sin contabilidad no envía cuentas ni centros; con contabilidad sí', () => {
    const f = { ...facturaVacia('2026-11-19', '2026-12-19'), cliente: { id: 'p', nombre: 'P' }, descripcion: ' Café ', lineas: [{ ...lineaVacia('expensa'), descripcion: 'Cuota', valor_unitario: '10', tarifa_iva: '19', cuenta: '4170', centro: 'ADM' }] }
    const sin = peticionFactura(f, false)
    expect(sin).toMatchObject({ persona_id: 'p', descripcion: 'Café' })
    expect(sin.lineas[0]).toEqual({ item_id: null, descripcion: 'Cuota', cantidad: '1', valor_unitario: '10', tarifa_iva: '0', clasificacion: 'expensa' })
    expect(peticionFactura(f, true).lineas[0]).toMatchObject({ cuenta: '4170', centro_costo: 'ADM' })
  })
})

describe('botones de la factura', () => {
  it('un borrador se emite o se borra; una anulada no ofrece nada', () => {
    expect(accionesFactura(factura({ estado: 'borrador' }), null, ctx())).toEqual(['emitir', 'borrar'])
    expect(accionesFactura(factura({ estado: 'borrador' }), null, ctx({ gestionar: false }))).toEqual([])
    expect(accionesFactura(factura({ estado: 'anulada' }), doc(), ctx())).toEqual([])
  })

  it('sin contabilidad se paga a mano; con contabilidad, por recibo de caja', () => {
    expect(accionesFactura(factura(), null, ctx({ electronica: false }))).toEqual(['pagar', 'anular'])
    expect(accionesFactura(factura(), null, ctx({ electronica: false, contabilidad: true }))).toEqual(['anular'])
    expect(accionesFactura(factura({ pagado: '50', estado: 'pagada_parcial' }), null, ctx({ electronica: false }))).toEqual(['pagar'])
  })

  it('sin documento se envía o se transcribe de contingencia; por enviar o en contingencia se reintenta', () => {
    expect(accionesFactura(factura(), null, ctx())).toEqual(['pagar', 'anular', 'factura_electronica', 'contingencia'])
    expect(accionesFactura(factura(), doc({ estado: 'contingencia' }), ctx())).toContain('reintentar')
    expect(accionesFactura(factura(), doc({ estado: 'enviado' }), ctx())).toEqual(['pagar'])
    expect(accionesFactura(factura(), null, ctx({ emitir: false }))).toEqual(['pagar', 'anular'])
  })

  it('con factura electrónica validada no se anula: nota crédito, nota débito y aceptación tácita', () => {
    expect(accionesFactura(factura(), doc(), ctx())).toEqual(['pagar', 'nota_credito', 'nota_debito', 'aceptacion_tacita'])
    // Una nota débito no lleva otra nota débito; de contado no hay aceptación tácita.
    expect(accionesFactura(factura({ nota_debito_de: 'f0', vencimiento: '2026-11-01' }), doc(), ctx())).toEqual(['pagar', 'nota_credito'])
  })
})

describe('documentos', () => {
  it('encuentra el documento de la factura, sus notas y lo que requiere atención', () => {
    const docs = [doc({ id: 'nc', tipo: 'nota_credito', referencia_id: 'd1' }), doc(), doc({ id: 'otro', origen_id: 'f2' })]
    expect(documentoDeFactura(docs, 'f1')?.id).toBe('d1')
    expect(documentoDeFactura(docs, 'nada')).toBeNull()
    expect(notasDe(docs, 'd1').map((d) => d.id)).toEqual(['nc'])
    expect(notasDe(docs, null)).toEqual([])
    expect(requiereAtencion(doc({ estado: 'rechazado' }))).toBe(true)
    expect(requiereAtencion(doc({ estado: 'contingencia' }))).toBe(true)
    expect(requiereAtencion(doc())).toBe(false)
    expect(esSimulado([doc(), doc({ proveedor: 'simulado' })])).toBe(true)
    expect(esSimulado([doc()])).toBe(false)
  })

  it('las notas débito van debajo de su factura', () => {
    const lista = [factura({ id: 'nd', nota_debito_de: 'f1' }), factura({ id: 'f2' }), factura({ id: 'f1' }), factura({ id: 'huerfana', nota_debito_de: 'fuera' })]
    expect(agruparNotasDebito(lista).map((f) => [f.id, f.esNota])).toEqual([
      ['f2', false],
      ['f1', false],
      ['nd', true],
      ['huerfana', true],
    ])
  })
})

describe('RADIAN', () => {
  it('cada paso se habilita cuando el previo existe; la decisión es una sola', () => {
    const disponibles = (ev: { tipo: 'acuse' | 'recibo_bien' | 'aceptacion' | 'reclamo'; estado: string }[]) =>
      pasosRadian(ev).filter((p) => p.disponible).map((p) => p.paso)
    expect(disponibles([])).toEqual(['acuse'])
    expect(disponibles([{ tipo: 'acuse', estado: 'enviado' }])).toEqual(['recibo_bien'])
    expect(disponibles([{ tipo: 'acuse', estado: 'enviado' }, { tipo: 'recibo_bien', estado: 'enviado' }])).toEqual(['decision'])
    expect(disponibles([{ tipo: 'acuse', estado: 'enviado' }, { tipo: 'recibo_bien', estado: 'enviado' }, { tipo: 'reclamo', estado: 'enviado' }])).toEqual([])
    // Un evento rechazado por la DIAN no cuenta: se vuelve a registrar.
    expect(disponibles([{ tipo: 'acuse', estado: 'rechazado' }])).toEqual(['acuse'])
    expect(exigeQuienRecibe('acuse')).toBe(true)
    expect(exigeQuienRecibe('reclamo')).toBe(false)
  })
})

describe('habilitación', () => {
  const h = (extra: Partial<Habilitacion>): Habilitacion => ({ envios: [], ...extra })
  const cert = { id: 'c', sujeto: '', emisor: '', serial: '', vigente_desde: '', vigente_hasta: '', por_vencer: false }
  const envio = { id: 'e', tipo: 'factura' as const, numero: '1', codigo: 'x', estado: 'enviado' as const, enviado_en: '' }

  it('el paso sale del estado que devuelve el backend', () => {
    expect(pasoHabilitacion(h({}))).toBe('software')
    expect(pasoHabilitacion(h({ software_id: 's', estado: 'registrado' }))).toBe('certificado')
    expect(pasoHabilitacion(h({ software_id: 's', estado: 'registrado', certificado: { ...cert, por_vencer: true } }))).toBe('certificado')
    expect(pasoHabilitacion(h({ software_id: 's', estado: 'registrado', certificado: cert }))).toBe('set')
    expect(pasoHabilitacion(h({ software_id: 's', estado: 'en_pruebas', certificado: cert, envios: [envio] }))).toBe('consulta')
    expect(pasoHabilitacion(h({ software_id: 's', estado: 'habilitado', certificado: cert }))).toBe('produccion')
    expect(pasoHabilitacion(h({ software_id: 's', estado: 'produccion' }))).toBe('rangos')
  })
})

describe('facturación contra el demo', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('admin', 'x')
  })

  it('catálogo: crea sin repetir el código, valida el IVA y edita', async () => {
    expect((await a.items(ANDINA)).map((i) => i.codigo)).toEqual(['CAF-500', 'INST'])
    expect(await a.items(ANDINA, true)).toHaveLength(3)
    const nuevo = await a.crearItem(ANDINA, { codigo: 'MOL', descripcion: 'Molino', clasificacion: 'venta', tarifa_iva: '19', precio: '90000' }, 'i1')
    expect(nuevo).toMatchObject({ codigo: 'MOL', unidad: '94', activo: true })
    await expect(a.crearItem(ANDINA, { codigo: 'mol', descripcion: 'Otro', clasificacion: 'venta' }, 'i2')).rejects.toMatchObject({ estado: 409 })
    await expect(a.crearItem(ANDINA, { codigo: 'EXP', descripcion: 'Cuota', clasificacion: 'expensa', tarifa_iva: '19' }, 'i3')).rejects.toMatchObject({ estado: 422 })
    await expect(a.crearItem(ANDINA, { codigo: 'CTA', descripcion: 'Con cuenta', clasificacion: 'otra', cuenta: '4135' }, 'i4')).rejects.toMatchObject({ estado: 422 })
    expect((await a.guardarItem(ANDINA, nuevo.id, { descripcion: 'Molino eléctrico', clasificacion: 'venta', activo: false })).activo).toBe(false)
  })

  it('borrador → emitida → factura electrónica (mismo documento al repetir) → nota crédito', async () => {
    const [cafe] = await a.items(ANDINA)
    const f = await a.crearFactura(ANDINA, { persona_id: vid(5002), fecha: fechaDemo(), vencimiento: fechaDemo(30), descripcion: 'Café', lineas: [{ item_id: cafe!.id, cantidad: '2' }] }, 'f1')
    expect(f).toMatchObject({ estado: 'borrador', numero: null, subtotal: '56000.00', iva: '10640.00', total: '66640.00' })
    await expect(a.facturaElectronica(ANDINA, f.id)).rejects.toMatchObject({ estado: 409 })
    const emitida = await a.emitirFactura(ANDINA, f.id)
    expect(emitida).toMatchObject({ estado: 'emitida', numero: 7 })
    await expect(a.emitirFactura(ANDINA, f.id)).rejects.toMatchObject({ estado: 409 })
    const d = await a.facturaElectronica(ANDINA, f.id)
    expect(d).toMatchObject({ tipo: 'factura', estado: 'validado', proveedor: 'simulado' })
    expect((await a.facturaElectronica(ANDINA, f.id)).id).toBe(d.id)
    await expect(a.anularFactura(ANDINA, f.id, 'Error')).rejects.toMatchObject({ estado: 409 })
    const nc = await a.notaCredito(ANDINA, f.id, 'Error en el valor')
    expect(nc).toMatchObject({ tipo: 'nota_credito', prefijo: 'NC26', referencia_id: d.id })
    expect((await a.factura(ANDINA, f.id)).estado).toBe('anulada')
  })

  it('sin contabilidad: no acepta cuentas, se paga a mano y se anula sin pagos', async () => {
    const lineas = [{ descripcion: 'Asesoría', cantidad: '1', valor_unitario: '1000', cuenta: '4135' }]
    await expect(a.crearFactura(ANDINA, { persona_id: vid(5002), fecha: fechaDemo(), vencimiento: fechaDemo(30), descripcion: 'x', lineas }, 'f2')).rejects.toMatchObject({ estado: 422 })
    const f = await a.emitirFactura(ANDINA, vid(74001))
    expect((await a.pagarFactura(ANDINA, f.id, { fecha: fechaDemo(), medio: 'efectivo' })).estado).toBe('pagada')
    expect((await a.anularFactura(ANDINA, vid(74003), 'El cliente canceló')).estado).toBe('anulada')
    // Con contabilidad el pago va por la tesorería.
    await expect(a.pagarFactura(PH, vid(32001), { fecha: fechaDemo(), medio: 'efectivo' })).rejects.toMatchObject({ estado: 409 })
  })

  it('contingencia, reintento, nota débito y aceptación tácita', async () => {
    await expect(a.transcribirContingencia(ANDINA, vid(74002), 10)).rejects.toMatchObject({ estado: 409 })
    const borrador = await a.crearFactura(ANDINA, { persona_id: vid(5003), fecha: fechaDemo(), vencimiento: fechaDemo(15), descripcion: 'Papel', lineas: [{ descripcion: 'Café', cantidad: '1', valor_unitario: '5000', clasificacion: 'venta' }] }, 'f3')
    await a.emitirFactura(ANDINA, borrador.id)
    await expect(a.transcribirContingencia(ANDINA, borrador.id, 999)).rejects.toMatchObject({ estado: 422 })
    expect((await a.transcribirContingencia(ANDINA, borrador.id, 12)).estado).toBe('validado')

    const [contingencia] = await a.documentos(ANDINA, { estado: 'contingencia' })
    expect((await a.reintentarDocumento(ANDINA, contingencia!.id)).estado).toBe('validado')
    await expect(a.reintentarDocumento(ANDINA, contingencia!.id)).rejects.toMatchObject({ estado: 409 })

    const nd = await a.notaDebito(ANDINA, vid(74002), { concepto: 'gastos_por_cobrar', motivo: 'Gastos de envío', fecha: fechaDemo(), vencimiento: fechaDemo(30), lineas: [{ descripcion: 'Envío', cantidad: '1', valor_unitario: '8000', clasificacion: 'otra' }] })
    expect(nd).toMatchObject({ tipo: 'nota_debito', prefijo: 'ND26' })
    expect((await a.facturas(ANDINA)).filter((f) => f.nota_debito_de === vid(74002))).toHaveLength(2)
    await expect(a.notaDebito(ANDINA, vid(74004), { concepto: 'otro', motivo: 'Corrección', fecha: fechaDemo(), vencimiento: fechaDemo(), lineas: [] })).rejects.toMatchObject({ estado: 409 })

    const fe = documentoDeFactura(await a.documentos(ANDINA), vid(74002))!
    expect((await a.aceptacionTacita(ANDINA, fe.id)).tipo).toBe('aceptacion_tacita')
    await expect(a.aceptacionTacita(ANDINA, fe.id)).rejects.toMatchObject({ estado: 409 })
    expect(await a.eventosDocumento(ANDINA, fe.id)).toHaveLength(1)
    expect((await a.documento(ANDINA, fe.id)).eventos.map((e) => e.tipo)).toContain('validado')
    const pdf = await a.pdfDocumento(ANDINA, fe.id)
    expect(pdf.nombre).toBe('SETP990000001.pdf')
    expect(pdf.blob.size).toBeGreaterThan(0)
  }, 20_000)

  it('la factura electrónica exige el módulo', async () => {
    await expect(a.facturaElectronica(PH, vid(32001))).rejects.toMatchObject({ estado: 403, codigo: 'modulo_no_habilitado' })
  })

  it('compras: documento soporte y nota de ajuste', async () => {
    await expect(a.registrarCompra(ANDINA, { persona_id: vid(5502), numero: '1', fecha: fechaDemo(), vencimiento: fechaDemo(), descripcion: 'x', lineas: [{ descripcion: 'x', base: '10', iva: '0', cuenta: '5135' }] }, 'c0')).rejects.toMatchObject({ estado: 422 })
    const c = await a.registrarCompra(ANDINA, { persona_id: vid(5502), numero: '88', fecha: fechaDemo(), vencimiento: fechaDemo(30), descripcion: 'Arreglo', lineas: [{ descripcion: 'Arreglo', base: '100000', iva: '0' }] }, 'c1')
    expect(c.neto_pagar).toBe('100000.00')
    const ds = await a.documentoSoporte(ANDINA, c.id)
    expect(ds).toMatchObject({ tipo: 'documento_soporte', estado: 'validado' })
    expect((await a.documentoSoporte(ANDINA, c.id)).id).toBe(ds.id)
    expect((await a.notaAjuste(ANDINA, c.id, 'Compra duplicada')).tipo).toBe('nota_ajuste_ds')
    await expect(a.notaAjuste(ANDINA, c.id, 'Otra vez')).rejects.toMatchObject({ estado: 409 })
  })

  it('recibidas: carga sin repetir, registra eventos en orden, vincula y rechaza', async () => {
    const xml = '<Invoice><cbc:UUID>abc123</cbc:UUID><cbc:ID>FV77</cbc:ID><cbc:CompanyID>900111222</cbc:CompanyID></Invoice>'
    const r = await a.cargarRecibida(ANDINA, 'fv77.xml', btoa(xml))
    expect(r).toMatchObject({ estado: 'pendiente', emisor_nombre: 'Vigilancia Andina S.A.S.', persona_id: vid(5501), numero: 'FV77' })
    await expect(a.cargarRecibida(ANDINA, 'fv77.xml', btoa(xml))).rejects.toMatchObject({ estado: 409 })
    await expect(a.cargarRecibida(ANDINA, 'nada.xml', btoa('texto'))).rejects.toMatchObject({ estado: 422 })

    const quien = { tipo_documento: 'CC' as const, documento: '1010', nombres: 'Ana', apellidos: 'Ruiz' }
    await expect(a.eventoRadian(ANDINA, r.id, { tipo: 'recibo_bien', quien_recibe: quien })).rejects.toMatchObject({ estado: 422 })
    await expect(a.eventoRadian(ANDINA, r.id, { tipo: 'acuse' })).rejects.toMatchObject({ estado: 422 })
    expect((await a.eventoRadian(ANDINA, r.id, { tipo: 'acuse', quien_recibe: quien })).estado).toBe('enviado')
    await expect(a.eventoRadian(ANDINA, r.id, { tipo: 'acuse', quien_recibe: quien })).rejects.toMatchObject({ estado: 409 })
    await a.eventoRadian(ANDINA, r.id, { tipo: 'recibo_bien', quien_recibe: quien })
    await expect(a.eventoRadian(ANDINA, r.id, { tipo: 'reclamo' })).rejects.toMatchObject({ estado: 422 })
    await a.eventoRadian(ANDINA, r.id, { tipo: 'reclamo', concepto_reclamo: 'servicio_no_prestado', motivo: 'No vinieron' })
    await expect(a.eventoRadian(ANDINA, r.id, { tipo: 'aceptacion' })).rejects.toMatchObject({ estado: 409 })
    expect((await a.recibida(ANDINA, r.id)).eventos.map((e) => e.tipo)).toEqual(['acuse', 'recibo_bien', 'reclamo'])

    const compra = await a.registrarCompra(ANDINA, { persona_id: vid(5501), numero: 'FV77', fecha: fechaDemo(), vencimiento: fechaDemo(30), descripcion: 'Vigilancia', cufe: 'abc123', lineas: [{ descripcion: 'x', base: '100000', iva: '19000' }] }, 'c2')
    expect((await a.vincularRecibida(ANDINA, r.id, compra.id)).estado).toBe('registrada')
    await expect(a.rechazarRecibida(ANDINA, r.id, 'No era')).rejects.toMatchObject({ estado: 409 })
    expect((await a.rechazarRecibida(ANDINA, vid(77001), 'No corresponde')).estado).toBe('rechazada')
    expect(await a.recibidas(ANDINA, 'rechazada')).toHaveLength(1)
  }, 20_000)

  it('libros con huella, contabilización y su exigencia del módulo', async () => {
    const p = { desde: fechaDemo(-60), hasta: fechaDemo() }
    expect(await a.contabilizar(DAD, p)).toEqual({ contabilizadas: [], pagadas_a_mano: [], fallidas: [] })
    const informe = await a.contabilizar(PH, { desde: fechaDemo(-60), hasta: fechaDemo() })
    expect(informe.contabilizadas).toHaveLength(2)
    await expect(a.contabilizar(ANDINA, p)).rejects.toMatchObject({ estado: 403 })
  })

  it('habilitación: software, certificado, set, consulta, producción y rangos', async () => {
    expect(await a.habilitacion(ANDINA)).toEqual({ envios: [] })
    await expect(a.registrarSoftware(ANDINA, { software_id: 'no-uuid', pin: '12345' })).rejects.toMatchObject({ estado: 422 })
    const sw = await a.registrarSoftware(ANDINA, { software_id: vid(1), pin: '12345', test_set_id: vid(2) })
    expect(sw).toMatchObject({ estado: 'registrado', software_id: vid(1) })
    expect(JSON.stringify(sw)).not.toContain('12345')
    await expect(a.enviarSetPruebas(ANDINA, { cantidad: 2 })).rejects.toMatchObject({ estado: 409 })
    await expect(a.cargarCertificado(ANDINA, btoa('p12'), 'mala')).rejects.toMatchObject({ estado: 422 })
    expect((await a.cargarCertificado(ANDINA, btoa('p12'), 'secreta')).por_vencer).toBe(false)
    await expect(a.pasarAProduccion(ANDINA)).rejects.toMatchObject({ estado: 409 })
    expect(await a.enviarSetPruebas(ANDINA, { cantidad: 2, notas_credito: 1 })).toHaveLength(3)
    expect((await a.consultarSetPruebas(ANDINA)).estado).toBe('habilitado')
    await expect(a.sincronizarRangos(ANDINA)).rejects.toMatchObject({ estado: 409 })
    expect((await a.pasarAProduccion(ANDINA)).estado).toBe('produccion')
    expect((await a.sincronizarRangos(ANDINA))[0]).toMatchObject({ prefijo: 'FEAN' })
  }, 15_000)
})
