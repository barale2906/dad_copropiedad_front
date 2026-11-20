/**
 * Demo del directorio y la publicidad (plan 14): categorías en árbol (con una restringida),
 * siete comercios en la PH —dos destacados— y tres de cobertura nacional en las empresas;
 * reseñas anónimas (la de «Plomería Express» de la cuenta fue ocultada por la moderación: guardar
 * da 409), «Busco …» por sinónimos con contacto autorizado, el enlace público (el mismo token en
 * cada `GET`) y tres piezas que solo ve quien autorizó la publicidad (`mi.ts`).
 */
import type {
  CategoriaDirectorio,
  EstadoEnlaceDirectorio,
  FichaDirectorio,
  PiezaPublicidad,
  Resena,
} from '@/api/tipos'
import { cuerpo, error, json, type Manejador, sinContenido } from './http'
import { publicidadAutorizada } from './mi'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const DIA = 86_400_000
const hace = (dias: number) => new Date(Date.now() - dias * DIA).toISOString()
/** Las PH del demo (el resto de entidades son empresas). */
const PH = new Set([id(1), id(2)])

const categoria = (codigo: string, nombre: string, padre: string | null = null, sinonimos: string[] = [], restringida = false): CategoriaDirectorio => ({
  codigo, nombre, padre, sinonimos, restringida, activa: true,
})

/** Catálogo del demo (la plataforma también lo edita: `plataforma.ts`). */
export const CATEGORIAS: CategoriaDirectorio[] = [
  categoria('hogar', 'Hogar y reparaciones'),
  categoria('plomeria', 'Plomería', 'hogar', ['plomero', 'fontanero', 'fuga']),
  categoria('electrodomesticos', 'Electrodomésticos', 'hogar', ['lavadora', 'lavadoras', 'nevera', 'técnico']),
  categoria('cerrajeria', 'Cerrajería', 'hogar', ['cerrajero', 'llaves', 'chapa']),
  categoria('oficios', 'Oficios'),
  categoria('costura', 'Costura y modistería', 'oficios', ['modista', 'costurera', 'arreglos de ropa']),
  categoria('alimentos', 'Comida y mercado'),
  categoria('panaderia', 'Panadería', 'alimentos', ['pan', 'pasteles']),
  categoria('restaurantes', 'Restaurantes', 'alimentos', ['almuerzo', 'domicilios']),
  categoria('licores', 'Licores', 'alimentos', ['licorera'], true),
  categoria('salud', 'Salud y mascotas'),
  categoria('veterinaria', 'Veterinaria', 'salud', ['mascotas', 'perro', 'gato']),
]

function ficha(n: number, nombre: string, categorias: string[], extra: Partial<FichaDirectorio> = {}): FichaDirectorio {
  return {
    anunciante_id: id(n), nombre_comercial: nombre, descripcion: null, categorias, contacto: {}, horario: null,
    direccion: null, municipio_dane: '11001', destacada: false, distancia_km: null, calificacion_promedio: null, resenas: 0, ...extra,
  }
}

const FICHAS_PH: FichaDirectorio[] = [
  ficha(14001, 'Modistería Rosa', ['costura'], {
    descripcion: 'Arreglos de ropa, ruedos, cremalleras y confección a la medida. Recogemos en portería.',
    contacto: { whatsapp: '573001234567', telefono: '6015551234' }, horario: 'Lunes a sábado de 8 a. m. a 6 p. m.',
    direccion: 'Calle 45 # 12-30, local 2', destacada: true, distancia_km: '0.35', calificacion_promedio: '4.5', resenas: 12,
  }),
  ficha(14002, 'Técnico Lavadoras Ya', ['electrodomesticos'], {
    descripcion: 'Reparación de lavadoras y neveras a domicilio, con garantía de 3 meses.',
    contacto: { whatsapp: '573107654321', sitio_web: 'https://lavadorasya.example.co' }, horario: 'Todos los días de 7 a. m. a 8 p. m.',
    destacada: true, distancia_km: '2.4', calificacion_promedio: '3.5', resenas: 2,
  }),
  ficha(14003, 'Plomería Express', ['plomeria'], {
    descripcion: 'Fugas, destapes y cambio de griferías. Atención de urgencias.',
    contacto: { telefono: '3209876543' }, distancia_km: '0.8', calificacion_promedio: '4.0', resenas: 5,
  }),
  ficha(14004, 'Cerrajería 24 horas', ['cerrajeria'], { contacto: { telefono: '3151112233' }, distancia_km: '1.5' }),
  ficha(14005, 'Panadería La Espiga', ['panaderia'], {
    descripcion: 'Pan artesanal, tortas por encargo y desayunos.', contacto: { whatsapp: '573014445566', correo: 'pedidos@laespiga.example.co' },
    direccion: 'Carrera 13 # 44-10', distancia_km: '0.2', calificacion_promedio: '4.8', resenas: 30,
  }),
  ficha(14006, 'Sazón Casera', ['restaurantes'], {
    descripcion: 'Almuerzos ejecutivos con domicilio al conjunto.', contacto: { whatsapp: '573015556677' }, distancia_km: '0.6',
    calificacion_promedio: '4.2', resenas: 9,
  }),
  ficha(14007, 'Veterinaria Patitas', ['veterinaria'], {
    descripcion: 'Consulta, vacunación y peluquería para mascotas.', contacto: { telefono: '6015559988', sitio_web: 'https://patitas.example.co' },
    distancia_km: '3.1', calificacion_promedio: '4.6', resenas: 7,
  }),
]

