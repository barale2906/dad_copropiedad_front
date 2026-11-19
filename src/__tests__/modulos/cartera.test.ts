import { beforeEach, describe, expect, it } from 'vitest'
import type { CobroPrevisto } from '@/api/tipos'
import { limpiar } from '@/api/tokens'
import { fechaDemo } from '@/mocks/http'
import * as a from '@/modulos/cartera/api'
import {
  accionesAcuerdo,
  cobrosPorBien,
  conSaldo,
  leerCarteraInicial,
  moverPeriodo,
  periodoDe,
  repartirAnual,
  resumenRecaudo,
  textoPeriodo,
  totalMeses,
} from '@/modulos/cartera/reglas'
import { useCartera } from '@/modulos/cartera/store'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

const vid = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const PH = vid(1)
const T1_101 = vid(7001)
const T1_201 = vid(7003)
const T1_104 = vid(7007)

const cobro = (bien: string, codigo: string, concepto: string, valor: string): CobroPrevisto => ({
  bien_privado_id: bien, bien_codigo: codigo, concepto_cobro_id: concepto, concepto_codigo: concepto, origen: 'liquidacion', valor,
})

describe('reglas de la cartera', () => {
  it('periodos: el mes de una fecha, moverse entre meses y leerlo en palabras', () => {
    expect(periodoDe('2026-11-19')).toBe('2026-11-01')
    expect(moverPeriodo('2026-11-01', 2)).toBe('2027-01-01')
    expect(moverPeriodo('2026-01-01', -1)).toBe('2025-12-01')
    expect(textoPeriodo('2026-11-01')).toBe('noviembre de 2026')
    expect(textoPeriodo('mal')).toBe('mal')
  })

  it('la vista previa se resume por unidad, la de mayor valor primero', () => {
    const r = cobrosPorBien([cobro('a', 'T1-102', 'ADM', '350000'), cobro('b', 'T1-101', 'ADM', '350000'), cobro('a', 'T1-102', 'EXT', '50000'), cobro('a', 'T1-102', 'ADM', '0')])
    expect(r).toEqual([
      { bienId: 'a', codigo: 'T1-102', total: '400000', conceptos: ['ADM', 'EXT'] },
      { bienId: 'b', codigo: 'T1-101', total: '350000', conceptos: ['ADM'] },
    ])
  })

  it('el recaudo se explica: lo aplicado, el pronto pago y el anticipo', () => {
    expect(resumenRecaudo({ aplicado: [{ obligacion_id: '1', valor: '350000' }, { obligacion_id: '2', valor: '3500' }], anticipo: '46500', descuento: '0' }))
      .toBe('se aplicaron 353500 a 2 obligaciones; quedan 46500 como anticipo')
    expect(resumenRecaudo({ aplicado: [], anticipo: '100', descuento: null }, (m) => `$${m}`)).toBe('no había obligaciones por aplicar; quedan $100 como anticipo')
    expect(resumenRecaudo({ aplicado: [{ obligacion_id: '1', valor: '10' }], anticipo: '0', descuento: '5' })).toBe('se aplicaron 10 a 1 obligación; ganó 5 de pronto pago')
  })

  it('aprobar solo un propuesto (con permiso para liquidar); anular un propuesto o vigente', () => {
    const todo = { aprobar: true, anular: true }
    expect(accionesAcuerdo({ estado: 'propuesto' }, todo)).toEqual(['aprobar', 'anular'])
    expect(accionesAcuerdo({ estado: 'vigente' }, todo)).toEqual(['anular'])
    expect(accionesAcuerdo({ estado: 'cumplido' }, todo)).toEqual([])
    expect(accionesAcuerdo({ estado: 'propuesto' }, { aprobar: false, anular: false })).toEqual([])
  })

  it('el valor anual se reparte en doce meses y el último absorbe el redondeo', () => {
    const meses = repartirAnual('1000')
    expect(meses).toHaveLength(12)
    expect(meses[0]).toBe('83.33')
    expect(meses[11]).toBe('83.37')
    expect(totalMeses(meses)).toBe('1000')
    expect(repartirAnual('x')).toEqual(Array<string>(12).fill('0'))
    expect(totalMeses(['10', '', 'x'])).toBe('10')
  })

  it('lee la planilla de cartera inicial: separadores, encabezados y errores por fila', () => {
    const filas = leerCarteraInicial('bien;concepto;periodo;valor;vencimiento\nt1-101;adm;2025-12-01;350000;2025-12-10\nT1-102\t ADM \t2025-12-01\t1.5\t2025-12-10\nT1-103;ADM;12/2025;350000;2025-12-10\nT1-104;ADM;2025-12-01;0;2025-12-10\n;ADM;2025-12-01;1;2025-12-10')
    expect(filas.map((f) => f.error)).toEqual([null, null, 'Periodo y vencimiento van como AAAA-MM-DD.', 'El valor debe ser un número mayor que cero (punto decimal).', 'Falta el bien o el concepto.'])
    expect(filas[0]?.datos).toEqual({ bien: 'T1-101', concepto: 'ADM', periodo: '2025-12-01', valor: '350000', vencimiento: '2025-12-10' })
    expect(leerCarteraInicial('  \n')).toEqual([])
  })

  it('solo las obligaciones vigentes con saldo se pueden pagar o ajustar', () => {
    const base = { estado: 'vigente', saldo: '10' } as const
    const lista = [{ ...base, id: '1' }, { ...base, id: '2', saldo: '0' }, { ...base, id: '3', estado: 'anulada' as const }]
    expect(conSaldo(lista as never).map((o: { id: string }) => o.id)).toEqual(['1'])
  })
})

