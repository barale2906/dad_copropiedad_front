/**
 * Datos de las zonas de cada maqueta, **sin three.js**: los usan el menú alterno, el panel y
 * las etiquetas sin obligar a descargar el motor 3D. La geometría está en `conjunto.ts` y
 * `oficina.ts`, con los mismos ids.
 */
import type { TipoEntidad } from '@/api/tipos'

export type IdPlantilla = 'conjunto' | 'oficina' | 'plataforma'

export interface ZonaInfo {
  id: string
  nombre: string
  /** Secciones de `mapa-modulos.ts` que abre la zona, en orden. */
  secciones: string[]
  /** Se pasa como `?zona=` para dejar preseleccionado el bien común en el módulo. */
  zona?: string
}

const OFICINA: ZonaInfo[] = [
  { id: 'recepcion', nombre: 'Recepción', secciones: ['entidad', 'directorio'] },
  { id: 'contabilidad', nombre: 'Contabilidad', secciones: ['contabilidad'] },
  { id: 'tesoreria', nombre: 'Tesorería', secciones: ['tesoreria'] },
  { id: 'facturacion', nombre: 'Facturación', secciones: ['facturacion'] },
  { id: 'tributario', nombre: 'Tributario', secciones: ['tributario'] },
  { id: 'archivo', nombre: 'Archivo', secciones: ['archivo'] },
  { id: 'sala-juntas', nombre: 'Sala de juntas', secciones: ['reportes'] },
  { id: 'nomina', nombre: 'Nómina', secciones: ['nomina'] },
]

export const ZONAS: Record<IdPlantilla, ZonaInfo[]> = {
  conjunto: [
    { id: 'torres', nombre: 'Torres', secciones: ['mi', 'unidades'] },
    {
      id: 'administracion',
      nombre: 'Administración',
      secciones: [
        'administracion',
        'cartera',
        'contabilidad',
        'tesoreria',
        'tributario',
        'facturacion',
        'entidad',
        'archivo',
      ],
    },
    { id: 'salon-social', nombre: 'Salón social', secciones: ['zonas-comunes', 'asambleas'], zona: 'salon-social' },
    { id: 'piscina', nombre: 'Piscina', secciones: ['zonas-comunes'], zona: 'piscina' },
    { id: 'cancha', nombre: 'Cancha', secciones: ['zonas-comunes'], zona: 'cancha' },
    { id: 'gimnasio', nombre: 'Gimnasio', secciones: ['zonas-comunes'], zona: 'gimnasio' },
    { id: 'parqueadero', nombre: 'Parqueaderos', secciones: ['zonas-comunes'], zona: 'parqueaderos' },
    { id: 'porteria', nombre: 'Portería', secciones: ['porteria'] },
    { id: 'pantalla', nombre: 'Pantalla del lobby', secciones: ['directorio'] },
  ],
  oficina: OFICINA,
  // La entidad de la plataforma es una empresa más el centro de operación (la consola).
  plataforma: [...OFICINA, { id: 'centro-operacion', nombre: 'Centro de operación', secciones: ['plataforma'] }],
}

/** La PH usa el conjunto; la empresa, la oficina; la plataforma, la oficina con el centro de operación. */
export function plantillaDe(tipo: TipoEntidad): IdPlantilla {
  if (tipo === 'propiedad_horizontal') return 'conjunto'
  return tipo === 'plataforma' ? 'plataforma' : 'oficina'
}

/** Secciones de la plantilla sin repetir, en el orden en que aparecen las zonas. */
export function seccionesDe(p: IdPlantilla): string[] {
  return [...new Set(ZONAS[p].flatMap((z) => z.secciones))]
}
