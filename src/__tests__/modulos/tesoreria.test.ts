import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ConceptoRetencion } from '@/api/tipos'
import { limpiar } from '@/api/tokens'
import { multiplicar } from '@/formato/decimales'
import { cuentaDemoId } from '@/mocks/cuenta'
import { fechaDemo } from '@/mocks/http'
import * as a from '@/modulos/tesoreria/api'
import {
  accionesEgreso,
  accionesFactura,
  calcularRetenciones,
  claveLinea,
  encabezadosCsv,
  porPagar,
  registradoPorMi,
  totalEgreso,
  totalesFactura,
  totalSeleccion,
} from '@/modulos/tesoreria/reglas'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { useTercerosConocidos } from '@/stores/terceros'
import { prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const vid = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const BANCO = vid(30001)
const YO = cuentaDemoId('uno')
const OTRA = cuentaDemoId('revisor')

const CONCEPTOS = [
  { codigo: 'servicios', impuesto: 'renta', base_minima_uvt: '4', tarifa: '4' },
  { codigo: 'reteiva', impuesto: 'iva', base_minima_uvt: '4', tarifa: '15' },
] as ConceptoRetencion[]

describe('reglas de la tesorería', () => {
  const q = { registrar: true, autorizar: true }
  it('cuatro ojos: quien registró el egreso no lo autoriza', () => {
    expect(accionesEgreso({ estado: 'por_autorizar', registrado_por: OTRA }, q, YO)).toEqual(['autorizar', 'anular'])
    expect(accionesEgreso({ estado: 'por_autorizar', registrado_por: YO }, q, YO)).toEqual(['anular'])
    expect(accionesEgreso({ estado: 'por_autorizar', registrado_por: OTRA }, q, null)).toEqual(['anular'])
    expect(accionesEgreso({ estado: 'autorizado', registrado_por: OTRA }, q, YO)).toEqual(['pagar', 'anular'])
    expect(accionesEgreso({ estado: 'autorizado', registrado_por: OTRA }, { registrar: false, autorizar: true }, YO)).toEqual([])
    expect(accionesEgreso({ estado: 'pagado', registrado_por: OTRA }, q, YO)).toEqual([])
    expect(registradoPorMi({ registrado_por: YO }, YO)).toBe(true)
    expect(registradoPorMi({ registrado_por: YO }, null)).toBe(false)
  })

  it('totales del egreso y estados de las facturas', () => {
    expect(totalEgreso([{ valor: '1000.10' }], [{ valor: '0.20' }, { valor: '' }])).toBe('1000.3')
    expect(accionesFactura('registrada', true)).toEqual(['causar', 'anular'])
    expect(accionesFactura('causada', true)).toEqual(['anular'])
    expect(accionesFactura('pagada', true)).toEqual([])
    expect(accionesFactura('registrada', false)).toEqual([])
    expect(porPagar({ neto_pagar: '1000', pagado: '250.5' })).toBe('749.5')
  })

  it('retenciones sugeridas con la base mínima en UVT', () => {
    expect(multiplicar('4', '52374')).toBe('209496')
    const r = calcularRetenciones({ base: '1000000', iva: '190000', retenciones: ['servicios', 'reteiva', 'no-existe'] }, CONCEPTOS, '52374')
    expect(r).toEqual([
      { codigo: 'servicios', impuesto: 'renta', base: '1000000', tarifa: '4', valor: '40000.00', bajoMinimo: false },
      { codigo: 'reteiva', impuesto: 'iva', base: '190000', tarifa: '15', valor: '28500.00', bajoMinimo: false },
    ])
    expect(calcularRetenciones({ base: '100000', iva: '0', retenciones: ['servicios'] }, CONCEPTOS, '52374')[0]).toMatchObject({ bajoMinimo: true, valor: '0' })
    expect(totalesFactura([{ base: '1000000', iva: '190000', retenciones: ['servicios'] }, { base: '', iva: '', retenciones: [] }], CONCEPTOS, '52374')).toEqual({
      subtotal: '1000000', iva: '190000', retenciones: '40000', neto: '1150000',
    })
  })

  it('conciliación: totales de lo marcado y encabezados del CSV', () => {
    expect(totalSeleccion([{ valor: '100.50' }, { valor: '-0.50' }], [{ valor: '100' }])).toEqual({ extracto: '100', libros: '100', diferencia: '0', cuadra: true })
    expect(totalSeleccion([{ valor: '10' }], []).cuadra).toBe(false)
    expect(totalSeleccion([{ valor: '10' }], [{ valor: '9' }])).toMatchObject({ diferencia: '1', cuadra: false })
    expect(claveLinea({ comprobante_id: 'c', orden: 2 })).toBe('c#2')
    expect(encabezadosCsv('"Fecha";Descripción;Valor\n01/11/2026;x;1')).toEqual(['Fecha', 'Descripción', 'Valor'])
    expect(encabezadosCsv('Banco\nFecha,Detalle,Débito,Crédito', 2)).toEqual(['Fecha', 'Detalle', 'Débito', 'Crédito'])
    expect(encabezadosCsv('')).toEqual([])
  })

  it('recuerda los nombres de los terceros vistos', () => {
    setActivePinia(createPinia())
    const t = useTercerosConocidos()
    t.recordar([{ id: 'p1', nombre: 'Ana' }, { id: 'p2', nombre: '' }])
    expect(t.nombre('p1')).toBe('Ana')
    expect(t.nombre('p2')).toBe('Tercero')
    expect(t.nombre(null)).toBe('—')
  })
})

describe('tesorería contra el demo', { timeout: 25_000 }, () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('uno', 'x')
    await useEntidad().entrar(PH)
  })

  it('cuentas de tesorería: crear con los cuatro últimos dígitos y editar', async () => {
    expect(await a.cuentasTesoreria(PH)).toHaveLength(3)
    await expect(a.crearCuentaTesoreria(PH, { tipo: 'banco', nombre: 'Sin banco', cuenta_contable: '11100502' }, 'c0')).rejects.toMatchObject({ estado: 422 })
    const c = await a.crearCuentaTesoreria(PH, { tipo: 'banco', nombre: 'Davivienda', banco: 'Davivienda', numero_cuenta: '0012345678', cuenta_contable: '11100502' }, 'c1')
    expect(c.numero_enmascarado).toBe('****5678')
    expect((await a.editarCuentaTesoreria(PH, c.id, { nombre: 'Davivienda nómina', activa: false })).activa).toBe(false)
  })

  it('recibos: aplicaciones, por identificar y anulación', async () => {
    const [fv] = await a.facturasVenta(PH, vid(5002))
    await expect(a.crearRecibo(PH, { cuenta_tesoreria_id: BANCO, fecha: fechaDemo(), valor: '100', medio: 'efectivo', descripcion: 'x', aplicaciones: [{ factura_venta_id: fv!.id, valor: '200' }] }, 'r0')).rejects.toMatchObject({ estado: 422 })
    const r = await a.crearRecibo(PH, { cuenta_tesoreria_id: BANCO, persona_id: vid(5002), fecha: fechaDemo(), valor: '350000', medio: 'transferencia', descripcion: 'Saldo del alquiler', aplicaciones: [{ factura_venta_id: fv!.id, valor: '300000' }] }, 'r1')
    expect(r).toMatchObject({ sin_aplicar: '50000.00', estado: 'registrado' })
    const fv2 = (await a.facturasVenta(PH, vid(5002)))[1]!
    expect((await a.aplicarRecibo(PH, r.id, fv2.id, '50000')).sin_aplicar).toBe('0.00')
    await expect(a.aplicarRecibo(PH, r.id, fv2.id, '1')).rejects.toMatchObject({ estado: 422 })
    expect((await a.recibos(PH, { sin_identificar: true })).every((x) => !x.persona_id)).toBe(true)
    await expect(a.anularRecibo(PH, r.id, '')).rejects.toMatchObject({ estado: 422 })
    expect((await a.anularRecibo(PH, r.id, 'Consignación duplicada')).estado).toBe('anulado')
    await expect(a.anularRecibo(PH, r.id, 'otra vez')).rejects.toMatchObject({ estado: 409 })
  })

  it('recibos y egresos se descargan en PDF', async () => {
    const [recibo] = await a.recibos(PH)
    const [egreso] = await a.egresos(PH)
    expect((await a.reciboPdf(PH, recibo!.id)).nombre).toBe('recibo-caja.pdf')
    expect((await a.egresoPdf(PH, egreso!.id)).nombre).toBe('egreso.pdf')
  })

  it('cuentas por pagar por edades: lo que se debe a cada proveedor', async () => {
    const [fila] = await a.porPagarPorEdades(PH, fechaDemo())
    expect(fila).toMatchObject({ persona_id: vid(5501), total: '4830000.00' })
    expect(fila!.tramos.map((t) => t.tramo)).toEqual(['corriente'])
  })

  it('egresos: cuatro ojos, pago y anulación', async () => {
    const lista = await a.egresos(PH)
    const mio = lista.find((x) => x.registrado_por === YO)!
    const ajeno = lista.find((x) => x.estado === 'por_autorizar' && x.registrado_por !== YO)!
    await expect(a.autorizarEgreso(PH, mio.id)).rejects.toMatchObject({ estado: 409, codigo: 'conflicto' })
    await expect(a.pagarEgreso(PH, ajeno.id)).rejects.toMatchObject({ codigo: 'conflicto_estado' })
    expect((await a.autorizarEgreso(PH, ajeno.id)).estado).toBe('autorizado')
    expect((await a.pagarEgreso(PH, ajeno.id)).estado).toBe('pagado')
    await expect(a.anularEgreso(PH, ajeno.id, 'tarde')).rejects.toMatchObject({ codigo: 'conflicto_estado' })
    await expect(a.crearEgreso(PH, { cuenta_tesoreria_id: BANCO, persona_id: vid(5501), fecha: fechaDemo(), medio: 'cheque', descripcion: 'x', gastos: [{ cuenta: '530505', valor: '10', descripcion: 'y' }] }, 'e0')).rejects.toMatchObject({ estado: 422 })
    const nuevo = await a.crearEgreso(PH, { cuenta_tesoreria_id: BANCO, persona_id: vid(5501), fecha: fechaDemo(), medio: 'transferencia', descripcion: 'Gastos bancarios', gastos: [{ cuenta: '530505', valor: '15000', descripcion: 'Comisión' }] }, 'e1')
    expect(nuevo).toMatchObject({ estado: 'por_autorizar', registrado_por: YO, valor: '15000.00' })
    expect((await a.anularEgreso(PH, nuevo.id, 'Se registró en otra cuenta')).estado).toBe('anulado')
  })

  it('facturas de proveedor: retenciones, número repetido, causar y certificado', async () => {
    const datos = {
      persona_id: vid(5502), prefijo: 'AT', numero: '600', fecha: fechaDemo(), vencimiento: fechaDemo(30), descripcion: 'Aseo de noviembre',
      lineas: [{ descripcion: 'Aseo', cuenta: '513505', base: '2000000', iva: '380000', retenciones: ['servicios_generales', 'reteiva'] }],
    }
    const f = await a.crearFacturaProveedor(PH, datos, 'f1')
    expect(f).toMatchObject({ estado: 'registrada', retenciones: '137000.00', neto_pagar: '2243000.00' })
    await expect(a.crearFacturaProveedor(PH, datos, 'f2')).rejects.toMatchObject({ estado: 409, codigo: 'conflicto' })
    expect((await a.crearFacturaProveedor(PH, { ...datos, excepcion_duplicado: 'El proveedor reinició la numeración' }, 'f3')).excepcion_duplicado).toBeTruthy()
    await expect(a.crearFacturaProveedor(PH, { ...datos, numero: '601', lineas: [{ ...datos.lineas[0]!, retenciones: ['inventada'] }] }, 'f4')).rejects.toMatchObject({ estado: 422 })
    expect((await a.causarFactura(PH, f.id)).estado).toBe('causada')
    await expect(a.causarFactura(PH, f.id)).rejects.toMatchObject({ codigo: 'conflicto_estado' })
    expect((await a.anularFactura(PH, f.id, 'Se facturó mal')).estado).toBe('anulada')
    const cert = await a.certificado(PH, vid(5501), { desde: '2026-01-01', hasta: '2026-12-31' })
    expect(cert.tercero).toBe('Vigilancia Andina S.A.S.')
    expect(Number(cert.total_retenido)).toBeGreaterThan(0)
    expect((await a.enviarCertificado(PH, vid(5501), { desde: '2026-01-01', hasta: '2026-12-31' })).para).toContain('@')
    expect((await a.retenciones(PH)).map((c) => c.impuesto)).toContain('ica')
    expect((await a.uvt(PH))[0]?.valor).toBe('52374')
    expect((await a.carteraPorEdades(PH, fechaDemo())).find((x) => x.nombre === 'Lucía Gómez')?.total).toBe('1250000.00')
  })

  it('extracto: mapeo, vista previa, importar y conciliar', async () => {
    const mapeo = await a.mapeoGuardado(PH, BANCO)
    expect(mapeo?.fecha).toBe('Fecha')
    const d = (n: number) => fechaDemo(n).split('-').reverse().join('/')
    const csv = `Fecha;Descripción;Referencia;Valor\n${d(-20)};Transferencia recibida;TRF-88213;200.000,00\n${d(-2)};Cheque 0045;CH-45;-640.000,00\n${d(-1)};Consignación sin identificar;;75.000,00\n`
    const archivo = { nombre_archivo: 'extracto.csv', archivo_base64: btoa(unescape(encodeURIComponent(csv))), formato: 'planilla' as const, mapeo, saldo_final: '57345000' }
    const malo = await a.vistaPreviaExtracto(PH, BANCO, { ...archivo, archivo_base64: btoa('Fecha;Descripción;Referencia;Valor\n2026-13-45;x;;abc\n') })
    expect(malo.errores).toHaveLength(1)
    const previa = await a.vistaPreviaExtracto(PH, BANCO, archivo)
    expect(previa).toMatchObject({ errores: [], movimientos: [{ valor: '200000.00' }, { valor: '-640000.00' }, { valor: '75000.00' }] })
    const ext = await a.importarExtracto(PH, BANCO, archivo)
    expect(ext.movimientos).toBe(3)
    await expect(a.importarExtracto(PH, BANCO, archivo)).rejects.toMatchObject({ estado: 409 })

    const rango = { desde: fechaDemo(-40), hasta: fechaDemo() }
    const auto = await a.conciliarAutomatico(PH, BANCO, rango, 3)
    expect(auto).toHaveLength(2)
    const [pendiente] = await a.movimientosExtracto(PH, BANCO, { ...rango, estado: 'pendiente' })
    expect(pendiente?.valor).toBe('75000.00')
    const libros = await a.lineasLibros(PH, BANCO, { ...rango, solo_pendientes: true })
    const consignacion = libros.find((l) => l.valor === '350000.00')!
    await expect(a.conciliarManual(PH, BANCO, [pendiente!.id], [{ comprobante_id: consignacion.comprobante_id, orden: consignacion.orden }])).rejects.toMatchObject({ codigo: 'regla_contable' })
    expect((await a.marcarPartida(PH, pendiente!.id, true)).estado).toBe('partida_conciliatoria')
    expect((await a.marcarPartida(PH, pendiente!.id, false)).estado).toBe('pendiente')
    const rec = await a.reciboDesdeMovimiento(PH, pendiente!.id, 'Consignación de un residente')
    expect(rec).toMatchObject({ valor: '75000.00', persona_id: null })
    const historial = await a.conciliaciones(PH, BANCO)
    expect(historial).toHaveLength(3)
    const deshecha = await a.deshacerConciliacion(PH, historial[0]!.id)
    expect(deshecha.accion).toBe('deshacer')
    await expect(a.deshacerConciliacion(PH, historial[0]!.id)).rejects.toMatchObject({ estado: 409 })
    const informe = await a.informeConciliacion(PH, BANCO, fechaDemo())
    expect(informe.saldo_extracto).toBe('57345000')
    expect(informe.libros_pendientes.length).toBeGreaterThan(0)
    expect((await a.extractos(PH, BANCO))).toHaveLength(1)
  })
})
