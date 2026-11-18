import { describe, expect, it } from 'vitest'
import type { OrdenTrabajo } from '@/api/tipos'
import { accionesVisibles, SECCIONES } from '@/escena/mapa-modulos'
import {
  accionesComunicado,
  accionesOrden,
  audienciaCompleta,
  etiquetaMotivo,
  ordenAtrasada,
  pideDestino,
  pideMotivo,
  resumenLectura,
  textoPeriodicidad,
  textoRecurrencia,
  ticketPendiente,
} from '@/modulos/administracion/reglas'

const YO = 'cuenta-yo'
const OTRA = 'cuenta-otra'
const orden = (x: Partial<OrdenTrabajo>) => ({ estado: 'programada', asignado: null, ejecutada_por: null, ...x }) as OrdenTrabajo
const todo = { cuentaId: YO, planificar: true, ejecutar: true, verificar: true }

describe('órdenes de trabajo', () => {
  it('quien planifica inicia, ejecuta y cancela según el estado', () => {
    expect(accionesOrden(orden({}), todo)).toEqual(['iniciar', 'cancelar'])
    expect(accionesOrden(orden({ estado: 'en_ejecucion' }), todo)).toEqual(['ejecutar', 'evidencias', 'cancelar'])
    expect(accionesOrden(orden({ estado: 'verificada' }), todo)).toEqual([])
    expect(accionesOrden(orden({ estado: 'cancelada' }), todo)).toEqual([])
  })

  it('cuatro ojos: quien ejecutó no verifica aunque tenga el permiso', () => {
    expect(accionesOrden(orden({ estado: 'ejecutada', ejecutada_por: YO }), todo)).toEqual([])
    expect(accionesOrden(orden({ estado: 'ejecutada', ejecutada_por: OTRA }), todo)).toEqual(['verificar'])
    expect(accionesOrden(orden({ estado: 'ejecutada', ejecutada_por: OTRA }), { ...todo, verificar: false })).toEqual([])
    expect(accionesOrden(orden({ estado: 'ejecutada', ejecutada_por: OTRA }), { ...todo, cuentaId: null })).toEqual([])
  })

  it('quien solo ejecuta opera las órdenes que tiene asignadas', () => {
    const tecnico = { cuentaId: YO, planificar: false, ejecutar: true, verificar: false }
    expect(accionesOrden(orden({ asignado: { cuenta_id: YO } }), tecnico)).toEqual(['iniciar'])
    expect(accionesOrden(orden({ asignado: { cuenta_id: OTRA } }), tecnico)).toEqual([])
    expect(accionesOrden(orden({}), tecnico)).toEqual([])
  })

  it('una orden atrasada es la programada para antes de hoy y sin terminar', () => {
    expect(ordenAtrasada({ estado: 'programada', programada_para: '2026-11-10' }, '2026-11-17')).toBe(true)
    expect(ordenAtrasada({ estado: 'en_ejecucion', programada_para: '2026-11-10' }, '2026-11-17')).toBe(true)
    expect(ordenAtrasada({ estado: 'ejecutada', programada_para: '2026-11-10' }, '2026-11-17')).toBe(false)
    expect(ordenAtrasada({ estado: 'programada', programada_para: '2026-11-17' }, '2026-11-17')).toBe(false)
  })

  it('describe recurrencias y periodicidades', () => {
    expect(textoRecurrencia({ frecuencia: 'meses', intervalo: 1, inicio: '2026-01-01' })).toBe('Cada mes')
    expect(textoRecurrencia({ frecuencia: 'semanas', intervalo: 2, inicio: '2026-01-01' })).toBe('Cada 2 semanas')
    expect(textoPeriodicidad(1)).toBe('Cada mes')
    expect(textoPeriodicidad(12)).toBe('Cada 12 meses')
  })
})

describe('tickets', () => {
  it('resolver, rechazar y pedir información exigen el motivo', () => {
    expect(pideMotivo('resuelto')).toBe(true)
    expect(pideMotivo('rechazado')).toBe(true)
    expect(pideMotivo('en_espera_solicitante')).toBe(true)
    expect(pideMotivo('en_progreso')).toBe(false)
    expect(etiquetaMotivo('resuelto')).toBe('Respuesta al solicitante')
    expect(etiquetaMotivo('en_progreso')).toBe('Motivo (opcional)')
  })

  it('reconoce los pendientes', () => {
    expect(ticketPendiente('abierto')).toBe(true)
    expect(ticketPendiente('reabierto')).toBe(true)
    expect(ticketPendiente('resuelto')).toBe(false)
    expect(ticketPendiente('duplicado')).toBe(false)
  })
})

describe('comunicados', () => {
  it('lo enviado no se edita ni se anula; un programado se retira', () => {
    expect(accionesComunicado('borrador')).toEqual(['editar', 'publicar', 'anular'])
    expect(accionesComunicado('programado')).toEqual(['retirar', 'anular'])
    expect(accionesComunicado('enviado')).toEqual([])
    expect(accionesComunicado('anulado')).toEqual([])
  })

  it('las audiencias de lista exigen al menos un elegido', () => {
    expect(audienciaCompleta({ tipo: 'todos' })).toBe(true)
    expect(audienciaCompleta({ tipo: 'agrupaciones', ids: [] })).toBe(false)
    expect(audienciaCompleta({ tipo: 'bienes' })).toBe(false)
    expect(audienciaCompleta({ tipo: 'roles', ids: ['r'] })).toBe(true)
  })

  it('resume la lectura', () => {
    expect(resumenLectura({ destinatarios: 40, leidos: 31 })).toBe('31 de 40 lo leyeron (78 %)')
    expect(resumenLectura({ destinatarios: 0, leidos: 0 })).toBe('Aún sin destinatarios')
  })
})

describe('inventario y mapa', () => {
  it('traslados y préstamos piden el destino', () => {
    expect(pideDestino('traslado')).toBe(true)
    expect(pideDestino('prestamo')).toBe(true)
    expect(pideDestino('baja')).toBe(false)
  })

  it('las citas dependen de las reservas aunque la sección sea administración', () => {
    const c = (modulos: string[]) => ({ tieneModulo: (m: string) => modulos.includes(m), tienePermiso: () => true, esPH: true })
    const ids = (m: string[]) => accionesVisibles(SECCIONES.administracion!, c(m) as never).map((a) => a.id)
    expect(ids(['gestion_administrativa'])).not.toContain('citas')
    expect(ids(['gestion_administrativa', 'bienes_comunes'])).toContain('citas')
    expect(ids(['gestion_administrativa'])[0]).toBe('tablero')
  })
})
