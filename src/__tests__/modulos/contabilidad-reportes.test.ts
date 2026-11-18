import { beforeEach, describe, expect, it } from 'vitest'
import type { FilaBalance, LibroMayor } from '@/api/tipos'
import { limpiar } from '@/api/tokens'
import * as a from '@/modulos/contabilidad/api'
import { arbolBalance, filasVisibles, leerCsvSaldos, leerPrefijos, saldoCorrido, saldoNatural, totalesBalance } from '@/modulos/contabilidad/reglas'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const anio = new Date().getFullYear()
const rango = { desde: `${anio}-01-01`, hasta: `${anio}-12-31` }

const fila = (codigo: string, d: string, c: string, extra: Partial<FilaBalance> = {}): FilaBalance => ({
  cuenta_id: codigo, codigo, nombre: `Cuenta ${codigo}`, naturaleza: 'debito', saldo_inicial: '0', debitos: d, creditos: c, saldo_final: String(Number(d) - Number(c)), ...extra,
})

describe('reglas de los reportes', () => {
  const nombres = new Map([['1', 'Activo'], ['11', 'Disponible'], ['1105', 'Caja'], ['1110', 'Bancos'], ['111005', 'Moneda nacional']])

  it('el balance suma en los ancestros del PUC hasta la clase', () => {
    const arbol = arbolBalance([fila('110505', '100', '0'), fila('11100501', '50.5', '20')], nombres)
    expect(arbol.map((f) => `${f.codigo}:${f.nivel}:${f.debitos}`)).toEqual(['1:0:150.5', '11:1:150.5', '1105:2:100', '110505:3:100', '1110:2:50.5', '111005:3:50.5', '11100501:4:50.5'])
    expect(arbol.find((f) => f.codigo === '1105')).toMatchObject({ nombre: 'Caja', tieneHijas: true, hoja: false })
    expect(arbol.find((f) => f.codigo === '110505')).toMatchObject({ hoja: true, tieneHijas: false })
  })

  it('con detalle por tercero, cada tercero cuelga de su cuenta', () => {
    const arbol = arbolBalance([fila('130505', '10', '0', { persona_id: 'p1' }), fila('130505', '5', '0', { persona_id: 'p2' })], new Map(), (f) => (f.persona_id ? `Tercero ${f.persona_id}` : null))
    const cuenta = arbol.find((f) => f.clave === '130505')!
    expect(cuenta).toMatchObject({ debitos: '15', tieneHijas: true })
    expect(arbol.filter((f) => f.padre === '130505' && f.hoja).map((f) => f.nombre)).toEqual(['Tercero p1', 'Tercero p2'])
  })

  it('se pliega por nivel y por fila', () => {
    const arbol = arbolBalance([fila('110505', '100', '0'), fila('11100501', '50', '0')], nombres)
    expect(filasVisibles(arbol, 1, new Set()).map((f) => f.codigo)).toEqual(['1', '11'])
    expect(filasVisibles(arbol, 5, new Set(['1110'])).map((f) => f.codigo)).toEqual(['1', '11', '1105', '110505', '1110'])
    expect(filasVisibles(arbol, 5, new Set(['1']))).toHaveLength(1)
  })

  it('totales, saldo en la naturaleza de la cuenta y saldo corrido', () => {
    expect(totalesBalance([fila('1', '10.10', '0'), fila('2', '0', '10.1')])).toEqual({ debitos: '10.1', creditos: '10.1', cuadra: true })
    expect(totalesBalance([fila('1', '10', '0')]).cuadra).toBe(false)
    expect(saldoNatural('-500', 'credito')).toBe('500')
    expect(saldoNatural('-500', 'debito')).toBe('-500')
    const mayor = {
      cuenta: { naturaleza: 'credito' }, saldo_inicial: '-100',
      movimientos: [{ debito: '0', credito: '50' }, { debito: '30', credito: '0' }],
    } as unknown as LibroMayor
    expect(saldoCorrido(mayor).map((m) => m.saldo)).toEqual(['150', '120'])
  })

  it('lee el CSV de saldos iniciales y reporta las filas malas', () => {
    const csv = 'cuenta;debito;credito;centro\n110505;1.500.000,50;;\n310505;;1500000.5;ADM\nCaja;1;0\n130505;abc;0\n\n'
    const { lineas, errores } = leerCsvSaldos(csv)
    expect(lineas.map((l) => [l.cuenta, l.debito, l.credito, l.centro])).toEqual([['110505', '1500000.5', '', ''], ['310505', '', '1500000.5', 'ADM']])
    expect(errores).toEqual(['Fila 4: la cuenta «Caja» no es un código PUC.', 'Fila 5: un monto no es válido.'])
    expect(leerCsvSaldos('110505,10,0\n').lineas).toHaveLength(1)
    expect(leerPrefijos('11, 12;13  x 11')).toEqual(['11', '12', '13'])
  })
})