/** Cobertura nacional: lo único que reciben las empresas sin ubicación. */
const FICHAS_EMPRESA: FichaDirectorio[] = [
  ficha(14101, 'Papelería Nacional', ['oficios'], { descripcion: 'Útiles de oficina con entrega en todo el país.', contacto: { correo: 'ventas@papeleria.example.co' }, destacada: true }),
  ficha(14102, 'Café para Oficinas', ['alimentos'], { descripcion: 'Suscripción de café y greca para su oficina.', contacto: { whatsapp: '573018889900' }, calificacion_promedio: '4.1', resenas: 4 }),
  ficha(14103, 'Mensajería Rápida', ['hogar'], { descripcion: 'Envíos urbanos y nacionales.', contacto: { telefono: '6014440000' } }),
]

const PIEZAS: PiezaPublicidad[] = [
  {
    creativo_id: id(14201), anunciante_id: id(14001), nombre_comercial: 'Modistería Rosa', formato: 'oferta_cupon',
    titulo: '10 % en arreglos de ropa', texto: 'Para los vecinos del conjunto, en cualquier arreglo.', condiciones: 'Un cupón por persona.',
    es_promocion: true, tiene_cupon: true, vence_en: new Date(Date.now() + 20 * DIA).toISOString(),
  },
  {
    creativo_id: id(14202), anunciante_id: id(14002), nombre_comercial: 'Técnico Lavadoras Ya', formato: 'banner',
    titulo: 'Revisión de lavadora sin costo', texto: 'Diagnóstico gratis si hace la reparación con nosotros.', boton: 'Agendar visita',
    enlace: 'https://lavadorasya.example.co/agendar', es_promocion: false, tiene_cupon: false, vence_en: new Date(Date.now() + 10 * DIA).toISOString(),
  },
  {
    creativo_id: id(14203), anunciante_id: id(14005), nombre_comercial: 'Panadería La Espiga', formato: 'tarjeta_destacada',
    titulo: 'Desayuno a domicilio', texto: 'Pan, huevos y café en su apartamento antes de las 9 a. m.', es_promocion: true,
    tiene_cupon: false, vence_en: new Date(Date.now() + 5 * DIA).toISOString(),
  },
]

let resenas = new Map<string, Resena[]>()
/** Anunciantes donde la moderación ocultó la reseña de la cuenta (guardar otra da 409). */
let ocultas = new Set<string>()
let reportadas = new Set<string>()
let busquedas = new Map<string, FichaDirectorio[]>()
let enlace: EstadoEnlaceDirectorio = { activo: false }
let consecutivo = 14500

const resena = (n: number, calificacion: number, texto: string | null, dias: number): Resena => ({
  id: id(n), calificacion, texto, propia: false, creada_en: hace(dias), actualizada_en: hace(dias),
})

export function iniciarDirectorio(): void {
  consecutivo = 14500
  resenas = new Map([
    [id(14001), [resena(14301, 5, 'Muy cumplida con los arreglos y a buen precio.', 3), resena(14302, 4, 'Buen trabajo, se demoró un día más.', 20), resena(14303, 5, null, 41)]],
    [id(14002), [resena(14304, 3, 'Arregló la lavadora pero llegó tarde.', 9)]],
  ])
  ocultas = new Set([id(14003)])
  reportadas = new Set()
  busquedas = new Map()
  enlace = { activo: true, token: 'demo-directorio-7Q4K', creado_en: hace(30), whatsapp_url: 'https://wa.me/573000000000?text=Busco%20' }
}

/** Sin tildes y en minúsculas, para buscar por texto libre. */
const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** ¿La ficha está en la categoría o en su rama? */
function enCategoria(f: FichaDirectorio, codigo: string): boolean {
  return f.categorias.some((c) => c === codigo || CATEGORIAS.find((x) => x.codigo === c)?.padre === codigo)
}

