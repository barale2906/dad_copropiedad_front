import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CondicionesContrato, ContratoConVersiones, LineaLiquidacionNomina, VersionContrato } from '@/api/tipos'
import { misDesprendibles } from '@/api/nomina'
import { limpiar } from '@/api/tokens'
import { esDomingo, esDominical, esSensible, medidaDe, textoPeriodo, TIPO_NOVEDAD } from '@/formato/nomina'
import { cuentaDemoId } from '@/mocks/cuenta'
import { fechaDemo } from '@/mocks/http'
import * as a from '@/modulos/nomina/api'
import {
  accionesPeriodo,
  agruparLineas,
  camposCondiciones,
  condicionesDe,
  condicionesVacias,
  contratoVigente,
  diasEntre,
  faltantesCondiciones,
  fechaCerrada,
  iniciosDePeriodo,
  limpiarCondiciones,
  minimoNuevaVersion,
  netoDeLineas,
  pendienteDeOtro,
  periodoDeLaFecha,
  semaforoContrato,
  tipoSalarioDe,
  versionVigente,
} from '@/modulos/nomina/reglas'
import { useNomina } from '@/modulos/nomina/store'
import { catalogoLaboral, crearAdministradora, crearParametroLaboral, crearTablaLaboral, editarAdministradora } from '@/modulos/plataforma/api-normativa'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const ANDINA = '01930000-0000-7000-8000-000000000004'
const YO = cuentaDemoId('uno')
const OTRA = cuentaDemoId('revisor')

const linea = (concepto: LineaLiquidacionNomina['concepto'], clase: LineaLiquidacionNomina['clase'], valor: string): LineaLiquidacionNomina => ({ concepto, clase, cantidad: '1', valor })

describe('textos de la nómina', () => {
  it('cada novedad tiene su medida, como en el backend', () => {
    expect(medidaDe('hora_extra_diurna')).toBe('horas')
    expect(medidaDe('recargo_nocturno_dominical')).toBe('horas')
    expect(medidaDe('vacaciones')).toBe('dias')
    expect(medidaDe('suspension')).toBe('dias')
    expect(medidaDe('bonificacion_salarial')).toBe('valor')
    expect(medidaDe('embargo')).toBe('valor')
    expect(Object.keys(TIPO_NOVEDAD)).toHaveLength(24)
  })

  it('dominicales, datos sensibles y domingos', () => {
    expect(esDominical('recargo_dominical')).toBe(true)
    expect(esDominical('hora_extra_diurna')).toBe(false)
    expect(esSensible('incapacidad_comun')).toBe(true)
    expect(esSensible('licencia_paternidad')).toBe(true)
    expect(esSensible('licencia_remunerada')).toBe(false)
    expect(esDomingo('2026-11-22')).toBe(true)
    expect(esDomingo('2026-11-23')).toBe(false)
  })

  it('texto de un periodo', () => {
    expect(textoPeriodo({ periodicidad: 'quincenal', desde: '2026-11-01', hasta: '2026-11-15' })).toMatch(/^Quincenal · 1 .* al 15 /)
  })
})

