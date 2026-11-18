import { beforeEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { Escrutinio, Pregunta, TableroReunion } from '@/api/tipos'
import { limpiar } from '@/api/tokens'
import { proporcion } from '@/formato/decimales'
import { cuposDe, leerEscrutinio, participacion, textoDecision } from '@/formato/escrutinio'
import * as a from '@/modulos/asambleas/api'
import {
  accionesPregunta,
  borradorDe,
  borradorVacio,
  maximoSelecciones,
  opcionVacia,
  pasosActa,
  peticionPregunta,
  problemaSeleccion,
  textoRegla,
} from '@/modulos/asambleas/reglas'
import { aplicarTablero, useTableroEnVivo } from '@/modulos/asambleas/useTableroEnVivo'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const vid = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`

const conteo = (unidades: number) => ({ coeficiente: (unidades * 0.025).toFixed(8), unidades })
function escrutinio(extra: Partial<Escrutinio> = {}): Escrutinio {
  return {
    base_computo: 'coeficiente', habilitados: conteo(20), total: conteo(40), votantes: conteo(15), sin_votar: conteo(5),
    opciones: [
      { opcion_id: 'si', texto: 'Sí', en_blanco: false, votos: conteo(12), porcentaje_coeficiente: '60.0000', porcentaje_unidades: '60.0000', aprobada: true, aprobada_en_otra_base: true, cupos: null },
      { opcion_id: 'no', texto: 'No', en_blanco: false, votos: conteo(3), porcentaje_coeficiente: '15.0000', porcentaje_unidades: '15.0000', aprobada: null, aprobada_en_otra_base: null, cupos: null },
    ],
    decision: { decision: 'aprobada' }, advertencia_unidades: false, ...extra,
  }
}

describe('reglas de las votaciones', () => {
  const todo = { convocar: true, conducir: true }
  it('ofrece los botones según el estado de la pregunta y de la reunión', () => {
    expect(accionesPregunta({ estado: 'borrador' }, 'borrador', todo)).toEqual(['editar', 'eliminar'])
    expect(accionesPregunta({ estado: 'borrador' }, 'instalada', todo)).toEqual(['editar', 'eliminar', 'abrir'])
    expect(accionesPregunta({ estado: 'borrador' }, 'instalada', { convocar: true, conducir: false })).toEqual(['editar', 'eliminar'])
    expect(accionesPregunta({ estado: 'borrador' }, 'cerrada', todo)).toEqual([])
    expect(accionesPregunta({ estado: 'abierta' }, 'instalada', todo)).toEqual(['cerrar', 'anular'])
    expect(accionesPregunta({ estado: 'abierta' }, 'instalada', { convocar: true, conducir: false })).toEqual([])
    expect(accionesPregunta({ estado: 'cerrada' }, 'instalada', todo)).toEqual([])
  })

  it('valida la selección del voto como el backend', () => {
    const p = { tipo: 'seleccion_multiple', max_selecciones: 2, opciones: [{ id: 'a', en_blanco: false }, { id: 'b', en_blanco: false }, { id: 'c', en_blanco: false }] } as Pregunta
    expect(maximoSelecciones(p)).toBe(2)
    expect(maximoSelecciones({ tipo: 'si_no', max_selecciones: 1 })).toBe(1)
    expect(problemaSeleccion(p, [])).toBe('Elija una opción.')
    expect(problemaSeleccion(p, ['a', 'b'])).toBeNull()
    expect(problemaSeleccion(p, ['a', 'b', 'c'])).toBe('Elija como máximo 2 opciones.')
    const eleccion = { tipo: 'seleccion_multiple', max_selecciones: 2, opciones: [{ id: 'a', en_blanco: false }, { id: 'x', en_blanco: true }] } as Pregunta
    expect(problemaSeleccion(eleccion, ['a', 'x'])).toBe('El voto en blanco va solo.')
  })

  it('arma la petición de una pregunta y rechaza las incoherentes', () => {
    const b = { ...borradorVacio(), enunciado: '  ¿Aprueba el presupuesto?  ', con_abstencion: false }
    const r = peticionPregunta(b)
    expect('datos' in r && r.datos).toMatchObject({ enunciado: '¿Aprueba el presupuesto?', tipo: 'si_no', con_abstencion: false, opciones: undefined, regla_mayoria: { regla: 'simple' } })
    expect(peticionPregunta(borradorVacio())).toEqual({ error: 'Escriba la pregunta.' })
    const unica = { ...b, tipo: 'seleccion_unica' as const, opciones: [{ texto: 'A', candidatos: [] }, { texto: 'a', candidatos: [] }] }
    expect(peticionPregunta(unica)).toEqual({ error: 'Las opciones no pueden repetirse.' })
    expect(peticionPregunta({ ...unica, opciones: [{ texto: 'A', candidatos: [] }, opcionVacia()] })).toEqual({ error: 'Escriba al menos dos opciones.' })
    const multiple = { ...unica, tipo: 'seleccion_multiple' as const, opciones: [{ texto: 'A', candidatos: [] }, { texto: 'B', candidatos: [] }], max_selecciones: 3 }
    expect(peticionPregunta(multiple)).toEqual({ error: 'En selección múltiple se eligen de 2 a 2 opciones.' })
    expect(peticionPregunta({ ...b, mayoria: 'personalizada', umbral: 'sesenta' })).toEqual({ error: 'Escriba el umbral del reglamento (por ejemplo, 60).' })
    expect(peticionPregunta({ ...b, mayoria: 'personalizada', umbral: '120' })).toEqual({ error: 'El umbral va de más de 0 a 100 %.' })
    expect(peticionPregunta({ ...b, temporizador: '1,5' })).toEqual({ error: 'El temporizador va en segundos enteros (0 = sin temporizador).' })
    const umbral = peticionPregunta({ ...b, mayoria: 'personalizada', umbral: '60', sobre: 'total', temporizador: '90' })
    expect('datos' in umbral && umbral.datos).toMatchObject({ regla_mayoria: { regla: 'personalizada', porcentaje: '60', sobre: 'total' }, temporizador_segundos: 90 })
  })

  it('una elección lleva cupos, cargo, planchas con integrantes y el voto en blanco', () => {
    const b = { ...borradorVacio(), enunciado: 'Consejo', tipo: 'eleccion' as const, cupos: 3, cargo: 'consejero' as const, opciones: [{ texto: 'Plancha 1', candidatos: [{ id: 'p1', nombre: 'Ana' }] }] }
    const r = peticionPregunta(b)
    expect('datos' in r && r.datos).toMatchObject({
      cupos: 3, cargo: 'consejero', regla_mayoria: null,
      opciones: [{ texto: 'Plancha 1', candidatos: ['p1'] }, { texto: 'Voto en blanco', en_blanco: true }],
    })
    expect(peticionPregunta({ ...b, cupos: 0 })).toEqual({ error: 'Indique cuántos cupos se eligen.' })
    expect(peticionPregunta({ ...b, opciones: [opcionVacia()] })).toEqual({ error: 'Agregue al menos una plancha o candidato.' })
  })

  it('lleva una pregunta guardada al formulario sin perder los integrantes', () => {
    const p = {
      enunciado: 'Consejo', tipo: 'eleccion', tipo_voto: 'reservado', base_computo: 'unidades', regla_mayoria: { regla: 'simple' }, max_selecciones: 1, cupos: 2, cargo: 'consejero',
      punto_id: null, temporizador_segundos: 0,
      opciones: [{ id: 'b', orden: 2, texto: 'En blanco', en_blanco: true, candidatos: [] }, { id: 'a', orden: 1, texto: 'Plancha', en_blanco: false, candidatos: ['p1'] }],
    } as unknown as Pregunta
    const b = borradorDe(p)
    expect(b).toMatchObject({ tipo_voto: 'reservado', base: 'unidades', cupos: 2, cargo: 'consejero', con_blanco: true, temporizador: '0' })
    expect(b.opciones).toEqual([{ texto: 'Plancha', candidatos: [{ id: 'p1', nombre: '' }] }])
  })

  it('describe la regla de mayoría', () => {
    expect(textoRegla({ regla: 'simple' })).toContain('art. 45')
    expect(textoRegla({ regla: 'calificada_70' })).toContain('70 %')
    expect(textoRegla({ regla: 'personalizada', porcentaje: '60', sobre: 'presentes' })).toBe('60 % de los presentes')
    expect(textoRegla({ regla: 'personalizada', porcentaje: '60', sobre: 'total' })).toBe('60 % de la copropiedad')
  })

  it('el acta sigue sus pasos: generar → firmada → aprobar → publicar', () => {
    const r = (acta_estado: 'pendiente' | 'generada' | 'aprobada' | 'publicada', firmada: string | null = null, estado: 'cerrada' | 'instalada' = 'cerrada') =>
      pasosActa({ estado, acta_estado, acta_firmada_archivo_id: firmada })
    expect(r('pendiente', null, 'instalada')).toEqual([])
    expect(r('pendiente')).toEqual(['generar'])
    expect(r('generada')).toEqual(['firmada', 'generar'])
    expect(r('generada', 'x')).toEqual(['aprobar', 'firmada', 'generar'])
    expect(r('aprobada', 'x')).toEqual(['publicar'])
    expect(r('publicada', 'x')).toEqual([])
  })
})

describe('escrutinio', () => {
  it('acepta solo un escrutinio con lo que se muestra', () => {
    expect(leerEscrutinio(escrutinio())).not.toBeNull()
    expect(leerEscrutinio(null)).toBeNull()
    expect(leerEscrutinio({ opciones: [], decision: { decision: 'aprobada' } })).toBeNull()
    expect(leerEscrutinio({ ...escrutinio(), decision: 'aprobada' })).toBeNull()
  })

  it('dice qué se decidió en cada tipo de pregunta', () => {
    expect(textoDecision(escrutinio())).toEqual({ texto: 'Aprobada', tono: 'exito' })
    expect(textoDecision(escrutinio(), true).texto).toBe('Votación abierta: resultado parcial')
    expect(textoDecision(escrutinio({ decision: { decision: 'no_aprobada' } })).tono).toBe('peligro')
    expect(textoDecision(escrutinio({ decision: { decision: 'ganadora', opcion_id: 'no' } })).texto).toBe('Ganó «No»')
    expect(textoDecision(escrutinio({ decision: { decision: 'sin_ganadora', empate: true } })).texto).toContain('Empate')
    expect(textoDecision(escrutinio({ decision: { decision: 'sin_ganadora', empate: false } })).texto).toContain('Ninguna opción alcanzó')
    expect(textoDecision(escrutinio({ decision: { decision: 'por_opcion' } })).texto).toBe('Aprobadas: «Sí»')
    const ninguna = escrutinio({ decision: { decision: 'por_opcion' } })
    ninguna.opciones.forEach((o) => (o.aprobada = false))
    expect(textoDecision(ninguna).texto).toBe('Ninguna opción aprobada')
    const reparto = escrutinio({ decision: { decision: 'reparto', cociente: '5', empate: true, sin_asignar: 1, cupos: [{ opcion_id: 'si', por_cociente: 2, por_residuo: 1, residuo: '0.5' }] } })
    expect(textoDecision(reparto)).toEqual({ texto: 'Cupos repartidos por cociente electoral (empate en el último cupo; 1 cupo(s) sin asignar)', tono: 'aviso' })
    expect(cuposDe(reparto, 'si')).toBe(3)
    expect(cuposDe(reparto, 'no')).toBe(0)
    expect(cuposDe(escrutinio(), 'si')).toBeNull()
  })

  it('calcula la participación en la base de cómputo', () => {
    expect(participacion(escrutinio())).toBe('75.0')
    expect(participacion(escrutinio({ base_computo: 'unidades', habilitados: conteo(0) }))).toBe('0')
    expect(proporcion('0.3', '0.6')).toBe('50.00')
    expect(proporcion('1', '3', 4)).toBe('33.3333')
  })
})

describe('tablero en vivo', () => {
  const t = (reunion: string, generado: string) => ({ reunion: { id: reunion }, quorum: {}, preguntas_abiertas: [], generado_en: generado }) as unknown as TableroReunion

  it('cada mensaje reemplaza el tablero, salvo que sea de otra reunión, viejo o ilegible', () => {
    const viejo = t('r1', '2026-11-18T10:00:00Z')
    const nuevo = t('r1', '2026-11-18T10:00:01Z')
    expect(aplicarTablero(null, viejo, 'r1')).toBe(viejo)
    expect(aplicarTablero(viejo, nuevo, 'r1')).toBe(nuevo)
    expect(aplicarTablero(nuevo, viejo, 'r1')).toBe(nuevo)
    expect(aplicarTablero(viejo, t('r2', '2026-11-18T11:00:00Z'), 'r1')).toBe(viejo)
    expect(aplicarTablero(viejo, 'basura', 'r1')).toBe(viejo)
    expect(aplicarTablero(viejo, { reunion: { id: 'r1' } }, 'r1')).toBe(viejo)
  })

  it('la URL del socket usa ws/wss sin el token', () => {
    expect(a.urlEnVivo('ph', 'r1', 'https://api.dad.co/')).toBe('wss://api.dad.co/api/v1/copropiedades/ph/asambleas/r1/en-vivo')
    expect(a.urlEnVivo('ph', 'r 1', 'http://localhost:8080')).toBe('ws://localhost:8080/api/v1/copropiedades/ph/asambleas/r%201/en-vivo')
  })
})

describe('votaciones contra el demo', { timeout: 25_000 }, () => {
  const I = vid(4004)
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('uno', 'x')
    await useEntidad().entrar(PH)
  })

  it('crea, edita y quita preguntas en borrador con las reglas del backend', async () => {
    const B = vid(4001)
    const p = await a.crearPregunta(PH, B, { enunciado: '¿Aprueba el presupuesto?', tipo: 'si_no' }, 'q1')
    expect(p.opciones.map((o) => o.texto)).toEqual(['Sí', 'No', 'Abstención'])
    await expect(a.crearPregunta(PH, B, { enunciado: 'Vigilancia', tipo: 'seleccion_unica', opciones: [{ texto: 'A' }] }, 'q2')).rejects.toMatchObject({ estado: 422 })
    const e = await a.editarPregunta(PH, B, p.id, { enunciado: '¿Aprueba el presupuesto 2027?', tipo: 'si_no', con_abstencion: false })
    expect(e.opciones).toHaveLength(2)
    await a.borrarPregunta(PH, B, p.id)
    expect(await a.preguntas(PH, B)).toEqual([])
    await expect(a.cambiarPregunta(PH, B, (await a.crearPregunta(PH, B, { enunciado: 'X', tipo: 'si_no' }, 'q3')).id, 'abrir')).rejects.toMatchObject({ codigo: 'conflicto_estado' })
  })

  it('vota en la sala con idempotencia, una vez por bien y solo presentes', async () => {
    const lista = await a.preguntas(PH, I)
    const abierta = lista.find((p) => p.estado === 'abierta')!
    const si = abierta.opciones[0]!.id
    const nuevo = vid(4408)
    const v = await a.votar(PH, I, abierta.id, { asistente_id: nuevo, opciones: [si], canal: 'presencial' }, 'clave-1')
    expect(v).toMatchObject({ registrado: true, nombre: 'Titular T1-401', bienes: ['T1-401', 'T1-402'] })
    expect((await a.votar(PH, I, abierta.id, { asistente_id: nuevo, opciones: [si], canal: 'presencial' }, 'clave-1')).registrado).toBe(false)
    await expect(a.votar(PH, I, abierta.id, { asistente_id: nuevo, opciones: [si], canal: 'presencial' }, 'clave-2')).rejects.toMatchObject({ estado: 409, codigo: 'ya_voto' })
    await expect(a.votar(PH, I, abierta.id, { rotulo: 'NO-EXISTE', opciones: [si], canal: 'rotulo' }, 'clave-3')).rejects.toMatchObject({ estado: 403, codigo: 'no_inscrito' })
    await expect(a.votar(PH, I, abierta.id, { asistente_id: vid(4409), opciones: [], canal: 'presencial' }, 'clave-4')).rejects.toMatchObject({ estado: 422 })
    await a.asignarRotulo(PH, I, vid(4409), 'ASM-0009')
    expect((await a.votar(PH, I, abierta.id, { rotulo: 'ASM-0009', opciones: [si], canal: 'rotulo' }, 'clave-5')).bienes).toHaveLength(2)

    const t = await a.tablero(PH, I)
    expect(t.preguntas_abiertas.map((x) => x.pregunta.id)).toEqual([abierta.id])
    expect(leerEscrutinio(t.preguntas_abiertas[0]?.escrutinio)?.votantes.unidades).toBe(18)
    expect(t.ultima_cerrada?.pregunta.tipo_voto).toBe('reservado')
  })

  it('cierra con escrutinio, muestra el detalle y aplica la elección', async () => {
    const lista = await a.preguntas(PH, I)
    const abierta = lista.find((p) => p.estado === 'abierta')!
    expect((await a.cambiarPregunta(PH, I, abierta.id, 'cerrar')).estado).toBe('cerrada')
    const r = await a.resultados(PH, I, abierta.id)
    expect(leerEscrutinio(r.escrutinio)?.decision).toEqual({ decision: 'aprobada' })
    expect((await a.detalleVotos(PH, I, abierta.id)).length).toBe(14)
    await expect(a.votar(PH, I, abierta.id, { asistente_id: vid(4410), opciones: [abierta.opciones[0]!.id], canal: 'presencial' }, 'k')).rejects.toMatchObject({ codigo: 'conflicto_estado' })

    const consejo = lista.find((p) => p.tipo === 'eleccion')!
    await expect(a.aplicarEleccion(PH, I, consejo.id, null)).rejects.toMatchObject({ codigo: 'conflicto' })
    await a.cambiarPregunta(PH, I, consejo.id, 'abrir')
    await a.votar(PH, I, consejo.id, { asistente_id: vid(4401), opciones: [consejo.opciones[0]!.id], canal: 'presencial' }, 'e1')
    await a.cambiarPregunta(PH, I, consejo.id, 'cerrar')
    const elegidos = await a.aplicarEleccion(PH, I, consejo.id, null)
    expect(elegidos.map((e) => e.nombre)).toEqual(['Titular T1-101', 'Titular T1-201'])
    await expect(a.aplicarEleccion(PH, I, consejo.id, null)).rejects.toMatchObject({ codigo: 'conflicto' })

    const otra = lista.find((p) => p.tipo === 'seleccion_unica')!
    await expect(a.cambiarPregunta(PH, I, otra.id, 'anular')).rejects.toMatchObject({ estado: 422 })
    expect((await a.cambiarPregunta(PH, I, otra.id, 'anular', 'Se retiró la propuesta')).estado).toBe('anulada')
  })

  it('el acta se genera, se firma, se aprueba y se publica', async () => {
    const P = vid(4007)
    const datos = await a.vistaActa(PH, P)
    expect(datos.preguntas[0]?.decision).toBe('aprobada')
    expect(datos.asistentes).toHaveLength(12)
    await expect(a.avanzarActa(PH, P, 'aprobar')).rejects.toMatchObject({ estado: 409 })
    expect((await a.generarActa(PH, P)).acta_estado).toBe('generada')
    await expect(a.avanzarActa(PH, P, 'aprobar')).rejects.toMatchObject({ estado: 409 })
    expect((await a.avanzarActa(PH, P, 'firmada', vid(77))).acta_firmada_archivo_id).toBe(vid(77))
    expect((await a.avanzarActa(PH, P, 'aprobar')).acta_estado).toBe('aprobada')
    await expect(a.generarActa(PH, P)).rejects.toMatchObject({ estado: 409 })
    expect((await a.avanzarActa(PH, P, 'publicar')).acta_estado).toBe('publicada')
    expect((await a.actasPublicadas(PH)).map((r) => r.id)).toContain(P)
    await expect(a.generarActa(PH, I)).rejects.toMatchObject({ estado: 409 })
  })

  it('reportes de asistencia, canales y costo', async () => {
    const P = vid(4007)
    expect(await a.reporteAsistencia(PH, P)).toHaveLength(24)
    const [c] = await a.participacionPorCanal(PH, P)
    expect(c?.por_canal).toEqual({ presencial: 24 })
    expect((await a.costoWhatsapp(PH, P)).valor_estimado).toBe('2380.00')
  })

  it('el composable toma el tablero del socket y vuelve a consultar al perder la conexión', async () => {
    const sockets: { onopen?: () => void; onmessage?: (e: { data: string }) => void; onclose?: () => void; protocolos: string[]; close: () => void }[] = []
    const crear = (_u: string, protocolos: string[]) => {
      const s = { protocolos, close() {} }
      sockets.push(s)
      return s as unknown as WebSocket
    }
    const alcance = effectScope()
    const vivo = alcance.run(() => useTableroEnVivo(() => PH, () => I, { crear, cada: 60_000 }))!
    await esperarQue(() => vivo.estado.value === 'listo' && sockets.length === 1)
    expect(sockets[0]?.protocolos[0]).toBe('dad.v1')
    sockets[0]?.onopen?.()
    expect(vivo.conexion.value).toBe('conectado')
    const actual = vivo.tablero.value!
    const nuevo = { ...actual, hay_quorum: false, generado_en: new Date(Date.now() + 1000).toISOString() }
    sockets[0]?.onmessage?.({ data: JSON.stringify(nuevo) })
    expect(vivo.tablero.value?.hay_quorum).toBe(false)
    sockets[0]?.onclose?.()
    expect(vivo.conexion.value).toBe('reconectando')
    expect(vivo.enVivo.value).toBe(false)
    alcance.stop()
  })
})

async function esperarQue(condicion: () => boolean) {
  for (let i = 0; i < 50 && !condicion(); i++) {
    await nextTick()
    await new Promise((r) => setTimeout(r, 10))
  }
  expect(condicion()).toBe(true)
}
