/**
 * Demo de Unidades y residentes: 2 torres × 20 bienes, titulares, coeficientes (un cuadro vigente
 * y un borrador que no suma 1), censo, propuestas, campañas, libros e importación. Es la fuente de
 * los bienes y las personas del demo (zonas comunes y protección de datos los importan de aquí).
 * Se reinicia en cada inicio de sesión.
 */
import type {
  Agrupacion,
  BienPrivado,
  CambioCenso,
  CambiosBien,
  CambiosMascota,
  CambiosPersona,
  Cuadro,
  FilaCoeficiente,
  Importacion,
  Mascota,
  NuevaAgrupacion,
  NuevaMascota,
  NuevaResidencia,
  NuevoBien,
  NuevoTitular,
  NuevoUsoExclusivo,
  NuevoVehiculo,
  Persona,
  Residencia,
  Titularidad,
  UsoExclusivo,
  Vehiculo,
} from '@/api/tipos'
import { cuerpo, error, json, type Manejador, sinContenido } from './http'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const ahora = () => new Date().toISOString()
const DIA = 86_400_000
const enDias = (d: number) => new Date(Date.now() + d * DIA).toISOString().slice(0, 10)

/** Los primeros cinco conservan los ids que usan zonas comunes y sus pruebas. */
const FIJOS: Record<string, number> = { 'T1-101': 7001, 'T1-102': 7002, 'T1-201': 7003, 'T2-301': 7004, 'T2-302': 7005 }
const TORRES = [
  { n: 1, id: id(7101) },
  { n: 2, id: id(7102) },
]

function bienesIniciales(): BienPrivado[] {
  let siguiente = 7006
  const lista: BienPrivado[] = []
  for (const t of TORRES) {
    for (let piso = 1; piso <= 5; piso++) {
      for (let apto = 1; apto <= 4; apto++) {
        const numero = `${piso}0${apto}`
        const codigo = `T${t.n}-${numero}`
        lista.push({
          id: id(FIJOS[codigo] ?? siguiente++), codigo, tipo: 'apartamento', agrupacion_id: t.id, numero, piso,
          area_privada_m2: '72.50', uso: 'residencial', activo: true, coeficiente: '0.025',
        })
      }
    }
  }
  return lista.sort((a, b) => a.id.localeCompare(b.id))
}

const persona = (n: number, nombre: string, documento: string, extra: Partial<Persona> = {}): Persona => ({
  id: id(n), tipo: 'natural', nombre, tipo_documento: 'CC', documento, telefono: '300 000 0000', correo: null,
  cuenta_id: null, movilidad_reducida: false, datos_sensibles_ocultos: false, fecha_nacimiento: '1985-04-12', ...extra,
})

let bienes: BienPrivado[] = []
let personas: Persona[] = []
let agrupaciones: Agrupacion[] = []
let titularidades: (Titularidad & { bien_privado_id: string })[] = []
let usos: (UsoExclusivo & { bien_privado_id: string })[] = []
let cuadros: Cuadro[] = []
let coeficientes = new Map<string, FilaCoeficiente[]>()
let residencias: Residencia[] = []
let vehiculos: Vehiculo[] = []
let mascotas: Mascota[] = []
let cambios: CambioCenso[] = []
let importaciones = new Map<string, { importacion: Importacion; filas: string[][] }>()
let atendidas = new Set<string>()
let consecutivo = 9000

/** Bienes y personas del demo (los usan otros manejadores). */
export const bienesDemo = () => bienes
export const personasDemo = () => personas
/** Bienes de los que la cuenta demo es titular. */
export const PROPIOS = [id(7001)]

/** El contrato tipa `datos` como objeto sin forma fija. */
const propuesta = (d: Record<string, unknown>) => d as CambioCenso['datos']

