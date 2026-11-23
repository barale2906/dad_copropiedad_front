import { describe, expect, it } from 'vitest'
import {
  accionesCampana,
  accionesCorte,
  campanaEditable,
  cambiosAnunciante,
  cuerpoAlta,
  erroresAlta,
  estadosSiguientes,
  exigeMetrica,
  type FormularioAlta,
  leerContenido,
  leerPuc,
  modulosDe,
  textoCobro,
  vigencia,
} from '@/modulos/plataforma/reglas'

const alta = (extra: Partial<FormularioAlta> = {}): FormularioAlta => ({
  tipo: 'propiedad_horizontal',
  nombre: 'Conjunto Los Pinos',
  nit: '900111222-3',
  administrador: 'nuevo',
  nuevo: { nombre: 'Ana Admin', correo: 'ana@pinos.co', usuario: '' },
  cuentaId: '',
  ...extra,
})

describe('alta de un cliente', () => {
  it('envía solo el administrador nuevo o solo la cuenta existente, nunca los dos', () => {
    const nuevo = cuerpoAlta(alta())
    expect(nuevo).toEqual({ nombre: 'Conjunto Los Pinos', nit: '900111222-3', administrador: { nombre: 'Ana Admin', correo: 'ana@pinos.co', usuario: null } })
    expect('administrador_cuenta_id' in nuevo).toBe(false)
    const existente = cuerpoAlta(alta({ administrador: 'existente', cuentaId: 'c1', nit: '' }))
    expect(existente).toEqual({ nombre: 'Conjunto Los Pinos', nit: null, administrador_cuenta_id: 'c1' })
    expect('administrador' in existente).toBe(false)
  })

  it('valida nombre, NIT, correo, usuario y la cuenta elegida', () => {
    expect(erroresAlta(alta())).toEqual({})
    const e = erroresAlta(alta({ nombre: 'X', nit: 'abc', nuevo: { nombre: '', correo: 'malo', usuario: 'Con Espacio' } }))
    expect(Object.keys(e).sort()).toEqual(['adminCorreo', 'adminNombre', 'adminUsuario', 'nit', 'nombre'])
    expect(erroresAlta(alta({ administrador: 'existente' }))).toEqual({ cuenta: expect.any(String) })
  })

  it('el ciclo de estados de una entidad', () => {
    expect(estadosSiguientes('en_configuracion')).toEqual(['activa', 'retirada'])
    expect(estadosSiguientes('activa')).toEqual(['suspendida', 'retirada'])
    expect(estadosSiguientes('suspendida')).toEqual(['activa', 'retirada'])
    expect(estadosSiguientes('retirada')).toEqual([])
  })

  it('a las empresas se les venden contabilidad, factura electrónica y nómina', () => {
    expect(modulosDe('empresa')).toEqual(['contabilidad', 'facturacion_electronica', 'nomina'])
    expect(modulosDe('propiedad_horizontal')).toContain('nomina')
    expect(modulosDe('propiedad_horizontal')).toContain('control_acceso')
  })
})

describe('publicidad', () => {
  it('cambios de estado de un comercio y cuáles piden motivo', () => {
    expect(cambiosAnunciante('pendiente').map((c) => [c.estado, c.motivo])).toEqual([['verificado', false], ['rechazado', true]])
    expect(cambiosAnunciante('verificado').map((c) => c.estado)).toEqual(['suspendido'])
    expect(cambiosAnunciante('suspendido').map((c) => c.estado)).toEqual(['verificado'])
    expect(cambiosAnunciante('rechazado').map((c) => c.estado)).toEqual(['pendiente'])
  })

  it('el ciclo de una campaña y cuándo se edita', () => {
    expect(accionesCampana('borrador').map((a) => a.accion)).toEqual(['enviar_a_revision'])
    expect(accionesCampana('rechazada').map((a) => a.accion)).toEqual(['enviar_a_revision'])
    expect(accionesCampana('aprobada').map((a) => a.accion)).toEqual(['activar', 'finalizar'])
    expect(accionesCampana('activa').map((a) => a.accion)).toEqual(['pausar', 'finalizar'])
    expect(accionesCampana('pausada').map((a) => a.accion)).toEqual(['activar', 'finalizar'])
    expect(accionesCampana('en_revision')).toEqual([])
    expect(accionesCampana('finalizada')).toEqual([])
    expect(campanaEditable('borrador')).toBe(true)
    expect(campanaEditable('activa')).toBe(false)
  })
})

describe('normativa', () => {
  it('vigencia de una versión respecto a hoy', () => {
    expect(vigencia({ vigente_desde: '2026-01-01', vigente_hasta: null }, '2026-06-01')).toBe('vigente')
    expect(vigencia({ vigente_desde: '2026-07-01' }, '2026-06-01')).toBe('futura')
    expect(vigencia({ vigente_desde: '2025-01-01', vigente_hasta: '2025-12-31' }, '2026-06-01')).toBe('vencida')
    expect(vigencia({ vigente_desde: '2026-06-01T00:00:00Z', vigente_hasta: '2026-06-01' }, '2026-06-01')).toBe('vigente')
  })

  it('lee el PUC pegado con encabezado, separadores y errores por fila', () => {
    const l = leerPuc('codigo,nombre,naturaleza\n110505,Caja general,debito\n\n2205;Proveedores;C\n11x,Mala,D\n4105,,credito\n5105,Gastos,otro\n110505,Repetida,D')
    expect(l.cuentas).toEqual([
      { codigo: '110505', nombre: 'Caja general', naturaleza: 'debito' },
      { codigo: '2205', nombre: 'Proveedores', naturaleza: 'credito' },
    ])
    expect(l.errores.map((e) => e.fila)).toEqual([5, 6, 7, 8])
  })

  it('el contenido de una plantilla debe ser un objeto JSON', () => {
    expect(leerContenido('{"cuentas": []}')).toEqual({ cuentas: [] })
    expect(leerContenido('[1]')).toBeNull()
    expect(leerContenido('no es json')).toBeNull()
    expect(leerContenido('null')).toBeNull()
  })
})

describe('cobros', () => {
  it('acciones de un corte por estado', () => {
    expect(accionesCorte('borrador')).toEqual(['aprobar', 'descartar'])
    expect(accionesCorte('aprobado')).toEqual(['facturar', 'factura_externa', 'descartar'])
    expect(accionesCorte('facturado')).toEqual(['pago'])
    expect(accionesCorte('pagado')).toEqual([])
    expect(accionesCorte('descartado')).toEqual([])
  })

  it('las tarifas por unidad, paquete o consumo exigen métrica', () => {
    expect(exigeMetrica('por_unidad')).toBe(true)
    expect(exigeMetrica('por_paquete')).toBe(true)
    expect(exigeMetrica('por_consumo')).toBe(true)
    expect(exigeMetrica('plana')).toBe(false)
    expect(exigeMetrica('unica')).toBe(false)
  })
})

describe('cobro al habilitar un módulo', () => {
  it('dice si se agregó la línea a la suscripción o si queda sin cobro', () => {
    expect(textoCobro({ linea_suscripcion_id: 'x' })).toBe('Se agregó a la suscripción.')
    expect(textoCobro({ linea_suscripcion_id: null })).toMatch(/^Sin cobro/)
    expect(textoCobro(null)).toMatch(/^Sin cobro/)
  })
})
