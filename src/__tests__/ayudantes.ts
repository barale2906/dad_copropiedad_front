/** Ayudantes compartidos por las pruebas unitarias y de componentes. */
import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'
import { type ConfigApp, cargarConfig } from '@/app/config'
import { iniciarCliente } from '@/api/cliente'
import type { Capacidades, EntidadDeLaCuenta } from '@/api/tipos'
import { fetchDemo, sinLatenciaDemo } from '@/mocks/demo'
import { useEntidad } from '@/stores/entidad'

export const API = 'http://api.prueba'

/** Pinia limpio + cliente HTTP contra el backend simulado del modo demo. */
export function prepararConDemo(): void {
  sinLatenciaDemo()
  localStorage.clear()
  setActivePinia(createPinia())
  iniciarCliente(API, fetchDemo)
}

export const ENTIDAD_PH: EntidadDeLaCuenta = {
  entidad_id: '00000000-0000-4000-8000-000000000001',
  nombre: 'Conjunto de prueba',
  nit: null,
  tipo: 'propiedad_horizontal',
  estado: 'activa',
  roles: ['administrador'],
}

/** Capacidades de prueba: `modo_soporte` y `entidad_suspendida` son opcionales (por defecto, `false`). */
export type CapacidadesDePrueba = Omit<Capacidades, 'modo_soporte' | 'entidad_suspendida' | 'zona_horaria'> & {
  modo_soporte?: boolean
  entidad_suspendida?: boolean
  zona_horaria?: string
}

/** Deja una entidad activa con las capacidades dadas, sin pasar por la API. */
export function conCapacidades(cap: CapacidadesDePrueba, entidad: EntidadDeLaCuenta = ENTIDAD_PH) {
  const e = useEntidad()
  e.activa = entidad
  e.capacidades = { modo_soporte: false, entidad_suspendida: false, zona_horaria: 'America/Bogota', ...cap }
  return e
}

/** Carga una configuración (`config.json`) simulada, como al arrancar la app. */
export async function conConfig(parcial: Partial<ConfigApp>): Promise<void> {
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify(parcial))))
  try {
    await cargarConfig()
  } finally {
    vi.unstubAllGlobals()
  }
}

/**
 * Fuerza la respuesta de una ruta (método + patrón sobre la ruta sin `/api/v1`) y deja el resto
 * en el backend simulado. Sirve para probar errores (409, 422, 403, 500) que el demo no da.
 *
 * ```ts
 * conRespuesta('GET', /^\/entidades\/[^/]+$/, () => new Response(null, { status: 500 }))
 * ```
 */
export function conRespuesta(metodo: string, ruta: RegExp, respuesta: (r: Request) => Response): void {
  iniciarCliente(API, (r) => {
    const camino = new URL(r.url).pathname.replace(/^.*\/api\/v1/, '')
    return r.method === metodo && ruta.test(camino) ? Promise.resolve(respuesta(r)) : fetchDemo(r)
  })
}