describe('configuración, apertura y reportes contra el demo', { timeout: 25_000 }, () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('uno', 'x')
    await useEntidad().entrar(PH)
  })

  it('configuración versionada, tipos, reglas, rubros y notas', async () => {
    const c = await a.configuracion(PH)
    expect(c).toMatchObject({ version: 1, marco_tecnico: 'grupo_2' })
    await expect(a.guardarConfiguracion(PH, { marco_tecnico: 'grupo_1', cuenta_resultado: '110505', vigente_desde: `${anio}-01-01` })).rejects.toMatchObject({ estado: 422 })
    expect((await a.guardarConfiguracion(PH, { marco_tecnico: 'grupo_1', cuenta_resultado: '360505', vigente_desde: `${anio}-01-01` })).version).toBe(2)
    const t = await a.crearTipoComprobante(PH, { codigo: 'aj', nombre: 'Ajustes', manual: true }, 't1')
    expect(t.codigo).toBe('AJ')
    await expect(a.crearTipoComprobante(PH, { codigo: 'AJ', nombre: 'Otra vez' }, 't2')).rejects.toMatchObject({ estado: 409 })
    expect((await a.editarTipoComprobante(PH, t.id, { codigo: 'AJ', nombre: 'Ajustes', activo: false })).activo).toBe(false)
    const lineas = [{ concepto: 'cuota', cara: 'debito' as const, cuenta: '130505', tercero: 'documento' as const, centro: 'ninguno' as const }, { concepto: 'cuota', cara: 'credito' as const, cuenta: '417005', tercero: 'ninguno' as const, centro: 'ninguno' as const }]
    expect((await a.crearRegla(PH, { evento: 'cartera.cuota', tipo_comprobante: 'CC', vigente_desde: `${anio}-06-01`, lineas }, 'r1')).version).toBe(2)
    await expect(a.crearRegla(PH, { evento: 'x', tipo_comprobante: 'CC', vigente_desde: `${anio}-06-01`, lineas: [lineas[0]!] }, 'r2')).rejects.toMatchObject({ codigo: 'regla_contable' })
    expect((await a.reglas(PH)).filter((r) => r.evento === 'cartera.cuota')).toHaveLength(2)
    const rubros = await a.rubros(PH)
    await expect(a.guardarRubros(PH, [...rubros, { estado: 'resultados', codigo: 'x', nombre: 'Sin prefijos', orden: 9, prefijos: [] }])).rejects.toMatchObject({ estado: 422 })
    expect(await a.guardarRubros(PH, rubros.slice(0, 2))).toHaveLength(2)
    expect((await a.guardarNota(PH, { anio, numero: 1, titulo: 'Entidad', texto: 'Texto nuevo' })).version).toBe(2)
    expect(await a.notas(PH, anio)).toHaveLength(1)
  })

  it('plantillas: vista previa, aplicar y guardar la propia', async () => {
    const [p] = await a.plantillas(PH)
    expect(p?.estado).toBe('publicada')
    expect(await a.aplicarPlantilla(PH, p!.id, true)).toMatchObject({ previsualizacion: true, cuentas_creadas: 12 })
    expect((await a.aplicarPlantilla(PH, p!.id, false)).previsualizacion).toBe(false)
    await expect(a.aplicarPlantilla(PH, 'no-existe', true)).rejects.toMatchObject({ estado: 404 })
    expect(await a.guardarComoPlantilla(PH, 'Mi PH', 'propiedad_horizontal')).toMatchObject({ estado: 'borrador', nombre: 'Mi PH' })
  })

  it('saldos iniciales y cierre anual', async () => {
    const hoy = new Date().toISOString().slice(0, 10)
    await expect(a.saldosIniciales(PH, { fecha: hoy, lineas: [{ cuenta: '110505', debito: '10' }, { cuenta: '310505', credito: '9' }] }, 's0')).rejects.toMatchObject({ codigo: 'regla_contable' })
    const ap = await a.saldosIniciales(PH, { fecha: hoy, lineas: [{ cuenta: '110505', debito: '10' }, { cuenta: '310505', credito: '10' }] }, 's1')
    expect(ap).toMatchObject({ tipo: 'AP', estado: 'contabilizado', numero: 2 })
    const ci = await a.cierreAnual(PH, anio, 'c1')
    expect(ci).toMatchObject({ tipo: 'CI', mes: 13, estado: 'contabilizado' })
    const resultado = ci.lineas.at(-1)
    expect(resultado?.credito).toBe('12700000.00')
    await expect(a.cierreAnual(PH, anio, 'c2')).rejects.toMatchObject({ estado: 409 })
    expect((await a.estadosFinancieros(PH, `${anio}-12-31`)).cierre_contabilizado).toBe(true)
  })

  it('reportes con los comprobantes contabilizados', async () => {
    const balance = await a.balancePrueba(PH, rango)
    expect(totalesBalance(balance).cuadra).toBe(true)
    expect(balance.find((f) => f.codigo === '417005')).toMatchObject({ creditos: '18000000.00' })
    const porTercero = await a.balancePrueba(PH, { ...rango, por_tercero: true })
    expect(porTercero.some((f) => f.persona_id)).toBe(true)
    const diario = await a.libroDiario(PH, rango)
    expect(diario.every((c) => c.estado === 'contabilizado' && c.lineas.length > 0)).toBe(true)
    const mayor = await a.libroMayor(PH, '11', rango)
    expect(mayor.saldo_final).toBe('60000000.00')
    expect(saldoCorrido(mayor).at(-1)?.saldo).toBe('60000000')
    await expect(a.libroMayor(PH, '999', rango)).rejects.toMatchObject({ estado: 422 })
    const ef = await a.estadosFinancieros(PH, `${anio}-12-31`)
    expect(ef.resultado_ejercicio).toBe('12700000.00')
    expect(ef.situacion_financiera.find((r) => r.codigo === 'efectivo')?.valor).toBe('60000000.00')
    expect(ef.notas).toHaveLength(1)
  })
})