export function iniciarUnidades(): void {
  consecutivo = 9000
  bienes = bienesIniciales()
  agrupaciones = TORRES.map((t, i) => ({ id: t.id, tipo: 'edificio', nombre: `Torre ${t.n}`, codigo: `T${t.n}`, padre_id: null, orden: i + 1 }))
  personas = [
    persona(5001, 'Marta Residente', '52123456'),
    persona(5002, 'Pedro Pérez', '79876543', { movilidad_reducida: true }),
    persona(5003, 'Lucía Gómez', '1020304050'),
    ...bienes.map((b, i) => persona(5100 + i, `Titular ${b.codigo}`, String(80000000 + i))),
  ]
  titularidades = bienes.map((b, i) => ({
    id: id(5500 + i), bien_privado_id: b.id, persona_id: id(5100 + i), tipo: 'propietario', porcentaje: '100',
    es_representante: true, vigente_desde: '2020-01-01T05:00:00Z', vigente_hasta: null,
  }))
  usos = [{ id: id(5900), bien_privado_id: id(7001), tipo: 'terraza', codigo: 'TE-01', descripcion: 'Terraza del piso 1', vigente_desde: '2021-01-01T05:00:00Z', vigente_hasta: null }]
  const todos = bienes.map((b) => ({ bien_privado_id: b.id, coeficiente: '0.025' }))
  cuadros = [
    { id: id(6501), version: 1, estado: 'vigente', descripcion: 'Escritura de constitución', vigente_desde: '2020-01-01T05:00:00Z', creado_en: '2019-12-20T15:00:00Z' },
    { id: id(6502), version: 2, estado: 'borrador', descripcion: 'Reforma 2026 (en revisión)', creado_en: ahora() },
  ]
  coeficientes = new Map([
    [id(6501), todos],
    [id(6502), todos.map((c, i) => (i === 0 ? { ...c, coeficiente: '0.0251' } : c))],
  ])
  const base = (n: number, bien: number, p: Persona, calidad: Residencia['calidad'], responsable = false): Residencia => ({
    id: id(n), bien_privado_id: id(bien), persona: p, calidad, es_responsable: responsable, vigente_desde: '2024-03-01T05:00:00Z', vigente_hasta: null,
  })
  residencias = [
    base(5601, 7001, personas[0]!, 'familiar', true),
    base(5602, 7002, personas[1]!, 'tenedor', true),
    base(5603, 7003, personas[2]!, 'propietario_residente', true),
  ]
  vehiculos = [
    { id: id(5701), bien_privado_id: id(7001), tipo: 'carro', placa: 'ABC123', marca: 'Mazda', color: 'Gris', vigente_desde: '2024-03-01T05:00:00Z', vigente_hasta: null },
  ]
  mascotas = [
    { id: id(5801), bien_privado_id: id(7001), especie: 'perro', nombre: 'Firulais', raza: 'Criollo', potencialmente_peligrosa: false, vacunas_vencen: enDias(-10), esterilizada: true, estado: 'activa' },
    { id: id(5802), bien_privado_id: id(7003), especie: 'perro', nombre: 'Rocco', raza: 'Pitbull', potencialmente_peligrosa: true, vacunas_vencen: enDias(200), esterilizada: false, estado: 'activa' },
  ]
  cambios = [
    { id: id(5951), bien_privado_id: id(7004), tipo: 'residencia', estado: 'pendiente', propuesto_por: id(801), propuesto_en: ahora(),
      datos: propuesta({ calidad: 'tenedor', es_responsable: true, persona: { nombre: 'Andrea Nueva', documento: '1098765432', telefono: '311 222 3333' } }) },
    { id: id(5952), bien_privado_id: id(7002), tipo: 'vehiculo', estado: 'pendiente', propuesto_por: id(801), propuesto_en: ahora(),
      datos: propuesta({ tipo: 'moto', placa: 'XYZ98F', marca: 'Yamaha', color: 'Negra' }) },
  ]
  importaciones = new Map()
  atendidas = new Set()
}

const vigente = <T extends { vigente_hasta?: string | null }>(x: T) => !x.vigente_hasta

function revision(filas: FilaCoeficiente[]) {
  const suma = filas.reduce((s, f) => s + Math.round(Number(f.coeficiente) * 1e8), 0)
  const diferencia = 1e8 - suma
  const ids = new Set(filas.map((f) => f.bien_privado_id))
  const activos = bienes.filter((b) => b.activo)
  return {
    suma: (suma / 1e8).toFixed(8).replace(/0+$/, '').replace(/\.$/, ''),
    diferencia: (diferencia / 1e8).toFixed(8).replace(/0+$/, '').replace(/\.$/, '') || '0',
    faltantes: activos.filter((b) => !ids.has(b.id)).map((b) => b.id),
    sobrantes: [...ids].filter((x) => !activos.some((b) => b.id === x)) as string[],
    valido: diferencia === 0 && activos.every((b) => ids.has(b.id)),
  }
}

function arbol() {
  const nodo = (a: Agrupacion): unknown => ({
    agrupacion: a,
    bienes_privados: bienes.filter((b) => b.activo && b.agrupacion_id === a.id),
    hijas: agrupaciones.filter((h) => h.padre_id === a.id).map(nodo),
  })
  return {
    agrupaciones: agrupaciones.filter((a) => !a.padre_id).map(nodo),
    sin_agrupacion: bienes.filter((b) => b.activo && !b.agrupacion_id),
  }
}

