import { beforeEach, describe, expect, it } from 'vitest'
import { limpiar } from '@/api/tokens'
import * as u from '@/modulos/unidades/api'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const T1_101 = '01930000-0000-7000-8000-000000007001'
const T1_102 = '01930000-0000-7000-8000-000000007002'

beforeEach(async () => {
  limpiar(false)
  prepararConDemo()
  await useSesion().iniciar('admin', 'x')
  await useEntidad().entrar(PH)
})

describe('bienes y agrupaciones (demo)', () => {
  it('trae el árbol de 2 torres con 20 bienes cada una', async () => {
    const a = await u.arbol(PH)
    expect(a.agrupaciones.map((n) => [n.agrupacion.nombre, n.bienes_privados.length])).toEqual([
      ['Torre 1', 20],
      ['Torre 2', 20],
    ])
  })

  it('crea agrupación y bien; no repite códigos', async () => {
    const t3 = await u.crearAgrupacion(PH, { tipo: 'edificio', nombre: 'Torre 3', codigo: 'T3' }, 'k1')
    await expect(u.crearAgrupacion(PH, { tipo: 'edificio', nombre: 'Otra', codigo: 'T3' }, 'k2')).rejects.toMatchObject({ estado: 409 })
    const b = await u.crearBien(PH, { tipo: 'apartamento', agrupacion_id: t3.id, numero: '101' }, 'k3')
    expect(b.codigo).toBe('T3-101')
    await expect(u.crearBien(PH, { tipo: 'apartamento', agrupacion_id: t3.id, numero: '101' }, 'k4')).rejects.toMatchObject({ estado: 409 })
    expect((await u.listarBienes(PH, undefined, { agrupacionId: t3.id })).datos).toHaveLength(1)
    expect((await u.listarBienes(PH, undefined, { tipo: 'local' })).datos).toHaveLength(0)
  })

  it('edita, vincula como anexo, asigna usos exclusivos e inactiva', async () => {
    expect((await u.editarBien(PH, T1_102, { piso: 9 })).piso).toBe(9)
    expect((await u.vincularPrincipal(PH, T1_102, T1_101)).bien_principal_id).toBe(T1_101)
    await expect(u.vincularPrincipal(PH, T1_102, T1_102)).rejects.toMatchObject({ estado: 422 })
    const ficha = await u.fichaBien(PH, T1_101)
    expect(ficha.anexos.map((a) => a.codigo)).toEqual(['T1-102'])
    expect(ficha.usos_exclusivos).toHaveLength(1)
    const uso = await u.asignarUsoExclusivo(PH, T1_101, { tipo: 'deposito', codigo: 'D-07' }, 'k')
    await expect(u.asignarUsoExclusivo(PH, T1_102, { tipo: 'deposito', codigo: 'D-07' }, 'k2')).rejects.toMatchObject({ estado: 409 })
    await u.terminarUsoExclusivo(PH, T1_101, uso.id)
    expect((await u.fichaBien(PH, T1_101)).usos_exclusivos).toHaveLength(1)
    expect((await u.inactivarBien(PH, T1_102)).activo).toBe(false)
    expect((await u.listarBienes(PH, undefined, { q: 'T1-102' })).datos).toHaveLength(0)
    expect((await u.listarBienes(PH, undefined, { q: 'T1-102', incluirInactivos: true })).datos).toHaveLength(1)
  })
})

