import { beforeEach, describe, expect, it } from 'vitest'
import type { Comprobante, CuentaContable } from '@/api/tipos'
import { limpiar } from '@/api/tokens'
import * as a from '@/modulos/contabilidad/api'
import {
  accionesComprobante,
  accionesPeriodo,
  avisosComprobante,
  comprobanteVacio,
  duplicarLinea,
  editableDe,
  lineaVacia,
  montoQueCuadra,
  nivelDeCodigo,
  nombrePeriodo,
  padreDeCodigo,
  peticionComprobante,
  totales,
} from '@/modulos/contabilidad/reglas'
import { useEntidad } from '@/stores/entidad'
import { usePlanCuentas } from '@/stores/plan-cuentas'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const EMPRESA = '01930000-0000-7000-8000-000000000003'

const cuenta = (codigo: string, extra: Partial<CuentaContable> = {}): CuentaContable => ({
  id: `id-${codigo}`, codigo, nombre: `Cuenta ${codigo}`, naturaleza: 'debito', nivel: 'subcuenta', acepta_movimiento: true,
  exige_tercero: false, exige_centro_costo: false, activa: true, ...extra,
})
const linea = (cuentaCodigo: string, debito = '', credito = '') => ({ ...lineaVacia(), cuenta: cuentaCodigo, debito, credito })

