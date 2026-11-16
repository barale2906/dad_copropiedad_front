/**
 * Configuración en tiempo de ejecución.
 *
 * Se lee de `config.json` al arrancar, así el mismo `dist/` sirve en pruebas y en producción:
 * cada servidor tiene su propio `config.json` y no hay que recompilar por ambiente.
 */
export interface ConfigApp {
  /**
   * Origen del backend, **sin** `/api/v1` (las rutas del contrato ya lo incluyen), p. ej.
   * `https://api.dominio.co`. Vacío = mismo dominio que la web.
   */
  apiUrl: string
  /** Sin backend: datos simulados con el formato del contrato. Nunca en producción. */
  modoDemo: boolean
  /** Correo comercial que se ofrece cuando un módulo no está contratado (opcional). */
  contactoComercial: string
}

const PREDETERMINADA: ConfigApp = { apiUrl: '', modoDemo: false, contactoComercial: '' }

let actual: ConfigApp = PREDETERMINADA

export async function cargarConfig(): Promise<ConfigApp> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' })
    if (r.ok) actual = { ...PREDETERMINADA, ...((await r.json()) as Partial<ConfigApp>) }
  } catch {
    // Sin config.json se usa la predeterminada (API en el mismo dominio).
  }
  // Tolera que alguien escriba la URL con `/api/v1` o con `/` al final.
  actual.apiUrl = actual.apiUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '')
  return actual
}

export function config(): ConfigApp {
  return actual
}

export const VERSION_APP: string = import.meta.env.VITE_APP_VERSION ?? 'dev'