describe('titulares (demo)', () => {
  it('no registra sobre titulares vigentes; la transferencia reemplaza y cambia el representante', async () => {
    const antes = await u.titulares(PH, T1_101)
    expect(antes).toHaveLength(1)
    const nuevos = [
      { persona: { nombre: 'Ana', documento: '1' }, porcentaje: '50', es_representante: true },
      { persona: { nombre: 'Luis', documento: '2' }, porcentaje: '50' },
    ]
    await expect(u.registrarTitulares(PH, T1_101, nuevos, 'k1')).rejects.toMatchObject({ estado: 409 })
    await expect(u.transferir(PH, T1_101, [{ ...nuevos[0]!, porcentaje: '60' }], null, 'k2')).rejects.toMatchObject({ estado: 422 })
    await u.transferir(PH, T1_101, nuevos, null, 'k3')
    const despues = await u.titulares(PH, T1_101)
    const vigentes = despues.filter((t) => !t.titularidad.vigente_hasta)
    expect(vigentes.map((t) => t.nombre)).toEqual(['Ana', 'Luis'])
    await u.designarRepresentante(PH, T1_101, vigentes[1]!.titularidad.persona_id)
    expect((await u.titulares(PH, T1_101)).find((t) => t.titularidad.es_representante)?.nombre).toBe('Luis')
    await expect(u.designarRepresentante(PH, T1_101, 'otra')).rejects.toMatchObject({ estado: 422 })
  })
})

describe('coeficientes (demo)', () => {
  it('el borrador no suma 1 y no se activa; corregido, se activa y el vigente pasa a histórico', async () => {
    const lista = await u.cuadros(PH)
    const borrador = lista.find((c) => c.estado === 'borrador')!
    const d = await u.detalleCuadro(PH, borrador.id)
    expect(d.revision.valido).toBe(false)
    await expect(u.activarCuadro(PH, borrador.id)).rejects.toMatchObject({ estado: 422, codigo: 'coeficientes_no_suman_uno' })
    await expect(u.guardarCoeficientes(PH, borrador.id, [{ bien_privado_id: T1_101, coeficiente: 'x' }])).rejects.toMatchObject({ estado: 422 })
    const r = await u.guardarCoeficientes(PH, borrador.id, d.coeficientes.map((c) => ({ ...c, coeficiente: '0.025' })))
    expect(r.valido).toBe(true)
    expect((await u.validarCuadro(PH, borrador.id)).valido).toBe(true)
    expect((await u.activarCuadro(PH, borrador.id)).estado).toBe('vigente')
    expect((await u.cuadros(PH)).map((c) => c.estado)).toEqual(['vigente', 'historico'])
    await expect(u.guardarCoeficientes(PH, borrador.id, [])).rejects.toMatchObject({ estado: 409 })
    const nuevo = await u.crearCuadro(PH, true, 'Siguiente', 'k')
    expect((await u.detalleCuadro(PH, nuevo.id)).coeficientes).toHaveLength(40)
    await expect(u.crearCuadro(PH, false, null, 'k2')).rejects.toMatchObject({ estado: 409 })
  })
})

describe('censo (demo)', () => {
  it('residencias: registrar, autorizar reservas y terminar', async () => {
    const r = await u.registrarResidencia(PH, { bien_privado_id: T1_101, calidad: 'tenedor', persona: { nombre: 'Nuevo', documento: '9' } }, 'k')
    expect(r.persona.nombre).toBe('Nuevo')
    await u.autorizarReservas(PH, r.id, true)
    expect((await u.residencias(PH, T1_101)).find((x) => x.id === r.id)?.autorizado_por).toBeTruthy()
    await u.terminarResidencia(PH, r.id)
    expect((await u.residencias(PH, T1_101)).some((x) => x.id === r.id)).toBe(false)
    expect((await u.residencias(PH, T1_101, true)).some((x) => x.id === r.id)).toBe(true)
  })

  it('vehículos con placa única; retirado libera la placa', async () => {
    await expect(u.registrarVehiculo(PH, { bien_privado_id: T1_102, tipo: 'carro', placa: 'ABC123' }, 'k1')).rejects.toMatchObject({ estado: 409 })
    const [v] = await u.vehiculos(PH, { placa: 'abc' })
    await u.retirarVehiculo(PH, v!.id)
    expect((await u.registrarVehiculo(PH, { bien_privado_id: T1_102, tipo: 'carro', placa: 'ABC123' }, 'k2')).placa).toBe('ABC123')
  })

  it('mascotas, alertas y campañas', async () => {
    const m = await u.registrarMascota(PH, { bien_privado_id: T1_102, especie: 'gato', nombre: 'Michi' }, 'k')
    expect((await u.editarMascota(PH, m.id, { estado: 'trasladada' })).estado).toBe('trasladada')
    expect((await u.mascotas(PH)).some((x) => x.id === m.id)).toBe(false)
    const a = await u.alertasCenso(PH)
    expect(a.mascotas.map((x) => x.mascota.nombre).sort()).toEqual(['Firulais', 'Rocco'])
    const [c] = await u.campanas(PH)
    expect(c!.por_atender).toBe(2)
    const respuestas = await u.respuestasCampana(PH, c!.campana.id)
    await u.atenderRespuesta(PH, c!.campana.id, respuestas[0]!.persona_id, respuestas[0]!.bien_privado_id)
    expect((await u.campanas(PH))[0]!.por_atender).toBe(1)
    expect(await u.lanzarCampana(PH, 'k2')).toBe(39)
  })

  it('aprueba y rechaza propuestas; no dos veces', async () => {
    const [a, b] = await u.cambiosCenso(PH, 'pendiente')
    expect((await u.aprobarCambio(PH, a!.id)).estado).toBe('aprobado')
    await expect(u.aprobarCambio(PH, a!.id)).rejects.toMatchObject({ estado: 409 })
    expect((await u.rechazarCambio(PH, b!.id, 'Faltan soportes')).motivo).toBe('Faltan soportes')
    expect(await u.cambiosCenso(PH, 'pendiente')).toHaveLength(0)
  })
})