describe('reglas de la contabilidad', () => {
  it('suma débitos y créditos con decimales exactos', () => {
    expect(totales([linea('1', '0.1'), linea('2', '0.2'), linea('3', '', '0.3')])).toEqual({ debito: '0.3', credito: '0.3', diferencia: '0', cuadra: true })
    expect(totales([linea('1', '100'), linea('2', '', '40')])).toMatchObject({ diferencia: '60', cuadra: false })
    expect(totales([lineaVacia(), lineaVacia()]).cuadra).toBe(false)
  })

  it('el atajo = pone lo que falta del lado que cuadra', () => {
    const lineas = [linea('1', '150000'), linea('2', '', '100000'), linea('3')]
    expect(montoQueCuadra(lineas, 2, 'credito')).toBe('50000')
    expect(montoQueCuadra(lineas, 2, 'debito')).toBe('')
    const alReves = [linea('1', '', '80'), linea('2')]
    expect(montoQueCuadra(alReves, 1, 'debito')).toBe('80')
  })

  it('duplica la línea debajo con otra clave', () => {
    const lineas = [linea('1', '5'), linea('2')]
    const d = duplicarLinea(lineas, 0)
    expect(d.map((l) => l.cuenta)).toEqual(['1', '1', '2'])
    expect(d[1]?.clave).not.toBe(d[0]?.clave)
    expect(duplicarLinea(lineas, 9)).toBe(lineas)
  })

  it('avisa lo que el backend rechazaría', () => {
    const cuentas = new Map([
      ['110505', cuenta('110505')],
      ['1105', cuenta('1105', { acepta_movimiento: false, nivel: 'cuenta' })],
      ['233550', cuenta('233550', { exige_tercero: true })],
      ['513505', cuenta('513505', { exige_centro_costo: true })],
    ])
    const c = { ...comprobanteVacio('2026-11-18', 'CC'), lineas: [linea('1105', '10'), linea('233550', '', '5'), linea('513505', '3', '3'), linea('9999', '1'), lineaVacia()] }
    expect(avisosComprobante(c, cuentas)).toEqual([
      'Escriba la descripción del comprobante.',
      'Línea 1: la cuenta 1105 no admite movimientos.',
      'Línea 2: la cuenta 233550 exige un tercero.',
      'Línea 3: la cuenta 513505 exige un centro de costo.',
      'Línea 3: lleve el valor al débito o al crédito, no a ambos.',
      'Línea 4: la cuenta 9999 no existe en el plan de cuentas.',
      'Los débitos y los créditos no suman lo mismo.',
    ])
    const bien = { ...comprobanteVacio('2026-11-18', 'CC'), descripcion: 'Caja', lineas: [linea('110505', '10'), { ...linea('233550', '', '10'), tercero: { id: 'p', nombre: 'P' } }] }
    expect(avisosComprobante(bien, cuentas)).toEqual([])
    expect(avisosComprobante({ ...comprobanteVacio('', ''), descripcion: 'x' }, cuentas)).toEqual(['Elija el tipo de comprobante.', 'Indique la fecha.', 'Un comprobante lleva al menos dos líneas.'])
  })

  it('arma la petición por códigos sin las líneas en blanco y vuelve a la edición', () => {
    const c = { ...comprobanteVacio('2026-11-18', 'NC'), descripcion: '  Ajuste ', lineas: [{ ...linea('110505', '10'), centro: 'ADM', tercero: { id: 'p1', nombre: 'Ana' } }, linea('233550', '', '10'), lineaVacia()] }
    const p = peticionComprobante(c)
    expect(p).toEqual({
      tipo: 'NC', fecha: '2026-11-18', descripcion: 'Ajuste',
      lineas: [
        { cuenta: '110505', persona_id: 'p1', centro_costo: 'ADM', debito: '10', credito: '0', descripcion: null },
        { cuenta: '233550', persona_id: null, centro_costo: null, debito: '0', credito: '10', descripcion: null },
      ],
    })
    const desde = {
      tipo: 'NC', fecha: '2026-11-18', descripcion: 'Ajuste', estado: 'borrador',
      lineas: [{ cuenta_id: 'id-110505', persona_id: 'p1', centro_costo_id: 'c1', debito: '10.00', credito: '0.00' }],
    } as unknown as Comprobante
    const e = editableDe(desde, new Map([['id-110505', cuenta('110505')]]), new Map([['c1', { id: 'c1', codigo: 'ADM', nombre: 'Adm', activo: true }]]), new Map([['p1', 'Ana']]))
    expect(e.lineas[0]).toMatchObject({ cuenta: '110505', centro: 'ADM', debito: '10.00', credito: '', tercero: { id: 'p1', nombre: 'Ana' } })
  })

  it('ofrece las acciones por estado del comprobante', () => {
    const todo = { crear: true, contabilizar: true, revertir: true }
    expect(accionesComprobante({ estado: 'borrador' }, todo)).toEqual(['editar', 'eliminar', 'contabilizar'])
    expect(accionesComprobante({ estado: 'borrador' }, { ...todo, crear: false })).toEqual(['contabilizar'])
    expect(accionesComprobante({ estado: 'contabilizado' }, todo)).toEqual(['revertir'])
    expect(accionesComprobante({ estado: 'contabilizado', revertido_por: 'x' }, todo)).toEqual([])
    expect(accionesComprobante({ estado: 'contabilizado', revierte_a: 'x' }, todo)).toEqual([])
    expect(accionesComprobante({ estado: 'contabilizado' }, { ...todo, revertir: false })).toEqual([])
  })

  it('periodos: estados, nombres y niveles del PUC', () => {
    const q = { cerrar: true, reabrir: true }
    expect(accionesPeriodo('abierto', q)).toEqual(['revision', 'cerrar'])
    expect(accionesPeriodo('en_revision', q)).toEqual(['cerrar', 'devolver'])
    expect(accionesPeriodo('cerrado', q)).toEqual(['reabrir'])
    expect(accionesPeriodo('cerrado', { cerrar: true, reabrir: false })).toEqual([])
    expect(accionesPeriodo('abierto', { cerrar: false, reabrir: true })).toEqual([])
    expect(nombrePeriodo({ anio: 2026, mes: 3 })).toBe('marzo de 2026')
    expect(nombrePeriodo({ anio: 2026, mes: 13 })).toBe('Cierre de 2026')
    expect(['1', '11', '1105', '110505', '11100501'].map(nivelDeCodigo)).toEqual(['clase', 'grupo', 'cuenta', 'subcuenta', 'auxiliar'])
    expect(['1', '11', '1105', '110505', '11100501'].map(padreDeCodigo)).toEqual([null, '1', '11', '1105', '111005'])
  })
})

