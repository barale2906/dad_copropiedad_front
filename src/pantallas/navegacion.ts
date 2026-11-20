/** Estado de zonas y secciones para la entidad activa (sin three.js). */
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import {
  accionesVisibles,
  type Consulta,
  estadoAccion,
  type EstadoSeccion,
  estadoDeSecciones,
  estadoSeccion,
  faltaSegundoFactor,
  SECCIONES,
  type Seccion,
} from '@/escena/mapa-modulos'
import { type IdPlantilla, plantillaDe, seccionesDe, ZONAS, type ZonaInfo } from '@/escena/plantillas/zonas'
import { useCuenta } from '@/stores/cuenta'
import { useEntidad } from '@/stores/entidad'

export interface SeccionVista {
  seccion: Seccion
  estado: EstadoSeccion
  acciones: Seccion['acciones']
}

export function useNavegacion() {
  const entidad = useEntidad()
  const cuenta = useCuenta()
  const consulta: Consulta = {
    tieneModulo: (m) => entidad.tieneModulo(m),
    tienePermiso: (p) => entidad.tienePermiso(p),
    tieneRol: (r) => entidad.tieneRol(r),
    tienePermisoPlataforma: (p) => cuenta.permisosPlataforma.has(p),
    get esPH() {
      return entidad.esPH
    },
    get esPlataforma() {
      return (entidad.capacidades?.tipo ?? entidad.activa?.tipo) === 'plataforma'
    },
    get segundoFactor() {
      return cuenta.segundoFactorActivo
    },
  }

  const plantilla = computed<IdPlantilla>(() =>
    plantillaDe(entidad.capacidades?.tipo ?? entidad.activa?.tipo ?? 'empresa'),
  )
  const zonas = computed<ZonaInfo[]>(() => ZONAS[plantilla.value])

  const estadosZonas = computed<Record<string, EstadoSeccion>>(() =>
    Object.fromEntries(zonas.value.map((z) => [z.id, estadoDeSecciones(z.secciones, consulta)])),
  )

  function vistaSeccion(slug: string): SeccionVista | null {
    const s = SECCIONES[slug]
    if (!s) return null
    return { seccion: s, estado: estadoSeccion(s, consulta), acciones: accionesVisibles(s, consulta) }
  }

  /** Estado de una acción de la ruta (sección no contratada, sin acceso o activa). */
  function estadoDeAccion(slug: string, accionId: string): EstadoSeccion | null {
    const s = SECCIONES[slug]
    return s ? estadoAccion(s, accionId, consulta) : null
  }

  /** La sección está con candado solo porque falta el segundo factor (consola de la plataforma). */
  function sinSegundoFactor(slug: string): boolean {
    const s = SECCIONES[slug]
    return !!s && faltaSegundoFactor(s, consulta)
  }

  const secciones = computed<SeccionVista[]>(() =>
    seccionesDe(plantilla.value)
      .map(vistaSeccion)
      .filter((x): x is SeccionVista => x !== null),
  )

  function rutaAccion(seccion: string, accion?: string, zona?: ZonaInfo): RouteLocationRaw {
    const query: Record<string, string> = {}
    if (zona?.zona && seccion === 'zonas-comunes') query.zona = zona.zona
    if (zona) query.origen = zona.id
    return {
      name: 'modulo',
      params: { entidadId: entidad.activa?.entidad_id ?? '', seccion, accion: accion ?? '' },
      query,
    }
  }

  /** La maqueta (o una zona). `?ver=maqueta` evita la entrada directa a «Mi hogar» o al turno. */
  function rutaMaqueta(zonaId?: string): RouteLocationRaw {
    return {
      name: 'maqueta',
      params: { entidadId: entidad.activa?.entidad_id ?? '' },
      query: zonaId ? { zona: zonaId } : { ver: 'maqueta' },
    }
  }

  return { plantilla, zonas, estadosZonas, secciones, vistaSeccion, estadoDeAccion, sinSegundoFactor, rutaAccion, rutaMaqueta }
}
