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
  SECCIONES,
  type Seccion,
} from '@/escena/mapa-modulos'
import { type IdPlantilla, plantillaDe, seccionesDe, ZONAS, type ZonaInfo } from '@/escena/plantillas/zonas'
import { useEntidad } from '@/stores/entidad'

export interface SeccionVista {
  seccion: Seccion
  estado: EstadoSeccion
  acciones: Seccion['acciones']
}

export function useNavegacion() {
  const entidad = useEntidad()
  const consulta: Consulta = {
    tieneModulo: (m) => entidad.tieneModulo(m),
    tienePermiso: (p) => entidad.tienePermiso(p),
    get esPH() {
      return entidad.esPH
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

  function rutaMaqueta(zonaId?: string): RouteLocationRaw {
    return {
      name: 'maqueta',
      params: { entidadId: entidad.activa?.entidad_id ?? '' },
      query: zonaId ? { zona: zonaId } : {},
    }
  }

  return { plantilla, zonas, estadosZonas, secciones, vistaSeccion, estadoDeAccion, rutaAccion, rutaMaqueta }
}