function crearPersona(d: NonNullable<NuevoTitular['persona']>): Persona {
  const p = persona(++consecutivo, d.nombre, d.documento, { telefono: d.telefono ?? null, correo: d.correo ?? null })
  personas.push(p)
  return p
}

function registrar(bienId: string, lista: NuevoTitular[]): Response | null {
  const suma = lista.reduce((s, t) => s + Number(t.porcentaje), 0)
  if (Math.abs(suma - 100) > 1e-9) return error(422, 'validacion', 'Los porcentajes de los titulares deben sumar 100 %.')
  for (const t of lista) {
    const p = t.persona_id ? personas.find((x) => x.id === t.persona_id) : t.persona ? crearPersona(t.persona) : null
    if (!p) return error(422, 'validacion', 'Indique la persona de cada titular.')
    titularidades.push({
      id: id(++consecutivo), bien_privado_id: bienId, persona_id: p.id, tipo: t.tipo ?? 'propietario', porcentaje: t.porcentaje,
      es_representante: !!t.es_representante, vigente_desde: ahora(), vigente_hasta: null,
    })
  }
  return null
}

function validarPlanilla(texto: string): Response {
  const [cabecera = '', ...lineas] = texto.split(/\r?\n/).filter((l) => l.trim())
  if (!cabecera.startsWith('codigo,tipo')) return error(422, 'validacion', 'La planilla no tiene la cabecera de la plantilla.')
  const errores: Importacion['errores'] = []
  const filas: string[][] = []
  const vistas: { fila: number; codigo: string; tipo: BienPrivado['tipo']; agrupacion: string | null; agrupacion_nueva: boolean; coeficiente: string | null; titulares: number }[] = []
  lineas.forEach((l, i) => {
    const c = l.split(',').map((x) => x.trim())
    const [codigo = '', tipo = '', agrupacion = '', coef = '', titular = '', documento = ''] = c
    const fila = i + 2
    if (!codigo) errores.push({ fila, mensaje: 'Falta el código del bien.' })
    else if (bienes.some((b) => b.codigo === codigo)) errores.push({ fila, mensaje: 'Ya existe un bien con ese código.' })
    else if (!['apartamento', 'local', 'parqueadero', 'deposito', 'casa', 'oficina'].includes(tipo)) errores.push({ fila, mensaje: 'El tipo de bien no es válido.' })
    else if (coef && !/^0(\.\d+)?$/.test(coef)) errores.push({ fila, mensaje: 'El coeficiente debe ser un decimal entre 0 y 1 con punto.' })
    else if (titular && !documento) errores.push({ fila, mensaje: 'Falta el documento del titular.' })
    else {
      filas.push(c)
      vistas.push({ fila, codigo, tipo: tipo as BienPrivado['tipo'], agrupacion: agrupacion || null, agrupacion_nueva: !!agrupacion && !agrupaciones.some((a) => a.codigo === agrupacion), coeficiente: coef || null, titulares: titular ? 1 : 0 })
    }
  })
  const importacion: Importacion = {
    id: id(++consecutivo), archivo_id: id(++consecutivo), estado: errores.length ? 'con_errores' : 'validada', total_filas: lineas.length,
    filas_validas: vistas.length, errores,
    resumen: { bienes_privados: vistas.length, agrupaciones_nuevas: new Set(vistas.filter((v) => v.agrupacion_nueva).map((v) => v.agrupacion)).size, titulares: vistas.reduce((s, v) => s + v.titulares, 0), personas_nuevas: vistas.reduce((s, v) => s + v.titulares, 0), coeficientes: vistas.filter((v) => v.coeficiente).length, usuarios: 0, cuentas_nuevas: 0, empleados: 0, novedades: 0 },
    creada_en: ahora(),
  }
  importaciones.set(importacion.id, { importacion, filas })
  return json({ importacion, filas: vistas }, 201)
}