describe('contabilidad contra el demo', { timeout: 25_000 }, () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('uno', 'x')
    await useEntidad().entrar(PH)
  })

  it('el plan de cuentas se carga una vez y se olvida al cambiar de entidad', async () => {
    const plan = usePlanCuentas()
    await Promise.all([plan.asegurar(), plan.asegurar()])
    expect(plan.porCodigo.get('110505')?.acepta_movimiento).toBe(true)
    expect(plan.porCodigo.get('1105')?.acepta_movimiento).toBe(false)
    expect(plan.imputables.some((c) => c.codigo === '110510')).toBe(false)
    expect(plan.tipos.filter((t) => t.manual).map((t) => t.codigo)).toEqual(['CC', 'NC'])
    expect(plan.centroPorId.size).toBe(3)
    useEntidad().activa = { ...useEntidad().activa!, entidad_id: EMPRESA }
    await plan.asegurar()
    expect(plan.cargado).toBe(true)
  })

  it('crea, previsualiza, contabiliza y revierte un comprobante', async () => {
    const hoy = new Date().toISOString().slice(0, 10)
    const borrador = { tipo: 'CC', fecha: hoy, descripcion: 'Compra de papelería', lineas: [{ cuenta: '513505', debito: '50000', centro_costo: 'ADM' }, { cuenta: '110505', credito: '40000' }] }
    await expect(a.previsualizar(PH, borrador)).rejects.toMatchObject({ estado: 422, codigo: 'regla_contable' })
    await expect(a.previsualizar(PH, { ...borrador, lineas: [{ cuenta: '1105', debito: '1' }, { cuenta: '110505', credito: '1' }] })).rejects.toMatchObject({ codigo: 'regla_contable' })
    await expect(a.crearComprobante(PH, { ...borrador, tipo: 'RC' }, 'k0')).rejects.toMatchObject({ estado: 422, codigo: 'validacion' })
    const c = await a.crearComprobante(PH, borrador, 'k1')
    expect(c.estado).toBe('borrador')
    await expect(a.contabilizar(PH, c.id)).rejects.toMatchObject({ codigo: 'regla_contable' })
    const cuadrado = { ...borrador, lineas: [borrador.lineas[0]!, { cuenta: '110505', credito: '50000' }] }
    expect((await a.previsualizar(PH, cuadrado)).total).toBe('50000.00')
    await a.guardarComprobante(PH, c.id, cuadrado)
    const hecho = await a.contabilizar(PH, c.id)
    expect(hecho).toMatchObject({ estado: 'contabilizado', numero: 4 })
    await expect(a.guardarComprobante(PH, c.id, cuadrado)).rejects.toMatchObject({ estado: 409 })
    await expect(a.borrarComprobante(PH, c.id)).rejects.toMatchObject({ estado: 409 })
    await expect(a.revertir(PH, c.id, '')).rejects.toMatchObject({ estado: 422 })
    const reverso = await a.revertir(PH, c.id, 'Se registró dos veces')
    expect(reverso).toMatchObject({ revierte_a: c.id, motivo_reverso: 'Se registró dos veces' })
    expect(reverso.lineas[0]).toMatchObject({ debito: '0.00', credito: '50000.00' })
    expect((await a.comprobante(PH, c.id)).revertido_por).toBe(reverso.id)
    await expect(a.revertir(PH, c.id, 'otra vez')).rejects.toMatchObject({ codigo: 'conflicto' })
    await expect(a.revertir(PH, reverso.id, 'reverso del reverso')).rejects.toMatchObject({ codigo: 'conflicto' })
    const lista = await a.comprobantes(PH, { estado: 'borrador' })
    expect(lista.every((x) => x.estado === 'borrador' && x.lineas.length === 0)).toBe(true)
  })

  it('no contabiliza en un periodo que no está abierto', async () => {
    const [cerrado] = (await a.periodos(PH)).filter((p) => p.estado === 'cerrado')
    if (!cerrado) return
    const fecha = `${cerrado.anio}-${String(cerrado.mes).padStart(2, '0')}-10`
    const c = await a.crearComprobante(PH, { tipo: 'NC', fecha, descripcion: 'Tarde', lineas: [{ cuenta: '530505', debito: '10' }, { cuenta: '110505', credito: '10' }] }, 'k2')
    await expect(a.contabilizar(PH, c.id)).rejects.toMatchObject({ codigo: 'regla_contable' })
    await a.borrarComprobante(PH, c.id)
    await expect(a.comprobante(PH, c.id)).rejects.toMatchObject({ estado: 404 })
  })

  it('periodos: revisión, cierre y reapertura con cuatro ojos', async () => {
    const lista = await a.periodos(PH)
    const abierto = lista.find((p) => p.estado === 'abierto')!
    expect((await a.cambiarPeriodo(PH, abierto.id, 'en_revision')).estado).toBe('en_revision')
    expect((await a.cambiarPeriodo(PH, abierto.id, 'abierto')).estado).toBe('abierto')
    expect((await a.cambiarPeriodo(PH, abierto.id, 'cerrado')).estado).toBe('cerrado')
    await expect(a.cambiarPeriodo(PH, abierto.id, 'abierto')).rejects.toMatchObject({ codigo: 'conflicto' })
    await expect(a.solicitarReapertura(PH, abierto.id, 'no', null)).rejects.toMatchObject({ estado: 422 })
    const propia = await a.solicitarReapertura(PH, abierto.id, 'Falta una factura', null)
    await expect(a.decidirReapertura(PH, propia.id, true)).rejects.toMatchObject({ codigo: 'conflicto' })

    const ajena = (await Promise.all(lista.filter((p) => p.estado === 'cerrado').map((p) => a.reaperturas(PH, p.id)))).flat().find((r) => r.id !== propia.id)
    if (ajena) {
      expect((await a.decidirReapertura(PH, ajena.id, true)).estado).toBe('aprobada')
      expect((await a.periodos(PH)).find((p) => p.id === ajena.periodo_id)?.estado).toBe('abierto')
      await expect(a.decidirReapertura(PH, ajena.id, false)).rejects.toMatchObject({ codigo: 'conflicto' })
    }
    const nuevo = await a.abrirPeriodo(PH, 2030, 13)
    expect(nuevo).toMatchObject({ anio: 2030, mes: 13, estado: 'abierto' })
    await expect(a.abrirPeriodo(PH, 2030, 14)).rejects.toMatchObject({ estado: 422 })
  })

  it('cuentas y centros: crear con su padre y editar sin cambiar el código', async () => {
    await expect(a.crearCuenta(PH, { codigo: '11100503', nombre: 'Davivienda', acepta_movimiento: true }, 'c1')).resolves.toMatchObject({ nivel: 'auxiliar', naturaleza: 'debito' })
    await expect(a.crearCuenta(PH, { codigo: '11100503', nombre: 'Otra', acepta_movimiento: true }, 'c2')).rejects.toMatchObject({ estado: 409 })
    await expect(a.crearCuenta(PH, { codigo: '9999999999', nombre: 'Sin padre', acepta_movimiento: true }, 'c3')).rejects.toMatchObject({ estado: 422 })
    const plan = usePlanCuentas()
    await plan.asegurar()
    const caja = plan.porCodigo.get('110505')!
    expect((await a.editarCuenta(PH, caja.id, { nombre: 'Caja principal', acepta_movimiento: true, exige_tercero: false, exige_centro_costo: false, activa: true })).nombre).toBe('Caja principal')
    expect((await a.catalogoPuc(PH, '1110')).map((c) => c.codigo)).toContain('111005')
    const centro = await a.crearCentro(PH, { codigo: 'prq', nombre: 'Parqueaderos' }, 'cc1')
    expect(centro.codigo).toBe('PRQ')
    await expect(a.crearCentro(PH, { codigo: 'PRQ', nombre: 'Repetido' }, 'cc2')).rejects.toMatchObject({ estado: 409 })
    expect((await a.editarCentro(PH, centro.id, { codigo: 'PRQ', nombre: 'Parqueaderos', activo: false })).activo).toBe(false)
  })
})
