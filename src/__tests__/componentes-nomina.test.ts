import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Administradora, CondicionesContrato, LiquidacionNomina, VersionContrato } from '@/api/tipos'
import FormCondiciones from '@/modulos/nomina/componentes/FormCondiciones.vue'
import FormNovedad from '@/modulos/nomina/componentes/FormNovedad.vue'
import LineaTiempoVersiones from '@/modulos/nomina/componentes/LineaTiempoVersiones.vue'
import LiquidacionEmpleado from '@/modulos/nomina/componentes/LiquidacionEmpleado.vue'
import { condicionesVacias } from '@/modulos/nomina/reglas'

const ADMIN: Administradora[] = [
  { id: 'eps1', tipo: 'eps', codigo: 'EPS010', nit: '1', nombre: 'EPS Sura', activa: true },
  { id: 'eps2', tipo: 'eps', codigo: 'EPS099', nit: '2', nombre: 'EPS Cerrada', activa: false },
  { id: 'afp1', tipo: 'afp', codigo: '230301', nit: '3', nombre: 'Porvenir', activa: true },
]

function montarCondiciones(tipoContrato: 'termino_fijo' | 'aprendizaje', inicial: Partial<CondicionesContrato> = {}, centros: { valor: string; etiqueta: string }[] = []) {
  const w = mount(FormCondiciones, {
    props: {
      modelValue: { ...condicionesVacias(), ...inicial },
      tipoContrato,
      administradoras: ADMIN,
      centros,
      'onUpdate:modelValue': (v: CondicionesContrato) => w.setProps({ modelValue: v }),
    },
  })
  return w
}

describe('FormCondiciones', () => {
  it('el ordinario elige el tipo de salario y pide la cuenta con transferencia', () => {
    const w = montarCondiciones('termino_fijo')
    expect(w.text()).toContain('Tipo de salario')
    expect(w.text()).not.toContain('Etapa del aprendizaje')
    expect(w.text()).toContain('Número de la cuenta')
    expect(w.text()).not.toContain('Centro de costo')
    // Solo las administradoras activas del tipo.
    const eps = w.findAll('option').map((o) => o.text())
    expect(eps).toContain('EPS Sura (EPS010)')
    expect(eps).not.toContain('EPS Cerrada (EPS099)')
  })

  it('el aprendiz pide su etapa; la jornada parcial, sus horas; sin transferencia no hay cuenta', async () => {
    const w = montarCondiciones('aprendizaje', { tipo_salario: 'apoyo_sostenimiento', jornada: 'parcial', medio_pago: 'efectivo' }, [{ valor: 'cc', etiqueta: 'ADM · Administración' }])
    expect(w.text()).toContain('Apoyo de sostenimiento mensual')
    expect(w.text()).toContain('Etapa del aprendizaje')
    expect(w.text()).not.toContain('Tipo de salario')
    expect(w.text()).toContain('Horas semanales')
    expect(w.text()).not.toContain('Número de la cuenta')
    expect(w.text()).toContain('Centro de costo')
  })

  it('escribe en el modelo y los opcionales vacíos quedan en null', async () => {
    const w = montarCondiciones('termino_fijo', { afp_id: 'afp1' })
    await w.get('input').setValue('Conserje')
    expect(w.props('modelValue').cargo).toBe('Conserje')
    const afp = w.findAll('select').find((s) => s.findAll('option').some((o) => o.text().startsWith('Porvenir')))!
    await afp.setValue('')
    expect(w.props('modelValue').afp_id).toBeNull()
    await w.get('input[type="checkbox"]').setValue(true)
    expect(w.props('modelValue').pensionado).toBe(true)
  })
})