function aplicarImportacion(i: { importacion: Importacion; filas: string[][] }): Response {
  for (const [codigo = '', tipo = '', agrupacion = '', , titular = '', documento = ''] of i.filas) {
    let agrupacionId: string | null = null
    if (agrupacion) {
      let a = agrupaciones.find((x) => x.codigo === agrupacion)
      if (!a) {
        a = { id: id(++consecutivo), tipo: 'edificio', nombre: agrupacion, codigo: agrupacion, padre_id: null, orden: agrupaciones.length + 1 }
        agrupaciones.push(a)
      }
      agrupacionId = a.id
    }
    const b: BienPrivado = { id: id(++consecutivo), codigo, tipo: tipo as BienPrivado['tipo'], agrupacion_id: agrupacionId, uso: 'residencial', activo: true }
    bienes.push(b)
    if (titular) registrar(b.id, [{ persona: { nombre: titular, documento }, porcentaje: '100', es_representante: true }])
  }
  i.importacion = { ...i.importacion, estado: 'aplicada', aplicada_en: ahora() }
  return json(i.importacion)
}

function libro(tipo: string, req: Request): Response {
  const formato = new URL(req.url).searchParams.get('formato')
  const filas =
    tipo === 'propietarios'
      ? titularidades.filter(vigente).map((t) => {
          const p = personas.find((x) => x.id === t.persona_id)
          const b = bienes.find((x) => x.id === t.bien_privado_id)
          return { codigo: b?.codigo ?? '', coeficiente: b?.coeficiente ?? null, nombre: p?.nombre ?? '', tipo_documento: 'CC', documento: p?.documento ?? null, tipo: t.tipo, porcentaje: t.porcentaje, es_representante: t.es_representante, vigente_desde: t.vigente_desde }
        })
      : residencias.filter(vigente).map((r) => ({ codigo: bienes.find((b) => b.id === r.bien_privado_id)?.codigo ?? '', nombre: r.persona.nombre, tipo_documento: 'CC', documento: r.persona.documento ?? null, calidad: r.calidad, es_responsable: r.es_responsable, vigente_desde: r.vigente_desde }))
  if (formato === 'csv' || formato === 'pdf') {
    const csv = [Object.keys(filas[0] ?? {}).join(','), ...filas.map((f) => Object.values(f).join(','))].join('\n')
    return new Response(formato === 'csv' ? csv : '%PDF-1.4 libro demo', {
      headers: {
        'Content-Type': formato === 'csv' ? 'text/csv' : 'application/pdf',
        'Content-Disposition': `attachment; filename="libro-${tipo}.${formato}"`,
        'X-Contenido-Sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    })
  }
  return json(filas)
}

export const unidades: Manejador = async (req, ruta) => {
  const m = req.method
  const base = ruta.match(/^\/copropiedades\/[^/]+(\/.*)$/)?.[1]
  if (!base) return null
  const q = new URL(req.url).searchParams

  // Agrupaciones y bienes
  if (base === '/agrupaciones') {
    if (m === 'GET') return json(arbol())
    if (m === 'POST') {
      const d = await cuerpo<NuevaAgrupacion>(req)
      if (agrupaciones.some((a) => a.codigo === d.codigo)) return error(409, 'conflicto', `Ya existe la agrupación ${d.codigo}.`)
      const a: Agrupacion = { id: id(++consecutivo), orden: agrupaciones.length + 1, padre_id: null, ...d }
      agrupaciones.push(a)
      return json(a, 201)
    }
  }
  if (m === 'GET' && base === '/mis-bienes-privados') return json(bienes.filter((b) => PROPIOS.includes(b.id)))
  if (m === 'GET' && base === '/mis-residencias') {
    // La cuenta demo es Marta Residente (persona 5001).
    const mias = residencias.filter((r) => vigente(r) && r.persona.id === id(5001))
    return json(mias.map((r) => ({
      residencia_id: r.id, bien_privado_id: r.bien_privado_id, bien_codigo: bienes.find((b) => b.id === r.bien_privado_id)?.codigo ?? '',
      calidad: r.calidad, es_responsable: r.es_responsable, reservas_autorizadas: !!r.autorizado_por || r.calidad !== 'tenedor', vigente_desde: r.vigente_desde,
    })))
  }
  if (base === '/bienes-privados') {
    if (m === 'GET') {
      const texto = (q.get('q') ?? '').toLowerCase()
      const lista = bienes.filter(
        (b) =>
          (q.get('incluir_inactivos') === 'true' || b.activo) &&
          (!texto || b.codigo.toLowerCase().includes(texto)) &&
          (!q.get('agrupacion_id') || b.agrupacion_id === q.get('agrupacion_id')) &&
          (!q.get('tipo') || b.tipo === q.get('tipo')),
      )
      const limite = Number(q.get('limite') ?? 50)
      const desde = Number(q.get('despues') ?? 0)
      return json({ datos: lista.slice(desde, desde + limite), siguiente: desde + limite < lista.length ? String(desde + limite) : null })
    }
    if (m === 'POST') {
      const d = await cuerpo<NuevoBien>(req)
      const agrupacion = agrupaciones.find((a) => a.id === d.agrupacion_id)
      const codigo = d.codigo || `${agrupacion?.codigo ?? ''}${agrupacion ? '-' : ''}${d.numero ?? ''}`
      if (!codigo) return error(422, 'validacion', 'Indique el número o el código del bien.')
      if (bienes.some((b) => b.codigo === codigo)) return error(409, 'conflicto', `Ya existe el bien ${codigo}.`)
      const b: BienPrivado = { ...d, id: id(++consecutivo), codigo, uso: d.uso ?? 'residencial', activo: true }
      bienes.push(b)
      return json(b, 201)
    }
  }
  const bien = base.match(/^\/bienes-privados\/([^/]+)(\/[a-z-]+)?(?:\/([^/]+))?$/)
  if (bien) {
    const b = bienes.find((x) => x.id === bien[1])
    if (!b) return error(404, 'no_encontrado', 'El bien no existe.')
    const resto = bien[2] ?? ''
    if (m === 'GET' && resto === '') {
      return json({
        bien_privado: b,
        anexos: bienes.filter((x) => x.bien_principal_id === b.id),
        usos_exclusivos: usos.filter((u) => u.bien_privado_id === b.id && vigente(u)),
        titulares: titularidades.filter((t) => t.bien_privado_id === b.id && vigente(t)),
      })
    }
    if (m === 'PATCH' && resto === '') {
      Object.assign(b, await cuerpo<CambiosBien>(req))
      return json(b)
    }
    if (m === 'POST' && resto === '/inactivar') {
      b.activo = false
      return json(b)
    }
    if (m === 'PUT' && resto === '/principal') {
      const { bien_principal_id } = await cuerpo<{ bien_principal_id: string | null }>(req)
      if (bien_principal_id === b.id) return error(422, 'validacion', 'Un bien no puede ser anexo de sí mismo.')
      b.bien_principal_id = bien_principal_id
      return json(b)
    }
    if (resto === '/usos-exclusivos') {
      if (m === 'POST') {
        const d = await cuerpo<NuevoUsoExclusivo>(req)
        if (usos.some((u) => vigente(u) && u.codigo === d.codigo)) return error(409, 'conflicto', `El uso exclusivo ${d.codigo} ya está asignado.`)
        const u = { ...d, id: id(++consecutivo), bien_privado_id: b.id, vigente_desde: d.vigente_desde ?? ahora(), vigente_hasta: null }
        usos.push(u)
        return json(u, 201)
      }
      if (m === 'DELETE' && bien[3]) {
        const u = usos.find((x) => x.id === bien[3])
        if (u) u.vigente_hasta = ahora()
        return sinContenido()
      }
    }
    if (resto === '/titulares') {
      if (m === 'GET') {
        return json(
          titularidades
            .filter((t) => t.bien_privado_id === b.id)
            .sort((x, y) => Number(!vigente(x)) - Number(!vigente(y)))
            .map((t) => {
              const p = personas.find((x) => x.id === t.persona_id)
              return { titularidad: t, nombre: p?.nombre ?? '', tipo_persona: 'natural', documento: p?.documento, telefono: p?.telefono, correo: p?.correo, cuenta_id: p?.cuenta_id }
            }),
        )
      }
      if (m === 'POST') {
        if (titularidades.some((t) => t.bien_privado_id === b.id && vigente(t))) {
          return error(409, 'conflicto', 'El bien ya tiene titulares: registre una transferencia.')
        }
        return registrar(b.id, (await cuerpo<{ titulares: NuevoTitular[] }>(req)).titulares) ?? json([], 201)
      }
    }
    if (m === 'POST' && resto === '/transferencias') {
      const { titulares } = await cuerpo<{ titulares: NuevoTitular[] }>(req)
      const anteriores = titularidades.filter((t) => t.bien_privado_id === b.id && vigente(t))
      const fallo = registrar(b.id, titulares)
      if (fallo) return fallo
      anteriores.forEach((t) => (t.vigente_hasta = ahora()))
      return json([], 201)
    }
    if (m === 'PUT' && resto === '/representante') {
      const { persona_id } = await cuerpo<{ persona_id: string }>(req)
      const actuales = titularidades.filter((t) => t.bien_privado_id === b.id && vigente(t))
      if (!actuales.some((t) => t.persona_id === persona_id)) return error(422, 'validacion', 'El representante debe ser un titular vigente.')
      actuales.forEach((t) => (t.es_representante = t.persona_id === persona_id))
      return sinContenido()
    }
  }

  // Coeficientes
  if (base === '/cuadros-coeficientes') {
    if (m === 'GET') return json([...cuadros].sort((a, b) => b.version - a.version))
    if (m === 'POST') {
      const d = await cuerpo<{ copiar_vigente?: boolean; descripcion?: string | null }>(req)
      if (cuadros.some((c) => c.estado === 'borrador')) return error(409, 'conflicto', 'Ya hay un cuadro en borrador: termínelo o actívelo primero.')
      const c: Cuadro = { id: id(++consecutivo), version: Math.max(...cuadros.map((x) => x.version)) + 1, estado: 'borrador', descripcion: d.descripcion, creado_en: ahora() }
      cuadros.push(c)
      const vig = cuadros.find((x) => x.estado === 'vigente')
      coeficientes.set(c.id, d.copiar_vigente && vig ? [...(coeficientes.get(vig.id) ?? [])] : [])
      return json(c, 201)
    }
  }
  const cua = base.match(/^\/cuadros-coeficientes\/([^/]+)(\/[a-z]+)?$/)
  if (cua) {
    const c = cuadros.find((x) => x.id === cua[1])
    if (!c) return error(404, 'no_encontrado', 'El cuadro no existe.')
    const filas = coeficientes.get(c.id) ?? []
    const resto = cua[2] ?? ''
    if (m === 'GET' && resto === '') return json({ cuadro: c, coeficientes: filas, revision: revision(filas) })
    if (m === 'PUT' && resto === '/coeficientes') {
      if (c.estado !== 'borrador') return error(409, 'conflicto_estado', 'Solo se editan los cuadros en borrador.')
      const d = await cuerpo<{ coeficientes: FilaCoeficiente[] }>(req)
      if (d.coeficientes.some((f) => !/^\d+(\.\d+)?$/.test(f.coeficiente) || Number(f.coeficiente) > 1)) {
        return error(422, 'validacion', 'Hay coeficientes que no son decimales entre 0 y 1.')
      }
      coeficientes.set(c.id, d.coeficientes)
      return json(revision(d.coeficientes))
    }
    if (m === 'POST' && resto === '/validar') return json(revision(filas))
    if (m === 'POST' && resto === '/activar') {
      if (c.estado !== 'borrador') return error(409, 'conflicto_estado', 'Solo se activa un cuadro en borrador.')
      const r = revision(filas)
      if (!r.valido) {
        return error(422, 'coeficientes_no_suman_uno', `El cuadro suma ${r.suma}: la diferencia con 1 es ${r.diferencia}. Ajuste los coeficientes.`)
      }
      cuadros.forEach((x) => {
        if (x.estado === 'vigente') x.estado = 'historico'
      })
      c.estado = 'vigente'
      c.vigente_desde = ahora()
      for (const f of filas) {
        const b = bienes.find((x) => x.id === f.bien_privado_id)
        if (b) b.coeficiente = f.coeficiente
      }
      return json(c)
    }
  }

  // Censo
  if (base === '/residencias') {
    if (m === 'GET') {
      const historial = q.get('historial') === 'true'
      return json(residencias.filter((r) => (historial || vigente(r)) && (!q.get('bien_privado_id') || r.bien_privado_id === q.get('bien_privado_id'))))
    }
    if (m === 'POST') {
      const d = await cuerpo<NuevaResidencia & { persona?: { nombre: string; documento: string; telefono?: string | null } | null }>(req)
      const p = d.persona_id ? personas.find((x) => x.id === d.persona_id) : d.persona ? crearPersona(d.persona) : null
      if (!p) return error(422, 'validacion', 'Indique la persona que reside.')
      if (residencias.some((r) => vigente(r) && r.bien_privado_id === d.bien_privado_id && r.persona.id === p.id)) {
        return error(409, 'conflicto', 'Esa persona ya reside en el bien.')
      }
      const r: Residencia = { id: id(++consecutivo), bien_privado_id: d.bien_privado_id, persona: p, calidad: d.calidad, es_responsable: !!d.es_responsable, vigente_desde: ahora(), vigente_hasta: null }
      residencias.push(r)
      return json(r, 201)
    }
  }
  const res = base.match(/^\/residencias\/([^/]+)\/(terminar|autorizacion-reservas)$/)
  if (res) {
    const r = residencias.find((x) => x.id === res[1])
    if (!r) return error(404, 'no_encontrado', 'La residencia no existe.')
    if (m === 'POST' && res[2] === 'terminar') r.vigente_hasta = ahora()
    if (m === 'PUT' && res[2] === 'autorizacion-reservas') {
      const { autorizadas } = await cuerpo<{ autorizadas: boolean }>(req)
      r.autorizado_por = autorizadas ? id(801) : null
    }
    return sinContenido()
  }
  if (base === '/vehiculos') {
    if (m === 'GET') {
      const placa = (q.get('placa') ?? '').toUpperCase()
      return json(vehiculos.filter((v) => vigente(v) && (!q.get('bien_privado_id') || v.bien_privado_id === q.get('bien_privado_id')) && (!placa || (v.placa ?? '').includes(placa))))
    }
    if (m === 'POST') {
      const d = await cuerpo<NuevoVehiculo>(req)
      if (d.placa && vehiculos.some((v) => vigente(v) && v.placa === d.placa)) return error(409, 'conflicto', `La placa ${d.placa} ya está registrada en otro vehículo vigente.`)
      const v: Vehiculo = { id: id(++consecutivo), vigente_desde: ahora(), vigente_hasta: null, ...d }
      vehiculos.push(v)
      return json(v, 201)
    }
  }
  const retirar = base.match(/^\/vehiculos\/([^/]+)\/retirar$/)
  if (m === 'POST' && retirar) {
    const v = vehiculos.find((x) => x.id === retirar[1])
    if (v) v.vigente_hasta = ahora()
    return sinContenido()
  }
  if (base === '/mascotas') {
    if (m === 'GET') return json(mascotas.filter((x) => (q.get('historial') === 'true' || x.estado === 'activa') && (!q.get('bien_privado_id') || x.bien_privado_id === q.get('bien_privado_id'))))
    if (m === 'POST') {
      const d = await cuerpo<NuevaMascota>(req)
      const x: Mascota = { id: id(++consecutivo), estado: 'activa', ...d, potencialmente_peligrosa: !!d.potencialmente_peligrosa, esterilizada: !!d.esterilizada }
      mascotas.push(x)
      return json(x, 201)
    }
  }
  const mas = base.match(/^\/mascotas\/([^/]+)$/)
  if (m === 'PATCH' && mas) {
    const x = mascotas.find((y) => y.id === mas[1])
    if (!x) return error(404, 'no_encontrado', 'La mascota no existe.')
    Object.assign(x, await cuerpo<CambiosMascota>(req))
    return json(x)
  }
  if (m === 'GET' && base === '/censo/alertas') {
    const hoy = enDias(0)
    const alertas = mascotas
      .filter((x) => x.estado === 'activa')
      .map((x) => ({
        mascota: x,
        alertas: [
          ...(!x.vacunas_vencen ? ['sin_registro_de_vacunas'] : x.vacunas_vencen < hoy ? ['vacunas_vencidas'] : x.vacunas_vencen < enDias(30) ? ['vacunas_por_vencer'] : []),
          ...(x.potencialmente_peligrosa && !x.poliza_numero ? ['sin_poliza'] : []),
        ],
      }))
      .filter((a) => a.alertas.length)
    return json({ mascotas: alertas, residentes_sin_autorizacion: [id(5002)] })
  }
  if (base === '/censo/campanas') {
    if (m === 'GET') return json([{ campana: { id: id(5991), creada_en: new Date(Date.now() - 3 * DIA).toISOString(), enviados: 38 }, confirmados: 20, con_cambios: 2, por_atender: 2 - atendidas.size }])
    if (m === 'POST') return json({ id: id(++consecutivo), creada_en: ahora(), enviados: 39 }, 201)
  }
  if (m === 'GET' && base === `/censo/campanas/${id(5991)}/respuestas`) {
    return json([
      { persona_id: id(5100), nombre: 'Titular T1-101', bien_privado_id: id(7001), codigo: 'T1-101', respuesta: 'cambios', detalle: 'Cambié de celular: 312 000 1111', respondida_en: ahora(), atendida_en: atendidas.has(id(7001)) ? ahora() : null },
      { persona_id: id(5101), nombre: 'Titular T1-102', bien_privado_id: id(7002), codigo: 'T1-102', respuesta: 'cambios', detalle: 'Ya no vive el arrendatario', respondida_en: ahora(), atendida_en: atendidas.has(id(7002)) ? ahora() : null },
      { persona_id: id(5102), nombre: 'Titular T1-103', bien_privado_id: id(7006), codigo: 'T1-103', respuesta: 'confirmado', respondida_en: ahora(), atendida_en: null },
    ])
  }
  const atender = base.match(/^\/censo\/campanas\/[^/]+\/respuestas\/[^/]+\/([^/]+)\/atender$/)
  if (m === 'POST' && atender) {
    atendidas.add(atender[1] ?? '')
    return sinContenido()
  }

  // Cambios propuestos
  if (base === '/cambios-censo') {
    if (m === 'GET') {
      // `mias=true`: las que propuso la cuenta demo (cuenta 801).
      const mias = q.get('mias') === 'true'
      return json(cambios.filter((c) => (!q.get('estado') || c.estado === q.get('estado')) && (!mias || c.propuesto_por === id(801))))
    }
    if (m === 'POST') {
      const d = await cuerpo<{ bien_privado_id: string; tipo: CambioCenso['tipo']; datos: CambioCenso['datos'] }>(req)
      if (!PROPIOS.includes(d.bien_privado_id)) return error(422, 'validacion', 'Solo puede proponer cambios de sus bienes.')
      const c: CambioCenso = { id: id(++consecutivo), bien_privado_id: d.bien_privado_id, tipo: d.tipo, datos: d.datos, estado: 'pendiente', propuesto_por: id(801), propuesto_en: ahora() }
      cambios = [c, ...cambios]
      return json(c, 201)
    }
  }
  const cam = base.match(/^\/cambios-censo\/([^/]+)\/(aprobar|rechazar)$/)
  if (m === 'POST' && cam) {
    const c = cambios.find((x) => x.id === cam[1])
    if (!c) return error(404, 'no_encontrado', 'La propuesta no existe.')
    if (c.estado !== 'pendiente') return error(409, 'conflicto_estado', 'La propuesta ya se revisó.')
    c.estado = cam[2] === 'aprobar' ? 'aprobado' : 'rechazado'
    c.revisado_en = ahora()
    if (cam[2] === 'rechazar') c.motivo = (await cuerpo<{ motivo: string }>(req)).motivo
    return json(c)
  }

  // Personas (los subrecursos de protección de datos los atiende su manejador)
  if (m === 'GET' && base === '/personas') {
    const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const texto = sinTildes(q.get('q') ?? '')
    const lista = personas.filter((p) => !texto || sinTildes(p.nombre).includes(texto) || (p.documento ?? '').includes(texto))
    const limite = Number(q.get('limite') ?? 50)
    const desde = q.get('despues') ? lista.findIndex((p) => p.id === q.get('despues')) + 1 : 0
    const datos = lista.slice(desde, desde + limite)
    return json({ datos, siguiente: desde + limite < lista.length ? (datos.at(-1)?.id ?? null) : null })
  }
  const per = base.match(/^\/personas\/([^/]+)$/)
  if (per) {
    const p = personas.find((x) => x.id === per[1])
    if (!p) return error(404, 'no_encontrado', 'La persona no existe.')
    if (m === 'GET') return json(p)
    if (m === 'PATCH') {
      const d = await cuerpo<CambiosPersona>(req)
      if (d.documento && personas.some((x) => x.id !== p.id && x.documento === d.documento)) return error(409, 'conflicto', 'Ese documento ya es de otra persona.')
      Object.assign(p, Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)))
      return json(p)
    }
  }

  // Libros e importación
  const lib = base.match(/^\/libros\/(propietarios|residentes)$/)
  if (m === 'GET' && lib) return libro(lib[1] ?? '', req)
  if (m === 'GET' && base === '/importaciones/bienes-privados/plantilla') {
    return new Response('codigo,tipo,agrupacion,coeficiente,titular,documento\nT3-101,apartamento,T3,0.0125,Ana Pérez,52000111\n', {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="plantilla-bienes-privados.csv"' },
    })
  }
  if (m === 'POST' && base === '/importaciones/bienes-privados') return validarPlanilla(await req.text())
  const imp = base.match(/^\/importaciones\/([^/]+)(\/confirmar)?$/)
  if (imp && importaciones.has(imp[1] ?? '')) {
    const i = importaciones.get(imp[1] ?? '')!
    if (m === 'GET' && !imp[2]) return json(i.importacion)
    if (m === 'POST' && imp[2]) {
      if (i.importacion.estado !== 'validada') return error(409, 'conflicto', 'La importación tiene errores o ya se aplicó.')
      return aplicarImportacion(i)
    }
  }
  return null
}
