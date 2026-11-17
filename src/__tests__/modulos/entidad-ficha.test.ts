import { beforeEach, describe, expect, it } from 'vitest'
import type { DatosCopropiedad } from '@/api/tipos'
import { limpiar } from '@/api/tokens'
import {
  cambiarHorario,
  crearPuntoAtencion,
  editarCopropiedad,
  editarEntidad,
  fichaCopropiedad,
  fichaEntidad,
  listarAuditoria,
  miSuscripcion,
  puntosAtencion,
} from '@/modulos/entidad/api'
import { aConsulta, detalleLegible, resultadoVisible, textoActor } from '@/modulos/entidad/auditoria'
import { aValores, cambiosDeFicha, validarFicha, zonaValida } from '@/modulos/entidad/ficha'
import { aHoraCompleta, normalizarHorario, resumirHorario, validarHorario } from '@/modulos/entidad/horario'
import { corteVencido, finDePrueba, sumarDias, textoCiclo, ultimoDia } from '@/modulos/entidad/suscripcion'
import { useEntidad } from '@/stores/entidad'
import { useSesion } from '@/stores/sesion'
import { conRespuesta, prepararConDemo } from '../ayudantes'

const PH = '01930000-0000-7000-8000-000000000001'
const EMPRESA = '01930000-0000-7000-8000-000000000003'

describe('horario', () => {
  it('valida días, horas y excepciones', () => {
    expect(validarHorario({ franjas: [{ dia: 1, inicio: '08:00', fin: '12:00' }] })).toEqual([])
    expect(validarHorario({ franjas: [{ dia: 0, inicio: '08:00', fin: '12:00' }] })).toEqual(['Franja 1: elija el día.'])
    expect(validarHorario({ franjas: [{ dia: 1, inicio: '12:00', fin: '08:00:00' }] })[0]).toContain('posterior')
    expect(validarHorario({ franjas: [{ dia: 1, inicio: '', fin: '' }] })[0]).toContain('inicio y la de fin')
    expect(validarHorario({ excepciones: [{ fecha: '', inicio: '08:00', fin: null }] })).toHaveLength(2)
    expect(validarHorario({ excepciones: [{ fecha: '2026-12-24', inicio: '10:00', fin: '09:00' }] })[0]).toContain('posterior')
    expect(validarHorario({ excepciones: [{ fecha: '2026-12-24' }] })).toEqual([])
  })

  it('normaliza horas con segundos, ordena franjas y limpia el motivo', () => {
    const h = normalizarHorario({
      franjas: [
        { dia: 3, inicio: '14:00', fin: '18:00' },
        { dia: 1, inicio: '08:00:00', fin: '12:00' },
      ],
      excepciones: [{ fecha: '2026-12-24', inicio: '', fin: '', motivo: '  ' }],
    })
    expect(h.franjas!.map((f) => [f.dia, f.inicio, f.fin])).toEqual([
      [1, '08:00:00', '12:00:00'],
      [3, '14:00:00', '18:00:00'],
    ])
    expect(h.excepciones).toEqual([{ fecha: '2026-12-24', inicio: null, fin: null, motivo: null }])
    expect(aHoraCompleta('07:30:15')).toBe('07:30:15')
  })

  it('resume días seguidos con las mismas franjas', () => {
    const semana = [1, 2, 3, 4, 5].map((dia) => ({ dia, inicio: '08:00:00', fin: '12:00:00' }))
    const r = resumirHorario({ franjas: [...semana, { dia: 6, inicio: '09:00:00', fin: '11:00:00' }] })
    expect(r).toHaveLength(2)
    expect(r[0]).toMatch(/^Lun–Vie /)
    expect(r[1]).toMatch(/^Sáb /)
    expect(resumirHorario({ franjas: [1, 3].map((dia) => ({ dia, inicio: '08:00', fin: '09:00' })) })[0]).toMatch(/^Lun, Mié /)
    expect(resumirHorario({})).toEqual(['Sin horario'])
  })
})