describe('personas, libros e importación (demo)', () => {
  it('busca y edita personas; un documento repetido da 409', async () => {
    const { datos } = await u.listarPersonas(PH, undefined, 'pedro')
    expect(datos[0]?.nombre).toBe('Pedro Pérez')
    expect((await u.editarPersona(PH, datos[0]!.id, { telefono: '301' })).telefono).toBe('301')
    await expect(u.editarPersona(PH, datos[0]!.id, { documento: '52123456' })).rejects.toMatchObject({ estado: 409 })
    expect((await u.persona(PH, datos[0]!.id)).nombre).toBe('Pedro Pérez')
    const pagina = await u.listarPersonas(PH, undefined)
    expect(pagina.datos).toHaveLength(43)
    expect(pagina.siguiente).toBeNull()
  })

  it('libros a una fecha de corte', async () => {
    expect((await u.libroPropietarios(PH, '2026-11-17')).length).toBe(40)
    expect((await u.libroResidentes(PH, '2026-11-17')).length).toBe(3)
  })

  it('importa con errores sin aplicar; corregida se confirma y crea los bienes', async () => {
    const mala = new File(['codigo,tipo,agrupacion,coeficiente,titular,documento\nT1-101,apartamento,T1,0.01,,\nT3-102,nave,T3,0.01,,\nT3-103,apartamento,T3,1.5,,\n'], 'b.csv')
    const p1 = await u.importarBienes(PH, mala)
    expect(p1.importacion.estado).toBe('con_errores')
    expect(p1.importacion.errores.map((e) => e.fila)).toEqual([2, 3, 4])
    await expect(u.confirmarImportacionBienes(PH, p1.importacion.id, 'k1')).rejects.toMatchObject({ estado: 409 })
    const buena = new File(['codigo,tipo,agrupacion,coeficiente,titular,documento\nT3-101,apartamento,T3,0.01,Ana,123\n'], 'b.csv')
    const p2 = await u.importarBienes(PH, buena)
    expect(p2.filas[0]).toMatchObject({ codigo: 'T3-101', agrupacion_nueva: true, titulares: 1 })
    expect((await u.confirmarImportacionBienes(PH, p2.importacion.id, 'k2')).estado).toBe('aplicada')
    expect((await u.listarBienes(PH, undefined, { q: 'T3-101' })).datos).toHaveLength(1)
    await expect(u.importarBienes(PH, new File(['x,y\n1,2'], 'm.csv'))).rejects.toMatchObject({ estado: 422 })
  })
})