describe('FormNovedad', () => {
  const contratos = [{ valor: 'k1', etiqueta: 'E-001 · Andrés' }]

  it('cambia según la medida y emite la petición de días sin cantidad', async () => {
    const w = mount(FormNovedad, { props: { contratos, fechaInicial: '2026-11-03', verSensibles: true } })
    const [, tipo] = w.findAll('select')
    await tipo!.setValue('vacaciones')
    expect(w.text()).toContain('Último día')
    expect(w.text()).toContain('días calendario')
    const fechas = w.findAll('input[type="date"]')
    await fechas[1]!.setValue('2026-11-05')
    await w.get('form').trigger('submit')
    expect(w.emitted('registrar')?.[0]).toEqual(['k1', { tipo: 'vacaciones', desde: '2026-11-03', hasta: '2026-11-05', cantidad: null, descripcion: null }])
  })

  it('las de horas llevan una fecha y sus horas; avisa lo que falta', async () => {
    const w = mount(FormNovedad, { props: { contratos, fechaInicial: '2026-11-03' } })
    const [, tipo] = w.findAll('select')
    await tipo!.setValue('hora_extra_diurna')
    expect(w.text()).not.toContain('Último día')
    await w.get('form').trigger('submit')
    expect(w.text()).toContain('Falta las horas')
    expect(w.emitted('registrar')).toBeUndefined()
  })

  it('sin datos sensibles no ofrece incapacidades; avisa dominicales y periodos aprobados', async () => {
    const w = mount(FormNovedad, { props: { contratos, fechaInicial: '2026-11-03', cerrada: (f: string) => f < '2026-11-01' } })
    expect(w.text()).not.toContain('Incapacidad común')
    const [, tipo] = w.findAll('select')
    await tipo!.setValue('recargo_dominical')
    expect(w.text()).toContain('domingo o festivo')
    await w.findAll('input[type="date"]')[0]!.setValue('2026-10-20')
    expect(w.text()).toContain('periodo ya aprobado')
    expect(w.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})

describe('LiquidacionEmpleado', () => {
  const liq: LiquidacionNomina = {
    id: 'l1',
    contrato_id: 'k1',
    empleado_id: 'e1',
    dias: 30,
    ibc: '2000000',
    devengos: '2200000',
    deducciones: '160000',
    neto: '2040000',
    aportes_empleador: '400000',
    lineas: [
      { concepto: 'basico', clase: 'devengo', cantidad: '30', valor: '2000000' },
      { concepto: 'auxilio_transporte', clase: 'devengo', cantidad: '30', valor: '200000' },
      { concepto: 'salud', clase: 'deduccion', cantidad: '4', valor: '80000' },
      { concepto: 'provision_prima', clase: 'provision', cantidad: '8.33', valor: '166600' },
    ],
  }

  it('muestra los totales y agrupa las líneas (provisiones aparte)', () => {
    const w = mount(LiquidacionEmpleado, { props: { liquidacion: liq, nombre: 'E-001 · Andrés' } })
    expect(w.text()).toContain('Neto a pagar')
    expect(w.findAll('h4').map((h) => h.text())).toEqual(['Devengos', 'Deducciones', 'Provisiones (informativas)'])
    expect(w.text()).toContain('Salario básico')
    expect(w.text()).not.toContain('Ver el desprendible')
  })

  it('con desprendible ofrece verlo y lo emite', async () => {
    const w = mount(LiquidacionEmpleado, { props: { liquidacion: liq, nombre: 'E-001 · Andrés', conDesprendible: true } })
    await w.get('button').trigger('click')
    expect(w.emitted('desprendible')).toHaveLength(1)
  })
})

describe('LineaTiempoVersiones', () => {
  const v = (id: string, desde: string, salario: string | null): VersionContrato =>
    ({ ...condicionesVacias(), id, contrato_id: 'k', vigente_desde: desde, cargo: `Cargo ${id}`, salario, pensionado: false, creada_en: '' }) as VersionContrato

  it('la más reciente primero, marca la vigente y oculta el salario que no llega', async () => {
    const w = mount(LineaTiempoVersiones, { props: { versiones: [v('a', '2026-01-01', null), v('b', '2026-06-01', '2000000')], vigenteId: 'b', etiqueta: 'Versiones' } })
    await flushPromises()
    const items = w.findAll('li')
    expect(items[0]!.text()).toContain('Cargo b')
    expect(items[0]!.text()).toContain('Vigente')
    expect(items[0]!.text()).toMatch(/2\.000\.000/)
    expect(items[1]!.text()).not.toContain('$')
  })
})