describe('ficha', () => {
  const base = {
    nombre: 'Los Robles', nit: null, tipo: 'residencial', forma: 'conjunto', estrato: 4,
    zona_horaria: 'America/Bogota', estado: 'activa', plantilla_codigo: '{numero}',
  } as DatosCopropiedad

  it('envía solo lo que cambió (vacío = null; estrato como número)', () => {
    const original = aValores(base)
    expect(original.estrato).toBe('4')
    expect(original.nit).toBe('')
    const editado = { ...original, nombre: ' Los Robles II ', correo: 'a@b.co', estrato: '5', tipo: 'mixta' }
    expect(cambiosDeFicha(original, editado, true)).toEqual({ nombre: 'Los Robles II', correo: 'a@b.co', estrato: 5, tipo: 'mixta' })
    expect(cambiosDeFicha(original, { ...original, estrato: '' }, true)).toEqual({ estrato: null })
    expect(cambiosDeFicha(original, original, true)).toEqual({})
  })

  it('en una empresa no envía los campos de la PH', () => {
    const original = aValores(base)
    expect(cambiosDeFicha(original, { ...original, estrato: '2', telefono: '300' }, false)).toEqual({ telefono: '300' })
  })

  it('valida nombre, zona, correo, estrato y plantilla', () => {
    const v = aValores(base)
    expect(validarFicha(v, true)).toEqual({})
    const e = validarFicha({ ...v, nombre: ' ', zona_horaria: 'Marte/Olimpo', correo: 'x', estrato: '9', plantilla_codigo: '{ruta}' }, true)
    expect(Object.keys(e).sort()).toEqual(['correo', 'estrato', 'nombre', 'plantilla_codigo', 'zona_horaria'])
    expect(validarFicha({ ...v, estrato: '9' }, false)).toEqual({})
    expect(zonaValida('America/Bogota')).toBe(true)
    expect(zonaValida('')).toBe(false)
  })
})

describe('suscripción', () => {
  it('describe el ciclo de cobro', () => {
    expect(textoCiclo(null)).toBe('Por evento')
    expect(textoCiclo(1)).toBe('Mensual')
    expect(textoCiclo(12)).toBe('Anual')
    expect(textoCiclo(3)).toBe('Cada 3 meses')
  })

  it('calcula fechas de calendario sin zonas', () => {
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01')
    expect(ultimoDia('2026-11-01')).toBe('2026-10-31')
    expect(finDePrueba({ inicio: '2026-01-01', dias_prueba: 30 })).toBe('2026-01-31')
    expect(finDePrueba({ inicio: '2026-01-01', dias_prueba: 0 })).toBeNull()
  })

  it('una factura sin pagar después del vencimiento está vencida', () => {
    expect(corteVencido({ estado: 'facturado', vencimiento: '2026-11-16' }, '2026-11-17')).toBe(true)
    expect(corteVencido({ estado: 'facturado', vencimiento: '2026-11-16' }, '2026-11-16')).toBe(false)
    expect(corteVencido({ estado: 'pagado', vencimiento: '2026-11-16' }, '2026-11-17')).toBe(false)
  })
})

describe('auditoría', () => {
  it('muestra quién actuó sin datos personales', () => {
    expect(textoActor(null, 'yo')).toBe('Sistema')
    expect(textoActor('yo', 'yo')).toBe('Usted')
    expect(textoActor('otro', 'yo')).toBe('Otra cuenta')
    expect(resultadoVisible('ok').tono).toBe('exito')
    expect(resultadoVisible('raro')).toEqual({ texto: 'raro', tono: 'neutro' })
    expect(detalleLegible({} as Record<string, never>)).toBeNull()
    expect(detalleLegible({ rol: 'x' } as unknown as Record<string, never>)).toContain('"rol"')
  })

  it('arma la consulta con días completos en la zona de la entidad', () => {
    const c = aConsulta({ accion: ' acceso. ', desde: '2026-11-01', hasta: '2026-11-15', soloMias: true }, 'America/Bogota', 'yo')
    expect(c).toEqual({ accion: 'acceso.', actorId: 'yo', desde: '2026-11-01T05:00:00Z', hasta: '2026-11-16T05:00:00Z' })
    expect(aConsulta({ accion: '', desde: '', hasta: '', soloMias: true }, 'UTC', null)).toEqual({
      accion: undefined, actorId: undefined, desde: undefined, hasta: undefined,
    })
  })
})

