import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Reserva } from '@/api/tipos'
import { limpiar } from '@/api/tokens'
import {
  aprobarReserva,
  asignarParqueadero,
  buscarBienes,
  cambiarCobro,
  cambiarEstadoRecurso,
  cancelarReserva,
  codigoDeBien,
  crearParqueadero,
  crearRecurso,
  crearRestriccion,
  crearSorteo,
  detalleReserva,
  disponibilidad,
  editarRecurso,
  ejecutarSorteo,
  entregarReserva,
  facturarReserva,
  inscribirEnSorteo,
  levantarRestriccion,
  liberarParqueadero,
  listarParqueaderos,
  listarRecursos,
  listarReservas,
  listarRestricciones,
  listarSorteos,
  misBienes,
  noAsistio,
  obtenerCobro,
  obtenerRecurso,
  rechazarReserva,
  recibirReserva,
  registrarPago,
  reservar,
} from '@/modulos/zonas-comunes/api'
import {
  aValoresPolitica,
  dePolitica,
  esReservable,
  filtroDeZona,
  POLITICA_INICIAL,
  resumenPolitica,
  validarPolitica,
} from '@/modulos/zonas-comunes/recursos'
import { accionesDeReserva, admiteFactura, admitePagoManual, ordenarReservas, penalidadAlCancelar } from '@/modulos/zonas-comunes/reservas'
import { useZonasComunes } from '@/modulos/zonas-comunes/store'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const r = (x: Partial<Reserva>) => ({ estado: 'aprobada', estado_pago: 'pendiente', valor: '100.00', inicio: '2026-11-20T15:00:00Z', ...x }) as Reserva