describe('cartera contra el demo', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('uno', 'x')
    await useEntidad().entrar(PH)
  })

  it('configuración: conceptos sin repetir, política con los límites de la ley y referencia única', async () => {
    expect((await a.conceptos(PH)).map((c) => c.codigo)).toEqual(['ADM', 'EXT', 'FON', 'INT', 'MUL'])
    await expect(a.crearConcepto(PH, { codigo: 'adm', nombre: 'Otra', tipo: 'multa', criterio: 'valor_fijo', valor_fijo: '1', concepto_contable: 'ph.multa' })).rejects.toMatchObject({ estado: 409 })
    expect((await a.crearConcepto(PH, { codigo: 'PAR', nombre: 'Parqueadero', tipo: 'uso_bien_comun', criterio: 'valor_fijo', valor_fijo: '60000', concepto_contable: 'ph.uso_bien_comun' })).codigo).toBe('PAR')
    const politica = { vigente_desde: fechaDemo(), dia_vencimiento: 10, redondeo: '100', factor_mora: '1.5', imputacion: 'por_antiguedad' as const, porcentaje_fondo: '1' }
    await expect(a.crearPolitica(PH, { ...politica, factor_mora: '2' })).rejects.toMatchObject({ estado: 422 })
    await expect(a.crearPolitica(PH, { ...politica, porcentaje_fondo: '0.5' })).rejects.toMatchObject({ estado: 422 })
    expect((await a.crearPolitica(PH, politica)).version).toBe(2)
    expect((await a.politicas(PH))[0]?.imputacion).toBe('por_antiguedad')
    await expect(a.guardarDatosPago(PH, T1_101, { referencia_pago: '1001' })).rejects.toMatchObject({ estado: 409 })
    await expect(a.guardarDatosPago(PH, T1_101, { referencia_pago: 'abc' })).rejects.toMatchObject({ estado: 422 })
    expect((await a.guardarDatosPago(PH, T1_101, { referencia_pago: '777' })).referencia_pago).toBe('777')
    expect((await a.crearModulo(PH, { nombre: 'Torre 3' })).activo).toBe(true)
  })

  it('liquidación: vista previa sin guardar → liquidar → 409 al repetir → anular sin pagos', async () => {
    const periodo = periodoDe(fechaDemo())
    const vista = await a.vistaLiquidacion(PH, periodo)
    expect(vista.por_concepto.map((c) => c.codigo).sort()).toEqual(['ADM', 'EXT', 'FON'])
    expect(cobrosPorBien(vista.cobros)).toHaveLength(40)
    expect(vista.avisos.join(' ')).toContain('no tiene referencia de pago')
    expect((await a.liquidaciones(PH)).some((l) => l.periodo === periodo)).toBe(false)
    const r = await a.liquidar(PH, periodo, 'l1')
    expect(r.cuentas_cobro).toHaveLength(40)
    expect(r.liquidacion.total).toBe(vista.total)
    expect(r.anticipos_aplicados).toBe(1)
    await expect(a.liquidar(PH, periodo, 'l2')).rejects.toMatchObject({ estado: 409 })
    expect((await a.vistaLiquidacion(PH, periodo)).avisos.join(' ')).toContain('ya está liquidado')
    expect((await a.cuentasCobro(PH, { liquidacionId: r.liquidacion.id }))).toHaveLength(40)
    expect((await a.enviarCuentas(PH, r.liquidacion.id)).sin_correo).toBe(2)
    expect((await a.pdfCuentaCobro(PH, r.cuentas_cobro[0]!.id)).nombre).toContain('CB-')
    // Se le aplicó un anticipo: ya tiene pagos y no se anula (se corrige con notas crédito).
    await expect(a.anularLiquidacion(PH, r.liquidacion.id, 'Error')).rejects.toMatchObject({ estado: 409 })
    expect((await a.liquidacion(PH, r.liquidacion.id)).obligaciones.length).toBeGreaterThan(0)
    // La del mes siguiente aún no tiene pagos: se anula.
    const siguiente = await a.liquidar(PH, moverPeriodo(periodo, 1), 'l3')
    expect((await a.anularLiquidacion(PH, siguiente.liquidacion.id, 'Error en el presupuesto')).estado).toBe('anulada')
    await expect(a.anularLiquidacion(PH, siguiente.liquidacion.id, 'otra vez')).rejects.toMatchObject({ estado: 409 })
  }, 20_000)

  it('recaudo: se imputa a lo más antiguo, lo que sobra es anticipo y se puede anular', async () => {
    const antes = await a.estadoCuenta(PH, T1_101)
    expect(Number(antes.vencido)).toBeGreaterThan(0)
    const r = await a.recaudar(PH, { bien_privado_id: T1_101, cuenta_tesoreria_id: vid(30001), fecha: fechaDemo(), valor: '2000000', medio: 'transferencia' }, 'r1')
    expect(r.aplicado.length).toBeGreaterThan(1)
    expect(Number(r.anticipo)).toBeGreaterThan(0)
    const despues = await a.estadoCuenta(PH, T1_101)
    expect(despues.saldo).toBe('0.00')
    expect(despues.anticipos).toBe(r.anticipo)
    await a.anularRecaudo(PH, r.recibo.id, 'Consignación rechazada')
    expect((await a.estadoCuenta(PH, T1_101)).saldo).toBe(antes.saldo)
    await expect(a.anularRecaudo(PH, r.recibo.id, 'otra vez')).rejects.toMatchObject({ estado: 409 })
    await expect(a.recaudar(PH, { bien_privado_id: T1_101, cuenta_tesoreria_id: vid(30001), fecha: fechaDemo(), valor: '0', medio: 'efectivo' }, 'r2')).rejects.toMatchObject({ estado: 422 })
  })

  it('por referencia, por identificar y ajustes con motivo', async () => {
    const lote = await a.recaudarPorReferencia(PH, vid(30001), fechaDemo(-7), fechaDemo())
    expect(lote.recaudos).toHaveLength(2)
    expect(lote.sin_identificar).toBe(1)
    const [porIdentificar] = await a.recibosPorIdentificar(PH)
    expect((await a.aplicarRecibo(PH, porIdentificar!.id, T1_101)).length).toBeGreaterThan(0)

    const [multa] = (await a.conceptos(PH)).filter((c) => c.codigo === 'MUL')
    const o = await a.cobrar(PH, { bien_privado_id: T1_104, concepto_cobro_id: multa!.id, valor: '120000', fecha: fechaDemo(), vencimiento: fechaDemo(15), descripcion: 'Ruido' }, 'c1')
    expect(o.origen).toBe('manual')
    await expect(a.notaCredito(PH, o.id, { valor: '200000', motivo: 'Excede' })).rejects.toMatchObject({ estado: 422 })
    expect((await a.notaCredito(PH, o.id, { valor: '20000', motivo: 'Descuento acordado' })).tipo).toBe('nota_credito')
    await expect(a.anularObligacion(PH, o.id, 'Ya tiene ajuste')).rejects.toMatchObject({ estado: 409 })
    const otra = await a.cobrar(PH, { bien_privado_id: T1_104, concepto_cobro_id: multa!.id, valor: '50000', fecha: fechaDemo(), vencimiento: fechaDemo(15), descripcion: 'Daño' }, 'c2')
    await a.anularObligacion(PH, otra.id, 'Error')

    const filas = [{ bien: 'T1-101', concepto: 'ADM', periodo: '2025-01-01', valor: '100', vencimiento: '2025-01-10' }]
    expect((await a.carteraInicial(PH, [...filas, { ...filas[0]!, bien: 'X-1' }], true)).errores).toEqual([{ fila: 2, mensaje: 'No existe la unidad X-1.' }])
    expect((await a.carteraInicial(PH, filas, true)).cargada).toBe(false)
    expect((await a.carteraInicial(PH, filas, false)).cargada).toBe(true)
  }, 20_000)

  it('saldos, edades y cuadre; intereses: vista previa → causar → 409 al repetir → anular', async () => {
    const saldos = await a.saldos(PH)
    expect(saldos.map((s) => s.codigo)).toContain('T1-101')
    const edades = await a.edades(PH)
    expect(edades.bienes.find((b) => b.codigo === 'T1-101')?.de_31_a_60).not.toBe('0.00')
    expect((await a.cuadre(PH)).map((c) => c.diferencia)).toEqual(['0.00', '1500.00'])
    expect((await a.tasasReferencia(PH))[0]?.modalidad).toBe('consumo_ordinario')
    const vista = await a.vistaIntereses(PH, fechaDemo())
    expect(vista.bienes.length).toBeGreaterThan(0)
    const c = await a.causarIntereses(PH, fechaDemo(), 'i1')
    expect(c.causacion.total).toBe(vista.total)
    await expect(a.causarIntereses(PH, fechaDemo(), 'i2')).rejects.toMatchObject({ estado: 409 })
    expect((await a.causacion(PH, c.causacion.id)).detalle.length).toBeGreaterThan(0)
    expect((await a.anularCausacion(PH, c.causacion.id, 'Tasa errada')).estado).toBe('anulada')
    expect((await a.causaciones(PH)).length).toBe(2)
  }, 20_000)

  it('acuerdos: cuatro ojos (409 si lo aprueba quien lo propuso), proponer y anular', async () => {
    const lista = await a.acuerdos(PH)
    expect(lista.map((x) => x.estado)).toEqual(['vigente', 'propuesto', 'propuesto'])
    const deOtra = lista.find((x) => x.bien_privado_id === T1_201)!
    const propio = lista.find((x) => x.estado === 'propuesto' && x.id !== deOtra.id)!
    await expect(a.aprobarAcuerdo(PH, propio.id)).rejects.toMatchObject({ estado: 409 })
    expect((await a.aprobarAcuerdo(PH, deOtra.id)).estado).toBe('vigente')
    await expect(a.proponerAcuerdo(PH, { bien_privado_id: T1_104, numero_cuotas: 2, primer_vencimiento: fechaDemo(30) }, 'a1')).rejects.toMatchObject({ estado: 422 })
    const nuevo = await a.proponerAcuerdo(PH, { bien_privado_id: T1_101, numero_cuotas: 3, primer_vencimiento: fechaDemo(30) }, 'a2')
    expect(nuevo.cuotas).toHaveLength(3)
    await expect(a.proponerAcuerdo(PH, { bien_privado_id: T1_101, numero_cuotas: 3, primer_vencimiento: fechaDemo(30) }, 'a3')).rejects.toMatchObject({ estado: 409 })
    expect((await a.anularAcuerdo(PH, nuevo.id)).estado).toBe('anulado')
  })

  it('certificados: paz y salvo solo sin deuda; integraciones; informes y presupuesto', async () => {
    await expect(a.emitirCertificado(PH, T1_101, 'paz_y_salvo')).rejects.toMatchObject({ estado: 409 })
    const deuda = await a.emitirCertificado(PH, T1_101, 'deuda')
    expect(deuda.codigo).toMatch(/^PYS-/)
    expect(atob(deuda.pdf_base64)).toContain('%PDF')
    expect((await a.emitirCertificado(PH, T1_104, 'paz_y_salvo')).certificado.saldo).toBe('0.00')
    expect(await a.certificados(PH, T1_101)).toHaveLength(1)

    expect((await a.enviarMorosos(PH, vid(1), fechaDemo())).marcados).toBeGreaterThan(0)
    await expect(a.restringirPorMora(PH, '0')).rejects.toMatchObject({ estado: 422 })
    expect((await a.restringirPorMora(PH, '700000')).restringidos).toBeGreaterThan(0)

    expect((await a.informeFondo(PH)).porcentaje_politica).toBe('1')
    expect(await a.flujoCaja(PH, periodoDe(fechaDemo(-60)), periodoDe(fechaDemo()))).toHaveLength(3)
    expect((await a.informeAsamblea(PH, 2026, 11)).blob.size).toBeGreaterThan(0)

    const [vigente] = await a.presupuestos(PH)
    expect((await a.ejecucion(PH, vigente!.id, 3)).rubros).toHaveLength(4)
    await expect(a.guardarRubros(PH, vigente!.id, [])).rejects.toMatchObject({ estado: 409 })
    const proyecto = await a.proyectoPresupuesto(PH, vigente!.anio, '10')
    expect(proyecto).toMatchObject({ estado: 'borrador', anio: vigente!.anio + 1 })
    expect(Number(proyecto.total_anual)).toBeCloseTo(Number(vigente!.total_anual) * 1.1, 0)
    await expect(a.guardarRubros(PH, proyecto.id, [])).rejects.toMatchObject({ estado: 422 })
    expect((await a.aprobarPresupuesto(PH, proyecto.id, `${proyecto.anio}-01-01`)).estado).toBe('vigente')
    const cuota = await a.crearCuota(PH, { concepto_cobro_id: vid(81003), finalidad: 'Ascensor', valor_total: '6000000', numero_cuotas: 3, primer_periodo: periodoDe(fechaDemo()) })
    await a.anularCuota(PH, cuota.id)
    expect((await a.cuotasExtraordinarias(PH)).find((c) => c.id === cuota.id)?.estado).toBe('anulada')
  }, 25_000)

  it('el store carga una vez las unidades y los conceptos', async () => {
    const s = useCartera()
    await Promise.all([s.asegurar(PH), s.asegurar(PH)])
    expect(s.bienes).toHaveLength(40)
    expect(s.codigo(T1_101)).toBe('T1-101')
    expect(s.codigo('nada')).toBe('Unidad')
    expect(s.concepto(vid(81001))?.codigo).toBe('ADM')
    expect(s.opcionesBien[0]).toEqual({ valor: T1_101, etiqueta: 'T1-101' })
  })
})
