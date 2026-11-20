/**
 * Enlaces públicos sin sesión (acuerdo A1 con el backend): el backend entrega solo el token y el
 * frontend arma el enlace con el token en el **fragmento** (`#t=…`), que no llega al servidor ni
 * queda en registros ni en `Referer`.
 */

/**
 * Página pública: papeleta de la asamblea, directorio para los grupos, pantalla del lobby (de
 * una PH) o redención de cupones del comercio (sin id: el token identifica al comercio).
 */
export type TipoEnlacePublico = 'papeleta' | 'directorio' | 'pantalla' | 'comercio'

/** Origen de la web con su base (`https://web.dominio.co/`), donde viven las páginas públicas. */
function origenWeb(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href
}

/**
 * `enlacePublico('directorio', id, token)` → `https://<web>/directorio/<id>#t=<token>`;
 * `enlacePublico('comercio', null, token)` → `https://<web>/comercio#t=<token>`. El id y el token
 * se codifican: nunca se arma la URL con texto sin escapar.
 */
export function enlacePublico(tipo: TipoEnlacePublico, entidadId: string | null, token: string, origen: string = origenWeb()): string {
  const base = origen.endsWith('/') ? origen : `${origen}/`
  const ruta = entidadId === null ? tipo : `${tipo}/${encodeURIComponent(entidadId)}`
  return `${base}${ruta}#t=${encodeURIComponent(token)}`
}