describe('reglas de la nómina', () => {
  it('agrupa las líneas por clase y el neto no suma provisiones ni aportes', () => {
    const lineas = [
      linea('basico', 'devengo', '1000000'),
      linea('auxilio_transporte', 'devengo', '200000'),
      linea('salud', 'deduccion', '40000'),
      linea('pension_empleador', 'aporte_empleador', '120000'),
      linea('provision_prima', 'provision', '83300'),
    ]
    const g = agruparLineas(lineas)
    expect(g.map((x) => x.clase)).toEqual(['devengo', 'deduccion', 'aporte_empleador', 'provision'])
    expect(g[0]!.total).toBe('1200000')
    expect(netoDeLineas(lineas)).toBe('1160000')
    expect(agruparLineas([linea('basico', 'devengo', '1')]).map((x) => x.clase)).toEqual(['devengo'])
    expect(netoDeLineas([])).toBe('0')
  })

  it('cuatro ojos: a quien liquidó no se le ofrece aprobar', () => {
    const q = { liquidar: true, aprobar: true }
    expect(accionesPeriodo({ estado: 'abierto', liquidado_por: null }, q, YO)).toEqual(['liquidar'])
    expect(accionesPeriodo({ estado: 'liquidado', liquidado_por: OTRA }, q, YO)).toEqual(['liquidar', 'aprobar'])
    expect(accionesPeriodo({ estado: 'liquidado', liquidado_por: YO }, q, YO)).toEqual(['liquidar'])
    expect(accionesPeriodo({ estado: 'aprobado', liquidado_por: OTRA }, q, YO)).toEqual(['pagar', 'desprendibles'])
    expect(accionesPeriodo({ estado: 'pagado', liquidado_por: OTRA }, q, YO)).toEqual(['desprendibles'])
    expect(accionesPeriodo({ estado: 'liquidado', liquidado_por: OTRA }, { liquidar: false, aprobar: false }, YO)).toEqual([])
    expect(pendienteDeOtro({ estado: 'liquidado', liquidado_por: YO }, YO)).toBe(true)
    expect(pendienteDeOtro({ estado: 'liquidado', liquidado_por: YO }, null)).toBe(false)
    expect(pendienteDeOtro({ estado: 'aprobado', liquidado_por: YO }, YO)).toBe(false)
  })

  it('fechas de los periodos y novedades en periodos cerrados', () => {
    expect(iniciosDePeriodo('mensual', '2026-11')).toEqual(['2026-11-01'])
    expect(iniciosDePeriodo('quincenal', '2026-11')).toEqual(['2026-11-01', '2026-11-16'])
    const p = (estado: 'abierto' | 'aprobado', desde: string, hasta: string) => ({ id: desde, periodicidad: 'mensual' as const, desde, hasta, estado })
    const lista = [p('abierto', '2026-11-01', '2026-11-30'), p('aprobado', '2026-10-01', '2026-10-31')]
    expect(periodoDeLaFecha(lista, '2026-11-15')?.desde).toBe('2026-11-01')
    expect(periodoDeLaFecha(lista, '2026-12-01')).toBeNull()
    expect(fechaCerrada(lista, '2026-10-10')).toBe(true)
    expect(fechaCerrada(lista, '2026-11-10')).toBe(false)
  })

  it('los campos del contrato cambian por tipo, salario, jornada y medio de pago', () => {
    expect(camposCondiciones('termino_fijo', 'ordinario', 'completa', 'efectivo')).toEqual({ fechaFin: true, descripcionObra: false, etapaAprendizaje: false, horasSemanales: false, cuenta: false })
    expect(camposCondiciones('obra_labor', 'ordinario', 'parcial', 'transferencia')).toMatchObject({ fechaFin: false, descripcionObra: true, horasSemanales: true, cuenta: true })
    expect(camposCondiciones('aprendizaje', 'apoyo_sostenimiento', 'completa', 'cheque')).toMatchObject({ fechaFin: true, etapaAprendizaje: true })
    expect(tipoSalarioDe('aprendizaje', 'ordinario')).toBe('apoyo_sostenimiento')
    expect(tipoSalarioDe('termino_fijo', 'apoyo_sostenimiento')).toBe('ordinario')
    expect(tipoSalarioDe('termino_fijo', 'integral')).toBe('integral')
  })

  it('limpia lo que no aplica y avisa lo que falta', () => {
    const c: CondicionesContrato = { ...condicionesVacias(), cargo: ' Aseo ', salario: '1500000', eps_id: 'e', afp_id: '', etapa_aprendizaje: 'lectiva', horas_semanales: '20', centro_costo_id: 'cc', medio_pago: 'efectivo' }
    const l = limpiarCondiciones(c, false)
    expect(l).toMatchObject({ cargo: 'Aseo', afp_id: null, etapa_aprendizaje: null, horas_semanales: null, centro_costo_id: null, cuenta: null })
    expect(limpiarCondiciones({ ...c, tipo_salario: 'apoyo_sostenimiento', etapa_aprendizaje: null }, true)).toMatchObject({ etapa_aprendizaje: 'lectiva', centro_costo_id: 'cc' })
    expect(faltantesCondiciones(condicionesVacias())).toEqual(['el cargo', 'el salario', 'la EPS', 'el banco y el número de la cuenta'])
    expect(faltantesCondiciones({ ...c, jornada: 'parcial', horas_semanales: '' })).toEqual(['las horas semanales'])
  })

  it('versiones: la vigente en una fecha y la mínima de una nueva', () => {
    const v = (id: string, desde: string, salario: string | null = '2000000'): VersionContrato => ({ ...condicionesVacias(), id, contrato_id: 'k', vigente_desde: desde, salario, pensionado: false, creada_en: '' }) as VersionContrato
    const c: ContratoConVersiones = {
      contrato: { id: 'k', empleado_id: 'e', tipo: 'termino_indefinido', fecha_inicio: '2026-01-01', creado_en: '' },
      versiones: [v('b', '2026-06-01'), v('a', '2026-01-01', null)],
    }
    expect(versionVigente(c, '2026-03-01')?.id).toBe('a')
    expect(versionVigente(c, '2026-07-01')?.id).toBe('b')
    expect(versionVigente(c, '2025-01-01')?.id).toBe('a')
    expect(minimoNuevaVersion(c)).toBe('2026-06-02')
    expect(condicionesDe(v('a', '2026-01-01', null)).salario).toBe('')
    expect(contratoVigente({ id: 'e', codigo: 'E', persona_id: 'p', nombre: 'X', contratos: [c] })?.contrato.id).toBe('k')
    expect(contratoVigente({ id: 'e', codigo: 'E', persona_id: 'p', nombre: 'X', contratos: [{ ...c, contrato: { ...c.contrato, fecha_terminacion: '2026-08-01' } }] })).toBeNull()
  })

  it('semáforo de los contratos por vencer: rojo sin tiempo para el preaviso', () => {
    expect(diasEntre('2026-11-01', '2026-11-11')).toBe(10)
    expect(semaforoContrato('2026-11-21', '2026-11-01')).toEqual({ tono: 'peligro', texto: 'Vence en 20 días' })
    expect(semaforoContrato('2026-12-11', '2026-11-01')).toEqual({ tono: 'aviso', texto: 'Vence en 40 días' })
    expect(semaforoContrato('2026-11-02', '2026-11-01').texto).toBe('Vence en 1 día')
    expect(semaforoContrato('2026-11-01', '2026-11-01').texto).toBe('Vence hoy')
  })
})

