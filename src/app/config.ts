/**
 * Configuración en tiempo de ejecución.
 *
 * Se lee de `config.json` al arrancar, así el mismo `dist/` sirve en pruebas y en producción:
 * cada servidor tiene su propio `config.json` y no hay que recompilar por ambiente.
 */
export interface ConfigApp {
  /** Base de la API, p. ej. `https://api.dominio.co/api/v1`. */
  apiUrl: string
  /** Sin backend: datos simulados con el formato del contrato. Nunca en producción. */
  modoDemo: boolean
}

const PREDETERMINADA: ConfigApp = { apiUrl: '/api/v1', modoDemo: false }

let actual: ConfigApp = PREDETERMINADA

export async function cargarConfig(): Promise<ConfigApp> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' })
    if (r.ok) actual = { ...PREDETERMINADA, ...((await r.json()) as Partial<ConfigApp>) }
  } catch {
    // Sin config.json se usa la predeterminada (API en el mismo dominio).
  }
  actual.apiUrl = actual.apiUrl.replace(/\/+$/, '')
  return actual
}

export function config(): ConfigApp {
  return actual
}

export const VERSION_APP: string = import.meta.env.VITE_APP_VERSION ?? 'dev'
