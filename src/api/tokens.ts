/**
 * Tokens de la sesión (guía del backend §4).
 *
 * - El token de acceso vive solo en memoria.
 * - El de renovación se guarda en `localStorage` para sobrevivir a recargas.
 * - **Cada renovación invalida el token anterior** y reutilizar uno ya usado revoca la sesión
 *   entera. Por eso se renueva desde un solo lugar: una promesa compartida en la pestaña y un
 *   candado (`navigator.locks`) entre pestañas; los tokens nuevos se difunden por
 *   `BroadcastChannel` para que las demás pestañas no renueven con uno viejo.
 */
import type { Tokens } from './tipos'

const CLAVE = 'dad.sesion.renovacion'
const MARGEN_MS = 30_000

type Transporte = (r: Request) => Promise<Response>

let acceso: { token: string; expira: number } | null = null
let renovacion: string | null = leerAlmacen()
let enCurso: Promise<boolean> | null = null
let transporte: Transporte = (r) => fetch(r)
let urlRenovar = ''
const oyentesCierre = new Set<() => void>()

const canal: BroadcastChannel | null =
  typeof BroadcastChannel === 'function' ? new BroadcastChannel('dad.sesion') : null

type Mensaje = { tipo: 'tokens'; tokens: Tokens } | { tipo: 'cerrada' }

canal?.addEventListener('message', (e: MessageEvent<Mensaje>) => {
  if (e.data.tipo === 'tokens') aplicar(e.data.tokens)
  else limpiar(false)
})

function leerAlmacen(): string | null {
  try {
    return localStorage.getItem(CLAVE)
  } catch {
    return null
  }
}

function escribirAlmacen(v: string | null): void {
  try {
    if (v) localStorage.setItem(CLAVE, v)
    else localStorage.removeItem(CLAVE)
  } catch {
    // Navegación privada o almacenamiento bloqueado: la sesión dura lo que dure la pestaña.
  }
}

function aplicar(t: Tokens): void {
  acceso = { token: t.token_acceso, expira: Date.parse(t.acceso_expira_en) }
  renovacion = t.token_renovacion
  escribirAlmacen(t.token_renovacion)
}

export function configurarTokens(opciones: { apiUrl: string; transporte: Transporte }): void {
  urlRenovar = `${opciones.apiUrl}/api/v1/auth/sesion/renovar`
  transporte = opciones.transporte
}

export function guardarTokens(t: Tokens): void {
  aplicar(t)
  canal?.postMessage({ tipo: 'tokens', tokens: t } satisfies Mensaje)
}

/** Token de acceso vigente (con margen), o `null` si hay que renovar. */
export function tokenAcceso(): string | null {
  return acceso && acceso.expira - MARGEN_MS > Date.now() ? acceso.token : null
}

export function haySesion(): boolean {
  return renovacion !== null || tokenAcceso() !== null
}

export function limpiar(difundir = true): void {
  const habia = haySesion()
  acceso = null
  renovacion = null
  escribirAlmacen(null)
  if (difundir) canal?.postMessage({ tipo: 'cerrada' } satisfies Mensaje)
  if (habia) oyentesCierre.forEach((f) => f())
}

/** Se llama cuando la sesión termina (vencida, revocada o cerrada en otra pestaña). */
export function alCerrarSesion(f: () => void): () => void {
  oyentesCierre.add(f)
  return () => oyentesCierre.delete(f)
}

async function conCandado<T>(f: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('dad.sesion.renovar', f)
  }
  return f()
}

/**
 * Renueva los tokens. `true` si hay un token de acceso vigente al terminar; `false` si la
 * sesión ya no es válida (se limpia). Errores de red se propagan.
 */
export function renovar(): Promise<boolean> {
  enCurso ??= (async () => {
    const previo = renovacion
    return conCandado(async () => {
      const almacenado = leerAlmacen() ?? renovacion
      // Otra pestaña renovó mientras esperábamos el candado y ya difundió los tokens.
      if (almacenado && almacenado !== previo && tokenAcceso()) return true
      if (!almacenado) {
        limpiar(false)
        return false
      }
      const r = await transporte(
        new Request(urlRenovar, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_renovacion: almacenado }),
        }),
      )
      if (r.ok) {
        guardarTokens((await r.json()) as Tokens)
        return true
      }
      if (r.status === 401) {
        limpiar()
        return false
      }
      throw new Error(`renovación falló: HTTP ${r.status}`)
    })
  })().finally(() => {
    enCurso = null
  })
  return enCurso
}