describe('reglas de reservas', () => {
  it('ofrece botones según el estado', () => {
    expect(accionesDeReserva('solicitada')).toEqual(['aprobar', 'rechazar', 'cancelar'])
    expect(accionesDeReserva('aprobada')).toEqual(['entregar', 'no_asistio', 'cancelar'])
    expect(accionesDeReserva('en_curso')).toEqual(['recibir'])
    expect(accionesDeReserva('finalizada')).toEqual([])
  })

  it('el pago a mano solo con cobro manual; la factura solo con cobro por factura', () => {
    expect(admitePagoManual(r({}), 'manual')).toBe(true)
    expect(admitePagoManual(r({}), 'cartera')).toBe(false)
    expect(admitePagoManual(r({ estado: 'cancelada' }), 'manual')).toBe(false)
    expect(admitePagoManual(r({ estado_pago: 'pagado' }), 'manual')).toBe(false)
    expect(admiteFactura(r({}), 'factura')).toBe(true)
    expect(admiteFactura(r({ estado: 'solicitada' }), 'factura')).toBe(false)
    expect(admiteFactura(r({ valor: '0' }), 'factura')).toBe(false)
    expect(admiteFactura(r({}), 'manual')).toBe(false)
  })

  it('avisa la penalidad solo dentro del plazo y si la política la cobra', () => {
    const p = { cancelacion_sin_penalidad_horas: 24, penalidad_porcentaje: '20' }
    const ahora = new Date('2026-11-20T00:00:00Z')
    expect(penalidadAlCancelar(r({ valor: '150000.00' }), p, ahora)).toBe('30000.00')
    expect(penalidadAlCancelar(r({}), p, new Date('2026-11-18T00:00:00Z'))).toBeNull()
    expect(penalidadAlCancelar(r({}), { ...p, penalidad_porcentaje: '0' }, ahora)).toBeNull()
    expect(penalidadAlCancelar(r({ valor: '0' }), p, ahora)).toBeNull()
  })

  it('ordena: abiertas primero, de la más próxima a la más lejana', () => {
    const lista = [r({ id: 'a', estado: 'finalizada', inicio: '2026-11-01T00:00:00Z' }), r({ id: 'b', inicio: '2026-11-30T00:00:00Z' }), r({ id: 'c', estado: 'solicitada', inicio: '2026-11-21T00:00:00Z' })]
    expect(ordenarReservas(lista).map((x) => x.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('reglas de recursos', () => {
  it('traduce la zona de la maqueta a categorías o tipo', () => {
    expect(filtroDeZona('salon-social')?.categorias).toEqual(['salon_social', 'salon_comunal'])
    expect(filtroDeZona('parqueaderos')?.tipo).toBe('parqueadero')
    expect(filtroDeZona('marte')).toBeNull()
    expect(filtroDeZona(undefined)).toBeNull()
  })

  it('solo se reservan los recursos por franja', () => {
    expect(esReservable({ modo: 'franja_inmediata' })).toBe(true)
    expect(esReservable({ modo: 'franja_con_aprobacion' })).toBe(true)
    expect(esReservable({ modo: 'sorteo' })).toBe(false)
  })

  it('resume la política con costos, aforo y penalidad', () => {
    const lineas = resumenPolitica({ ...POLITICA_INICIAL, tarifa: '150000.00', deposito: '50000', aforo: 30, max_invitados: 5, penalidad_porcentaje: '20', max_reservas_mes: 2, tarifa_festivo: '200000.00', duracion_minima_min: 60, duracion_maxima_min: 60 })
    expect(lineas.join(' | ')).toMatch(/Tarifa: \$ 150\.000,00 por reserva/)
    expect(lineas.join(' | ')).toMatch(/En festivos/)
    expect(lineas.join(' | ')).toMatch(/Depósito/)
    expect(lineas.join(' | ')).toMatch(/Aforo: 30/)
    expect(lineas.join(' | ')).toMatch(/20 % del valor/)
    expect(lineas.join(' | ')).toMatch(/Duración: 1 h/)
    expect(resumenPolitica(POLITICA_INICIAL)).toContain('Sin costo')
  })

  it('la política va y vuelve del formulario y se valida', () => {
    const v = aValoresPolitica(POLITICA_INICIAL)
    expect(v.duracion_minima_min).toBe('60')
    expect(v.aforo).toBe('')
    expect(dePolitica(v)).toEqual(POLITICA_INICIAL)
    expect(validarPolitica(v)).toEqual({})
    const malos = validarPolitica({ ...v, duracion_maxima_min: '30', granularidad_min: '0', aforo: 'x', tarifa: 'abc', penalidad_porcentaje: '150', tarifa_festivo: 'z', alistamiento_min: '' })
    expect(Object.keys(malos).sort()).toEqual(['aforo', 'alistamiento_min', 'duracion_maxima_min', 'granularidad_min', 'penalidad_porcentaje', 'tarifa', 'tarifa_festivo'])
    expect(validarPolitica({ ...v, duracion_minima_min: '0', duracion_maxima_min: '0' }).duracion_minima_min).toBeTruthy()
  })
})

describe('api de zonas comunes (demo)', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('admin', 'x')
  })

  it('lista recursos por categoría y tipo, y calcula la disponibilidad', async () => {
    expect((await listarRecursos(PH, { categoria: 'piscina' })).map((x) => x.nombre)).toEqual(['Piscina'])
    expect((await listarRecursos(PH, { tipo: 'parqueadero' })).length).toBe(4)
    const piscina = (await listarRecursos(PH, { categoria: 'piscina' }))[0]!
    expect((await obtenerRecurso(PH, piscina.id)).nombre).toBe('Piscina')
    const hoy = new Date().toISOString().slice(0, 10)
    const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    const libres = await disponibilidad(PH, piscina.id, manana, manana)
    expect(libres.length).toBeGreaterThan(0)
    await expect(disponibilidad(PH, piscina.id, manana, hoy)).rejects.toMatchObject({ estado: 422 })
  })

  it('reserva y responde aprobada; la misma clave no duplica; una franja ocupada da 409', async () => {
    const [piscina] = await listarRecursos(PH, { categoria: 'piscina' })
    const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    const [franja] = await disponibilidad(PH, piscina!.id, manana, manana)
    const [bien] = await misBienes(PH)
    const datos = { recurso_id: piscina!.id, bien_privado_id: bien!.id, inicio: franja!.inicio, fin: new Date(Date.parse(franja!.inicio) + 3_600_000).toISOString() }
    const a = await reservar(PH, datos, 'clave-1')
    expect(a.estado).toBe('aprobada')
    expect((await reservar(PH, datos, 'clave-1')).id).toBe(a.id)
    await expect(reservar(PH, datos, 'clave-2')).rejects.toMatchObject({ estado: 409 })
    await expect(reservar(PH, { ...datos, fin: datos.inicio }, 'clave-3')).rejects.toMatchObject({ estado: 422 })
    expect((await listarReservas(PH, { mias: true })).some((x) => x.id === a.id)).toBe(true)
    expect((await detalleReserva(PH, a.id)).reserva.id).toBe(a.id)
  })

  it('un bien restringido no puede reservar', async () => {
    const [salon] = await listarRecursos(PH, { categoria: 'salon_comunal' })
    const restringido = (await listarRestricciones(PH))[0]!.bien_privado_id
    const inicio = new Date(Date.now() + 5 * 86_400_000).toISOString()
    const datos = { recurso_id: salon!.id, bien_privado_id: restringido, inicio, fin: new Date(Date.parse(inicio) + 7_200_000).toISOString() }
    await expect(reservar(PH, datos, 'k')).rejects.toMatchObject({ estado: 422, codigo: 'validacion' })
  })

  it('recorre el ciclo: aprobar, entregar, recibir con novedad; y rechaza transiciones inválidas', async () => {
    const [pendiente] = await listarReservas(PH, { estado: 'solicitada' })
    const aprobada = await aprobarReserva(PH, pendiente!.id)
    expect(aprobada.estado).toBe('aprobada')
    await expect(aprobarReserva(PH, pendiente!.id)).rejects.toMatchObject({ estado: 409 })
    expect((await entregarReserva(PH, aprobada.id, {})).estado).toBe('en_curso')
    expect((await recibirReserva(PH, aprobada.id, { novedad: 'Vidrio roto', valor_danos: '50000' })).estado).toBe('con_novedad')
    const [otra] = await listarReservas(PH, { estado: 'solicitada' })
    expect((await rechazarReserva(PH, otra!.id, 'No cumple')).estado).toBe('rechazada')
  })

  it('marca no asistió y cancela', async () => {
    const aprobadas = await listarReservas(PH, { estado: 'aprobada' })
    expect((await noAsistio(PH, aprobadas[0]!.id)).estado).toBe('no_asistio')
    expect((await cancelarReserva(PH, aprobadas[1]!.id, 'Viaje')).estado).toBe('cancelada')
  })

  it('el pago a mano y la factura dependen de cómo se cobra el recurso', async () => {
    const [salon] = await listarRecursos(PH, { categoria: 'salon_comunal' })
    const conValor = (await listarReservas(PH)).find((x) => x.recurso_id === salon!.id)!
    expect((await registrarPago(PH, conValor.id, 'pagado')).estado_pago).toBe('pagado')
    await expect(facturarReserva(PH, conValor.id)).rejects.toMatchObject({ estado: 422 })
    expect((await obtenerCobro(PH, salon!.id)).destino).toBe('manual')
    await expect(cambiarCobro(PH, salon!.id, { destino: 'factura' })).rejects.toMatchObject({ estado: 422 })
    await cambiarCobro(PH, salon!.id, { destino: 'factura', item_facturacion_id: 'item' })
    expect(await facturarReserva(PH, conValor.id)).toBeTruthy()
    await expect(registrarPago(PH, conValor.id, 'pagado')).rejects.toMatchObject({ estado: 422 })
  })

  it('crea y edita recursos; cerrarlo cancela reservas futuras', async () => {
    const nuevo = await crearRecurso(PH, { tipo: 'bien_comun', nombre: 'Terraza', politica: POLITICA_INICIAL, bien_comun: { categoria: 'terraza' } }, 'k')
    expect(nuevo.estado).toBe('disponible')
    expect((await editarRecurso(PH, nuevo.id, { nombre: 'Terraza norte' })).nombre).toBe('Terraza norte')
    const [salon] = await listarRecursos(PH, { categoria: 'salon_social' })
    expect(await cambiarEstadoRecurso(PH, salon!.id, 'en_mantenimiento', 'Pintura')).toBeGreaterThan(0)
  })

  it('restringe un bien y levanta la restricción', async () => {
    const bienes = (await buscarBienes(PH, 't1')).datos
    expect(bienes.map((b) => b.codigo)).toEqual(['T1-101', 'T1-102', 'T1-201'])
    expect(await codigoDeBien(PH, bienes[0]!.id)).toBe('T1-101')
    const nueva = await crearRestriccion(PH, { bien_privado_id: bienes[1]!.id, motivo: 'Sanción' }, 'k1')
    expect((await listarRestricciones(PH)).length).toBe(2)
    await levantarRestriccion(PH, nueva.id)
    expect((await listarRestricciones(PH)).length).toBe(1)
  })

  it('crea un cupo, lo asigna sin duplicar y lo libera', async () => {
    const bienes = (await buscarBienes(PH, 't1')).datos
    const cupo = await crearParqueadero(PH, { codigo: 'C-09', tipo_vehiculo: 'carro', naturaleza: 'comunal' }, 'k2')
    await expect(crearParqueadero(PH, { codigo: 'C-09', tipo_vehiculo: 'carro', naturaleza: 'comunal' }, 'k3')).rejects.toMatchObject({ estado: 409 })
    const a = await asignarParqueadero(PH, cupo.id, { bien_privado_id: bienes[0]!.id, origen: 'manual' }, 'k4')
    await expect(asignarParqueadero(PH, cupo.id, { bien_privado_id: bienes[1]!.id, origen: 'manual' }, 'k5')).rejects.toMatchObject({ estado: 409 })
    expect((await listarParqueaderos(PH)).find((p) => p.recurso.id === cupo.id)?.asignacion?.id).toBe(a.id)
    await liberarParqueadero(PH, a.id)
    expect((await listarParqueaderos(PH)).find((p) => p.recurso.id === cupo.id)?.asignacion).toBeNull()
  })

  it('el sorteo publica el compromiso, inscribe sin repetir y revela la semilla al ejecutar', async () => {
    const bienes = (await buscarBienes(PH, 't1')).datos
    const [sorteo] = await listarSorteos(PH)
    expect(sorteo!.semilla).toBeNull()
    await inscribirEnSorteo(PH, sorteo!.id, bienes[0]!.id, true)
    await expect(inscribirEnSorteo(PH, sorteo!.id, bienes[0]!.id, false)).rejects.toMatchObject({ estado: 409 })
    const resultado = await ejecutarSorteo(PH, sorteo!.id)
    expect(resultado.sorteo.semilla).toBeTruthy()
    expect(resultado.asignaciones.length).toBe(3)
    await expect(ejecutarSorteo(PH, sorteo!.id)).rejects.toMatchObject({ estado: 409 })
    const s = await crearSorteo(PH, { nombre: 'Motos', recursos: sorteo!.recursos, vigencia_desde: '2027-01-01T05:00:00Z', vigencia_hasta: '2027-12-31T05:00:00Z' }, 'k6')
    expect(s.compromiso).toBeTruthy()
    await expect(crearSorteo(PH, { nombre: 'Vacío', recursos: [], vigencia_desde: '2027-01-01T05:00:00Z', vigencia_hasta: '2027-12-31T05:00:00Z' }, 'k7')).rejects.toMatchObject({ estado: 422 })
  })
})

describe('store de zonas comunes', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('admin', 'x')
  })

  it('carga los recursos una vez por entidad y resuelve nombres', async () => {
    const z = useZonasComunes()
    const lista = await z.asegurarRecursos(PH)
    expect(lista.length).toBeGreaterThan(5)
    expect(z.nombreRecurso(lista[0]!.id)).toBe(lista[0]!.nombre)
    expect(z.nombreRecurso('otro')).toBe('Recurso')
    z.recordarRecurso({ ...lista[0]!, nombre: 'Renombrado' })
    expect(z.recurso(lista[0]!.id)?.nombre).toBe('Renombrado')
    expect(await z.asegurarRecursos(PH)).toBe(z.recursos)
  })

  it('resuelve códigos de bienes solo con permiso y recuerda los propios', async () => {
    const z = useZonasComunes()
    const [propio] = await z.asegurarPropios(PH)
    expect(z.codigoBien(propio!.id)).toBe('T1-101')
    const otro = '01930000-0000-7000-8000-000000007003'
    await z.resolverBienes(PH, [otro], false)
    expect(z.codigoBien(otro)).toBe('Bien')
    await z.resolverBienes(PH, [otro, 'no-existe'], true)
    expect(z.codigoBien(otro)).toBe('T1-201')
    expect(z.codigoBien('no-existe')).toBe('Bien')
  })

  it('resuelve varios bienes en paralelo sin perder ninguno', async () => {
    const z = useZonasComunes()
    const ids = [7002, 7003, 7004, 7005].map((n) => `01930000-0000-7000-8000-00000000${n}`)
    await z.resolverBienes(PH, ids, true)
    expect(ids.map((b) => z.codigoBien(b))).toEqual(['T1-102', 'T1-201', 'T2-301', 'T2-302'])
  })

  it('guarda cómo se cobra cada recurso y cambia de entidad sin mezclar datos', async () => {
    const z = useZonasComunes()
    const [r] = await z.asegurarRecursos(PH)
    expect((await z.cobroDe(PH, r!.id))?.destino).toBe('manual')
    z.recordarCobro(r!.id, { destino: 'cartera' })
    expect((await z.cobroDe(PH, r!.id))?.destino).toBe('cartera')
    expect(await z.cobroDe(PH, 'no-existe')).toBeNull()
    setActivePinia(createPinia())
  })
})