describe('api de ficha, suscripción y auditoría (demo)', () => {
  beforeEach(async () => {
    limpiar(false)
    prepararConDemo()
    await useSesion().iniciar('admin', 'x')
  })

  it('lee y edita la ficha de la PH con cargos y advertencias', async () => {
    const f = await fichaCopropiedad(PH)
    expect(f.cargos.length).toBeGreaterThan(0)
    expect(f.advertencias).toContain('falta_revisor_fiscal')
    const d = await editarCopropiedad(PH, { telefono: '601 555 0000', reglamento_archivo_id: f.datos.reglamento_archivo_id })
    expect(d.telefono).toBe('601 555 0000')
    await expect(editarCopropiedad(PH, { nit: 'abc' })).rejects.toMatchObject({ estado: 422 })
  })

  it('lee y edita la ficha genérica de una empresa', async () => {
    expect((await fichaEntidad(EMPRESA)).nombre).toContain('DAD')
    expect((await editarEntidad(EMPRESA, { sitio_web: 'https://dad.co' })).sitio_web).toBe('https://dad.co')
  })

  it('registra un punto de atención y cambia su horario', async () => {
    const antes = await puntosAtencion(PH)
    const p = await crearPuntoAtencion(PH, { tipo: 'porteria', nombre: 'Portería norte' }, 'k1')
    expect(p.horario).toEqual({ franjas: [], excepciones: [] })
    await cambiarHorario(PH, p.id, { franjas: [{ dia: 1, inicio: '06:00:00', fin: '22:00:00' }], excepciones: [] })
    const despues = await puntosAtencion(PH)
    expect(despues).toHaveLength(antes.length + 1)
    expect(despues.at(-1)!.horario.franjas).toHaveLength(1)
    await expect(cambiarHorario(PH, 'no-existe', {})).rejects.toMatchObject({ estado: 404 })
  })

  it('sin suscripción devuelve null; los demás errores se propagan', async () => {
    expect((await miSuscripcion(PH))?.lineas.length).toBeGreaterThan(0)
    expect(await miSuscripcion(EMPRESA)).toBeNull()
    conRespuesta('GET', /\/suscripcion$/, () => new Response(null, { status: 500 }))
    await expect(miSuscripcion(PH)).rejects.toMatchObject({ estado: 500 })
  })

  it('pagina la auditoría por cursor y filtra por prefijo de acción', async () => {
    const p1 = await listarAuditoria(PH, undefined)
    expect(p1.datos).toHaveLength(50)
    const p2 = await listarAuditoria(PH, p1.siguiente ?? undefined)
    expect(p2.siguiente).toBeNull()
    const acceso = await listarAuditoria(PH, undefined, { accion: 'acceso.' })
    expect(acceso.datos.every((e) => e.accion.startsWith('acceso.'))).toBe(true)
  })

  it('al recargar la ficha, el nombre nuevo llega a la barra', async () => {
    const e = useEntidad()
    await e.entrar(EMPRESA)
    await editarEntidad(EMPRESA, { nombre: 'DAD Renombrada' })
    await e.recargarFicha()
    expect(e.activa?.nombre).toBe('DAD Renombrada')
    expect(useSesion().entidades.find((x) => x.entidad_id === EMPRESA)?.nombre).toBe('DAD Renombrada')
  })
})
