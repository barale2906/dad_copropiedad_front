/**
 * Credenciales de los enlaces públicos (acuerdo A1): el token llega en el fragmento de la URL
 * (`#t=…`, también se acepta `#token=…`), se guarda **solo en memoria** y viaja en su cabecera
 * (`X-Papeleta`, `X-Enlace-Directorio`, `X-Pantalla`, `X-Comercio`), nunca en la ruta de la API.
 * No toca la sesión de la persona.
 */

export type TipoCredencial = 'papeleta' | 'directorio' | 'pantalla' | 'comercio'

/** Cabecera en la que el backend espera cada credencial. */
export const CABECERA = {
  papeleta: 'X-Papeleta',
  directorio: 'X-Enlace-Directorio',
  pantalla: 'X-Pantalla',
  comercio: 'X-Comercio',
} as const satisfies Record<TipoCredencial, string>

/** Todas las cabeceras de credencial externa (el cliente no les agrega la sesión). */
export const CABECERAS_EXTERNAS: readonly string[] = Object.values(CABECERA)

const tokens = new Map<TipoCredencial, string>()

/** Lo mínimo de `location` y `history` que se usa (para probarlo sin navegador). */
export interface Navegador {
  ubicacion: Pick<Location, 'hash' | 'pathname' | 'search'>
  historia: Pick<History, 'replaceState' | 'state'>
}

const navegador = (): Navegador => ({ ubicacion: window.location, historia: window.history })

/**
 * Lee el token del fragmento, lo guarda en memoria y lo borra de la barra de direcciones (salvo
 * con `conservar`: la pantalla del lobby debe recuperarse sola si el televisor recarga). Si el
 * fragmento no trae token, devuelve el que ya estaba en memoria.
 */
export function tomarCredencial(tipo: TipoCredencial, opciones: { conservar?: boolean; nav?: Navegador } = {}): string | null {
  const { ubicacion, historia } = opciones.nav ?? navegador()
  const datos = new URLSearchParams(ubicacion.hash.replace(/^#/, ''))
  const token = datos.get('t') ?? datos.get('token')
  if (token) {
    tokens.set(tipo, token)
    if (!opciones.conservar) historia.replaceState(historia.state, '', `${ubicacion.pathname}${ubicacion.search}`)
  }
  return tokens.get(tipo) ?? null
}

export function credencial(tipo: TipoCredencial): string | null {
  return tokens.get(tipo) ?? null
}

/** Cabecera de la credencial (vacía si no hay token: el backend responde 401). */
export function cabeceraDe<T extends TipoCredencial>(tipo: T): Record<(typeof CABECERA)[T], string> {
  return { [CABECERA[tipo]]: tokens.get(tipo) ?? '' } as Record<(typeof CABECERA)[T], string>
}

/** Olvida la credencial (enlace revocado o vencido). */
export function olvidarCredencial(tipo: TipoCredencial): void {
  tokens.delete(tipo)
}
