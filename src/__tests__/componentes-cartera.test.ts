import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { EstadoCuenta as TipoEstadoCuenta, Obligacion, VistaLiquidacion } from '@/api/tipos'
import EstadoCuenta from '@/hud/componentes/EstadoCuenta.vue'
import TablaEdades from '@/hud/componentes/TablaEdades.vue'
import VistaLiquidacionResumen from '@/modulos/cartera/componentes/VistaLiquidacion.vue'

function obligacion(id: string, periodo: string, valor: string, saldo: string, vencimiento: string, extra: Partial<Obligacion> = {}): Obligacion {
  return {
    id, bien_privado_id: 'b', concepto_cobro_id: 'adm', concepto_codigo: 'ADM', concepto_nombre: 'Cuota de administración', concepto_tipo: 'ordinaria', periodo, valor,
    vencimiento, deudor_persona_id: 'p', origen: 'liquidacion', estado: 'vigente', ajustes: '0.00', aplicado: String(Number(valor) - Number(saldo)), saldo, ...extra,
  }
}

const ESTADO: TipoEstadoCuenta = {
  bien: { id: 'b', codigo: 'T1-101', tipo: 'apartamento', activo: true, referencia_pago: '1000' },
  corte: '2026-11-19',
  obligaciones: [
    obligacion('o2', '2026-11-01', '350000.00', '350000.00', '2026-11-25'),
    obligacion('o1', '2026-10-01', '350000.00', '150000.00', '2026-10-10'),
    obligacion('o0', '2026-09-01', '350000.00', '0.00', '2026-09-10'),
    obligacion('anulada', '2026-08-01', '1.00', '1.00', '2026-08-10', { estado: 'anulada' }),
  ],
  pagos: [{ recibo_id: 'r', fecha: '2026-10-05', obligacion_id: 'o1', valor: '200000.00' }],
  saldo: '500000.00',
  vencido: '150000.00',
  anticipos: '0.00',
}

describe('EstadoCuenta', () => {
  it('muestra saldo, vencido y referencia; ordena por vencimiento y marca lo vencido', () => {
    const w = mount(EstadoCuenta, { props: { estado: ESTADO } })
    expect(w.text()).toContain('500.000,00')
    expect(w.text()).toContain('Referencia de pago')
    expect(w.text()).not.toContain('Anticipos')
    const filas = w.findAll('tbody tr')
    expect(filas).toHaveLength(3)
    expect(filas[0]?.text()).toContain('sep 2026')
    expect(filas[1]?.text()).toContain('Vencida')
    expect(filas[2]?.text()).not.toContain('Vencida')
    expect(w.get('section[aria-label="Pagos aplicados de T1-101"]').text()).toContain('200.000,00')
  })

  it('solo pendientes y con acciones por obligación (slot)', () => {
    const w = mount(EstadoCuenta, {
      props: { estado: { ...ESTADO, anticipos: '46500.00' }, soloPendientes: true },
      slots: { acciones: '<template #acciones="{ obligacion }"><button>Nota a {{ obligacion.id }}</button></template>' },
    })
    expect(w.findAll('tbody tr')).toHaveLength(2)
    expect(w.text()).toContain('Anticipos')
    expect(w.findAll('button').map((b) => b.text())).toEqual(['Nota a o1', 'Nota a o2'])
  })

  it('sin obligaciones lo dice', () => {
    expect(mount(EstadoCuenta, { props: { estado: { ...ESTADO, obligaciones: [], pagos: [] }, soloPendientes: true } }).text()).toContain('No hay obligaciones pendientes.')
  })
})

describe('TablaEdades', () => {
  const fila = (clave: string, nombre: string, total: string, mas: string) => ({ clave, nombre, corriente: '0.00', de_1_a_30: '0.00', de_31_a_60: '0.00', de_61_a_90: '0.00', mas_de_90: mas, total })

  it('deja vacíos los ceros, resalta la mora, agrega el total y permite enlazar el nombre', () => {
    const w = mount(TablaEdades, {
      props: { filas: [fila('a', 'T1-101', '700000.00', '700000.00')], total: fila('t', 'Total', '700000.00', '700000.00'), encabezado: 'Unidad' },
      slots: { nombre: '<template #nombre="{ fila }"><a href="#">{{ fila.nombre }}</a></template>' },
    })
    const filas = w.findAll('tbody tr')
    expect(filas).toHaveLength(2)
    expect(filas[0]?.find('a').text()).toBe('T1-101')
    expect(filas[0]?.findAll('.mora')).toHaveLength(1)
    expect(filas[1]?.find('a').exists()).toBe(false)
    expect(filas[1]?.text()).toContain('Total')
    expect(w.get('caption').text()).toBe('Cartera por edades')
  })
})

describe('VistaLiquidacion', () => {
  const vista: VistaLiquidacion = {
    periodo: '2026-11-01', vencimiento: '2026-11-10', politica_id: 'p', total: '4200000.00',
    por_concepto: [{ concepto_cobro_id: 'adm', codigo: 'ADM', nombre: 'Administración', total: '4200000.00' }],
    cobros: Array.from({ length: 12 }, (_, i) => ({ bien_privado_id: `b${i}`, bien_codigo: `T1-${101 + i}`, concepto_cobro_id: 'adm', concepto_codigo: 'ADM', origen: 'liquidacion' as const, valor: '350000.00' })),
    avisos: ['1 unidad no tiene referencia de pago.'],
  }

  it('resume el periodo, los avisos y las primeras unidades; se pueden ver todas', async () => {
    const w = mount(VistaLiquidacionResumen, { props: { vista } })
    expect(w.text()).toContain('noviembre de 2026')
    expect(w.text()).toContain('4.200.000,00')
    expect(w.get('ul[aria-label="Avisos de la liquidación"]').text()).toContain('referencia de pago')
    expect(w.get('ul[aria-label="Cobros por unidad"]').findAll('li')).toHaveLength(10)
    await w.get('button').trigger('click')
    expect(w.get('ul[aria-label="Cobros por unidad"]').findAll('li')).toHaveLength(12)
  })
})