function coincide(f: FichaDirectorio, q: string): boolean {
  const t = normal(q)
  const textos = [f.nombre_comercial, f.descripcion ?? '', ...f.categorias.flatMap((c) => {
    const cat = CATEGORIAS.find((x) => x.codigo === c)
    return cat ? [cat.nombre, ...cat.sinonimos] : [c]
  })]
  return textos.some((x) => normal(x).includes(t))
}

/** Categoría que se entiende del texto de «Busco …» («busco costurera» → costura). */
function categoriaDe(texto: string): CategoriaDirectorio | null {
  const palabras = normal(texto).split(/\s+/).filter((p) => p.length > 2 && p !== 'busco')
  return CATEGORIAS.find((c) => !c.restringida && [c.nombre, ...c.sinonimos].some((s) => palabras.some((p) => normal(s).includes(p)))) ?? null
}

export const directorio: Manejador = async (req, ruta) => {
  const m = req.method
  const url = new URL(req.url)

  const ent = ruta.match(/^\/entidades\/([^/]+)\/(directorio|publicidad)(\/.*)?$/)
  if (ent) {
    const fichas = PH.has(ent[1] ?? '') ? FICHAS_PH : FICHAS_EMPRESA
    const resto = `/${ent[2]}${ent[3] ?? ''}`
    if (m === 'GET' && resto === '/directorio') {
      const categoriaQ = url.searchParams.get('categoria')
      const q = url.searchParams.get('q')
      const limite = Number(url.searchParams.get('limite') ?? 50)
      const despues = url.searchParams.get('despues')
      const filtradas = fichas
        .filter((f) => (!categoriaQ || enCategoria(f, categoriaQ)) && (!q || coincide(f, q)))
        .sort((a, b) => Number(b.destacada) - Number(a.destacada))
      const desde = despues ? filtradas.findIndex((f) => f.anunciante_id === despues) + 1 : 0
      const pagina = filtradas.slice(desde, desde + limite)
      const ultima = desde + limite >= filtradas.length
      return json({ datos: pagina, siguiente: ultima ? null : (pagina.at(-1)?.anunciante_id ?? null) })
    }
    if (m === 'GET' && resto === '/directorio/destacadas') {
      const categoriaQ = url.searchParams.get('categoria')
      return json(fichas.filter((f) => f.destacada && (!categoriaQ || enCategoria(f, categoriaQ))))
    }
    if (m === 'GET' && resto === '/directorio/categorias') return json(CATEGORIAS.filter((c) => !c.restringida))
    const una = resto.match(/^\/directorio\/anunciantes\/([^/]+)$/)
    if (m === 'GET' && una) {
      const f = fichas.find((x) => x.anunciante_id === una[1])
      return f ? json(f) : error(404, 'no_encontrado', 'El anunciante no alcanza a la entidad.')
    }

    // Piezas: solo para quien autorizó la publicidad.
    if (m === 'GET' && resto === '/publicidad/piezas') return json(publicidadAutorizada() ? PIEZAS : [])
    if (m === 'POST' && resto === '/publicidad/eventos') {
      const { eventos } = await cuerpo<{ eventos: { impresiones?: number; clics?: number }[] }>(req)
      if (eventos.some((e) => (e.impresiones ?? 0) > 100 || (e.clics ?? 0) > 100)) return error(422, 'validacion', 'Demasiados eventos.')
      const suma = (k: 'impresiones' | 'clics') => (publicidadAutorizada() ? eventos.reduce((s, e) => s + (e[k] ?? 0), 0) : 0)
      return json({ impresiones: suma('impresiones'), clics: suma('clics') })
    }
    const creativo = resto.match(/^\/publicidad\/creativos\/([^/]+)\/(cupon|reporte)$/)
    if (m === 'POST' && creativo) {
      const p = PIEZAS.find((x) => x.creativo_id === creativo[1])
      if (!p) return error(404, 'no_encontrado', 'El anuncio no existe.')
      if (creativo[2] === 'cupon') {
        if (!publicidadAutorizada() || !p.tiene_cupon) return error(404, 'no_encontrado', 'La oferta no se muestra en la entidad.')
        return json({ codigo: 'ROSA10', condiciones: p.condiciones, vence_en: p.vence_en, nombre_comercial: p.nombre_comercial })
      }
      const { motivo } = await cuerpo<{ motivo: string }>(req)
      if (!motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo.')
      const nuevo = !reportadas.has(p.creativo_id)
      reportadas.add(p.creativo_id)
      return json({ nuevo })
    }
    return null
  }

  const ph = ruta.match(/^\/copropiedades\/([^/]+)\/directorio(\/.*)$/)
  if (!ph) return null
  const base = ph[2] ?? ''

  const lista = base.match(/^\/anunciantes\/([^/]+)\/(resenas|resena)$/)
  if (lista) {
    const anunciante = lista[1] ?? ''
    if (!FICHAS_PH.some((f) => f.anunciante_id === anunciante)) return error(404, 'no_encontrado', 'La ficha no alcanza a la copropiedad.')
    const propias = resenas.get(anunciante) ?? []
    if (m === 'GET' && lista[2] === 'resenas') {
      return json({ datos: [...propias].sort((a, b) => b.actualizada_en.localeCompare(a.actualizada_en)), siguiente: null })
    }
    if (m === 'PUT' && lista[2] === 'resena') {
      const p = await cuerpo<{ calificacion: number; texto?: string | null }>(req)
      if (!Number.isInteger(p.calificacion) || p.calificacion < 1 || p.calificacion > 5) return error(422, 'validacion', 'La calificación va de 1 a 5.')
      if ((p.texto ?? '').length > 1000) return error(422, 'validacion', 'El texto admite hasta 1000 caracteres.')
      if (ocultas.has(anunciante)) return error(409, 'conflicto', 'La moderación ocultó su reseña anterior.')
      const ahora = new Date().toISOString()
      const anterior = propias.find((r) => r.propia)
      const guardada: Resena = anterior
        ? { ...anterior, calificacion: p.calificacion, texto: p.texto ?? null, actualizada_en: ahora }
        : { id: id(++consecutivo), calificacion: p.calificacion, texto: p.texto ?? null, propia: true, creada_en: ahora, actualizada_en: ahora }
      resenas.set(anunciante, [guardada, ...propias.filter((r) => !r.propia)])
      return json(guardada)
    }
  }
  const reporte = base.match(/^\/resenas\/([^/]+)\/reportes$/)
  if (m === 'POST' && reporte) {
    const existe = [...resenas.values()].flat().some((r) => r.id === reporte[1])
    if (!existe) return error(404, 'no_encontrado', 'La reseña no existe o ya está oculta.')
    const { motivo } = await cuerpo<{ motivo: string }>(req)
    if (!motivo?.trim()) return error(422, 'validacion', 'Escriba el motivo.')
    const nuevo = !reportadas.has(reporte[1] ?? '')
    reportadas.add(reporte[1] ?? '')
    return json({ nuevo })
  }

  if (m === 'POST' && base === '/busquedas') {
    const { texto } = await cuerpo<{ texto: string }>(req)
    const cat = categoriaDe(texto ?? '')
    const sugerencias = cat ? FICHAS_PH.filter((f) => enCategoria(f, cat.codigo)) : FICHAS_PH.filter((f) => coincide(f, texto ?? ''))
    if (!cat && sugerencias.length === 0) return error(422, 'validacion', 'No entendimos qué busca. Pruebe con otras palabras.')
    const elegidas = sugerencias.slice(0, 3)
    const solicitud = id(++consecutivo)
    busquedas.set(solicitud, elegidas)
    return json({ solicitud_id: solicitud, categoria: cat, sugerencias: elegidas, contactables: elegidas.some((f) => !!f.contacto.whatsapp) }, 201)
  }
  const contacto = base.match(/^\/busquedas\/([^/]+)\/contacto$/)
  if (m === 'POST' && contacto) {
    const elegidas = busquedas.get(contacto[1] ?? '')
    if (!elegidas) return error(404, 'no_encontrado', 'La búsqueda no existe o es de otra persona.')
    const proveedores = elegidas.filter((f) => !!f.contacto.whatsapp).map((f) => f.nombre_comercial)
    if (proveedores.length === 0) return error(422, 'validacion', 'Ningún proveedor sugerido recibe WhatsApp.')
    return json({ proveedores, seguimiento: true })
  }

  if (base === '/enlace-publico') {
    if (m === 'GET') return json(enlace)
    if (m === 'POST') {
      const token = `demo-directorio-${(++consecutivo).toString(36).toUpperCase()}`
      enlace = { activo: true, token, creado_en: new Date().toISOString(), whatsapp_url: 'https://wa.me/573000000000?text=Busco%20' }
      return json({ token, creado_en: enlace.creado_en, whatsapp_url: enlace.whatsapp_url }, 201)
    }
    if (m === 'DELETE') {
      if (!enlace.activo) return error(404, 'no_encontrado', 'No había enlace.')
      enlace = { activo: false, token: null, creado_en: null, whatsapp_url: null }
      return sinContenido()
    }
  }
  return null
}