describe('API de la nómina (demo)', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('uno', 'x')
    await useEntidad().entrar(PH)
  })

  it('catálogo, empleados por cursor y filtros', async () => {
    const c = await a.catalogo(PH)
    expect(c.administradoras.some((x) => x.tipo === 'eps')).toBe(true)
    const activos = await a.empleados(PH, undefined, { estado: 'activo' })
    expect(activos.datos.map((e) => e.codigo)).toEqual(['E-001', 'E-002', 'E-003', 'E-004'])
    expect((await a.empleados(PH, undefined, { estado: 'retirado' })).datos[0]?.nombre).toBe('Pedro Contreras')
    expect((await a.empleados(PH, undefined, { q: 'marta' })).datos).toHaveLength(1)
    await expect(a.catalogo(ANDINA)).rejects.toMatchObject({ codigo: 'modulo_no_habilitado' })
  })

  it('alta, versión, prórroga, simulación y terminación de un contrato', async () => {
    const condiciones = { ...condicionesVacias(), cargo: 'Recepción', salario: '1600000.00', eps_id: (await a.catalogo(PH)).administradoras[0]!.id }
    const nuevo = { codigo: 'E-010', persona: { nombre: 'Ana Pérez', tipo_documento: 'CC' as const, documento: '52123123' }, contrato: { tipo: 'termino_fijo' as const, fecha_inicio: fechaDemo(), fecha_fin: fechaDemo(180), condiciones } }
    const f = await a.crearEmpleado(PH, nuevo)
    expect(f.contratos).toHaveLength(1)
    await expect(a.crearEmpleado(PH, nuevo)).rejects.toMatchObject({ estado: 409 })
    await expect(a.crearEmpleado(PH, { ...nuevo, codigo: 'E-011', contrato: { ...nuevo.contrato, fecha_fin: null } })).rejects.toMatchObject({ estado: 422 })
    await expect(a.crearEmpleado(PH, { ...nuevo, codigo: 'E-012', persona: { ...nuevo.persona, documento: '1' }, contrato: { ...nuevo.contrato, condiciones: { ...condiciones, salario: '100' } } })).rejects.toMatchObject({ codigo: 'validacion' })
    const k = f.contratos[0]!.contrato.id
    const v = await a.modificarContrato(PH, k, fechaDemo(30), { ...condiciones, salario: '1800000.00' })
    expect(v.salario).toBe('1800000.00')
    await expect(a.modificarContrato(PH, k, fechaDemo(10), condiciones)).rejects.toMatchObject({ estado: 422 })
    expect((await a.prorrogar(PH, k, fechaDemo(360))).fecha_fin).toBe(fechaDemo(360))
    const s = await a.simularTerminacion(PH, k, fechaDemo(60), 'sin_justa_causa')
    expect(s.lineas.some((l) => l.concepto === 'indemnizacion')).toBe(true)
    expect((await a.vacaciones(PH, k)).dias_trabajados).toBeGreaterThan(0)
    expect((await a.terminar(PH, k, fechaDemo(60), 'renuncia')).motivo_terminacion).toBe('renuncia')
    await expect(a.prorrogar(PH, k, fechaDemo(400))).rejects.toMatchObject({ estado: 409 })
    await expect(a.agregarContrato(PH, f.id, { tipo: 'termino_indefinido', fecha_inicio: fechaDemo(10), condiciones })).rejects.toMatchObject({ estado: 409 })
    expect((await a.agregarContrato(PH, f.id, { tipo: 'termino_indefinido', fecha_inicio: fechaDemo(90), condiciones })).versiones).toHaveLength(1)
  })

  it('contratos por vencer en 45 días, del más próximo al más lejano', async () => {
    const lista = await a.porVencer(PH)
    expect(lista.map((c) => c.codigo)).toEqual(['E-004', 'E-002'])
    expect(lista[0]!.fecha_limite_preaviso).toBe(fechaDemo(-10))
    await expect(a.porVencer(PH, 200)).rejects.toMatchObject({ estado: 422 })
  })

  it('novedades: medida, dominicales, anulación', async () => {
    const e = await a.empleado(PH, (await a.empleados(PH, undefined, { q: 'E-001' })).datos[0]!.id)
    const k = e.contratos[0]!.contrato.id
    await expect(a.registrarNovedad(PH, k, { tipo: 'vacaciones', desde: fechaDemo() })).rejects.toMatchObject({ estado: 422 })
    const domingo = ['2026-11-22', '2026-11-23'].find(esDomingo)!
    await expect(a.registrarNovedad(PH, k, { tipo: 'recargo_dominical', desde: '2026-11-23', cantidad: '2' })).rejects.toMatchObject({ estado: 422 })
    expect((await a.registrarNovedad(PH, k, { tipo: 'recargo_dominical', desde: domingo, cantidad: '2' })).medida).toBe('horas')
    const n = await a.registrarNovedad(PH, k, { tipo: 'vacaciones', desde: fechaDemo(), hasta: fechaDemo(2) })
    expect(n.hasta).toBe(fechaDemo(2))
    await a.anularNovedad(PH, n.id, 'Error de digitación')
    const lista = await a.novedades(PH, fechaDemo(-1), fechaDemo(3), k)
    expect(lista.find((x) => x.id === n.id)?.anulada).toBe(true)
    await expect(a.anularNovedad(PH, n.id, 'Otra vez')).rejects.toMatchObject({ estado: 409 })
    await expect(a.novedades(PH, fechaDemo(3), fechaDemo(1))).rejects.toMatchObject({ estado: 422 })
  })

  it('periodos: liquidar, cuatro ojos, novedades después de liquidar, pagar y desprendibles', async () => {
    const [actual, pasado, viejo] = await a.periodos(PH)
    expect([actual!.estado, pasado!.estado, viejo!.estado]).toEqual(['abierto', 'liquidado', 'pagado'])
    await expect(a.enviarDesprendibles(PH, pasado!.id)).rejects.toMatchObject({ estado: 409 })
    // El de este mes lo liquida la cuenta de la sesión: ella no lo aprueba.
    const r = await a.liquidar(PH, actual!.id)
    expect(r.liquidaciones.length).toBe(4)
    expect(r.periodo.liquidado_por).toBe(YO)
    await expect(a.aprobar(PH, actual!.id)).rejects.toMatchObject({ codigo: 'conflicto' })
    // El del mes pasado lo liquidó otra cuenta: se aprueba, se paga y tiene desprendibles.
    const aprobado = await a.aprobar(PH, pasado!.id)
    expect(aprobado.estado).toBe('aprobado')
    await expect(a.liquidar(PH, pasado!.id)).rejects.toMatchObject({ codigo: 'conflicto_estado' })
    const detalle = await a.periodo(PH, pasado!.id)
    expect((await a.desprendible(PH, detalle.liquidaciones[0]!.id)).blob.size).toBeGreaterThan(0)
    expect((await a.enviarDesprendibles(PH, pasado!.id)).enviados).toBe(detalle.liquidaciones.length)
    expect((await a.pagar(PH, pasado!.id, fechaDemo())).estado).toBe('pagado')
    await expect(a.pagar(PH, pasado!.id, fechaDemo())).rejects.toMatchObject({ estado: 409 })
    await expect(a.abrirPeriodo(PH, 'mensual', actual!.desde)).rejects.toMatchObject({ estado: 409 })
    await expect(a.abrirPeriodo(PH, 'quincenal', `${actual!.desde.slice(0, 8)}10`)).rejects.toMatchObject({ estado: 422 })
    // Las novedades de un periodo aprobado ya no se registran.
    const e = await a.empleado(PH, detalle.liquidaciones[0]!.empleado_id)
    await expect(a.registrarNovedad(PH, e.contratos[0]!.contrato.id, { tipo: 'bonificacion_salarial', desde: pasado!.desde, cantidad: '1000' })).rejects.toMatchObject({ estado: 422 })
  })

  it('reportes, configuración, contabilización, deducciones e importaciones', async () => {
    const [, , viejo] = await a.periodos(PH)
    const [anio = '', mes = ''] = viejo!.desde.split('-')
    const ap = await a.aportes(PH, Number(anio), Number(mes))
    expect(ap.empleados.length).toBeGreaterThan(0)
    expect(ap.administradoras.length).toBeGreaterThan(0)
    expect((await a.ingresosRetenciones(PH, Number(anio))).length).toBeGreaterThan(0)
    expect((await a.cesantias(PH, Number(anio))).every((c) => Number(c.cesantias) > 0)).toBe(true)
    await expect(a.aportes(PH, Number(anio), 13)).rejects.toMatchObject({ estado: 422 })
    expect((await a.guardarConfiguracion(PH, true)).exonerada_aportes).toBe(true)
    expect((await a.configuracion(PH)).exonerada_aportes).toBe(true)
    expect((await a.contabilizar(PH, `${anio}-01-01`, fechaDemo())).contabilizados).toContain(viejo!.id)
    await expect(a.contabilizar(PH, fechaDemo(), `${anio}-01-01`)).rejects.toMatchObject({ estado: 422 })

    const andres = (await a.empleados(PH, undefined, { q: 'Andrés' })).datos[0]!
    expect(await a.deducciones(PH, andres.id)).toHaveLength(1)
    await expect(a.crearDeduccion(PH, andres.id, { tipo: 'medicina_prepagada', vigente_desde: fechaDemo() })).rejects.toMatchObject({ estado: 422 })
    const d = await a.crearDeduccion(PH, andres.id, { tipo: 'medicina_prepagada', valor_mensual: '300000', vigente_desde: fechaDemo() })
    expect((await a.terminarDeduccion(PH, d.id, fechaDemo(30))).vigente_hasta).toBe(fechaDemo(30))

    const planilla = new File(['codigo;nombre;tipo_documento;documento;tipo_contrato\nE-001;Repetido;CC;1;termino_fijo\nE-020;Nuevo;CC;2;nada\n'], 'e.csv')
    const previa = await a.importarEmpleados(PH, planilla)
    expect(previa.importacion.estado).toBe('con_errores')
    expect(previa.importacion.errores.map((e) => e.columna)).toEqual(['codigo', 'tipo_contrato'])
    await expect(a.confirmarEmpleados(PH, previa.importacion.id)).rejects.toMatchObject({ estado: 409 })
    const buena = await a.importarEmpleados(PH, new File(['codigo;nombre;tipo_documento;documento;tipo_contrato;fecha_inicio\nE-020;Nuevo;CC;2;termino_indefinido;2026-01-01\n'], 'e.csv'))
    expect((await a.confirmarEmpleados(PH, buena.importacion.id)).estado).toBe('aplicada')
    const nov = await a.importarNovedades(PH, new File(['codigo;tipo;desde;hasta;cantidad\nE-020;bonificacion_salarial;2026-11-03;;1000\n'], 'n.csv'))
    expect(nov.filas[0]?.tipo).toBe('bonificacion_salarial')
    expect((await a.confirmarNovedades(PH, nov.importacion.id)).resumen.novedades).toBe(1)
  })

  it('el store resuelve los nombres de empleados, contratos y administradoras', async () => {
    setActivePinia(createPinia())
    const s = useNomina()
    await s.asegurar(PH)
    await s.asegurarFichas(PH)
    const andres = s.empleados.find((e) => e.codigo === 'E-001')!
    expect(s.nombre(andres.id)).toBe('E-001 · Andrés Administrador')
    expect(s.nombre('otro')).toBe('Empleado')
    const k = s.fichas.get(andres.id)!.contratos[0]!.contrato.id
    expect(s.nombreDelContrato(k)).toBe('E-001 · Andrés Administrador')
    expect(s.conContratoVigente.map((x) => x.empleado.codigo)).not.toContain('E-005')
    expect(s.administradora(s.administradoras[0]!.id)).toBe(s.administradoras[0]!.nombre)
    expect(s.administradora(null)).toBe('—')
  })

  it('«Mi nómina»: los desprendibles de la cuenta (vacío para otra persona)', async () => {
    const mios = await misDesprendibles()
    expect(mios).toHaveLength(1)
    expect(mios[0]!.estado).toBe('pagado')
    limpiar(false)
    await useSesion().iniciar('revisor', 'x')
    expect(await misDesprendibles()).toEqual([])
  })

  it('catálogo laboral de la plataforma: solo inserción', async () => {
    const c = await catalogoLaboral()
    const salario = c.parametros.find((p) => p.parametro === 'salario_minimo')!
    await expect(crearParametroLaboral({ parametro: 'salario_minimo', valor: '1', fuente: 'x', vigente_desde: salario.vigente_desde })).rejects.toMatchObject({ estado: 409 })
    expect((await crearParametroLaboral({ parametro: 'salario_minimo', valor: '1500000', fuente: 'Decreto', vigente_desde: '2027-01-01' })).unidad).toBe('pesos')
    await expect(crearTablaLaboral({ tabla: 'fondo_solidaridad', vigente_desde: '2027-01-01', fuente: 'x', tramos: [] })).rejects.toMatchObject({ estado: 422 })
    expect((await crearTablaLaboral({ tabla: 'fondo_solidaridad', vigente_desde: '2027-01-01', fuente: 'x', tramos: [{ desde: '4', hasta: null, tarifa: '1', adicional: '0' }] })).tramos).toHaveLength(1)
    const adm = await crearAdministradora({ tipo: 'arl', codigo: 'ARL99', nit: '1', nombre: 'ARL Nueva' })
    await expect(crearAdministradora({ tipo: 'arl', codigo: 'ARL99', nit: '1', nombre: 'Otra' })).rejects.toMatchObject({ estado: 409 })
    expect((await editarAdministradora(adm.id, { nombre: 'ARL Nueva', activa: false })).activa).toBe(false)
  })
})
