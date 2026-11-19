/**
 * Enlaces de contacto y textos del directorio. Los datos de contacto vienen de la ficha del
 * comercio (los carga la plataforma): se validan antes de armar un enlace (`tel:`, `wa.me`,
 * `mailto:`, `https:`) para no abrir esquemas inesperados.
 */
import { comparar, multiplicar, numero } from './decimales'

/** Solo dígitos (con `+` inicial opcional): `"+57 300 123 4567"` → `"573001234567"`. */
function digitos(texto: string): string | null {
  const limpio = texto.replace(/[\s().-]/g, '').replace(/^\+/, '')
  return /^\d{7,15}$/.test(limpio) ? limpio : null
}

/** `tel:` del teléfono, o `null` si no parece un número. */
export function enlaceTelefono(telefono: string | null | undefined): string | null {
  const d = telefono ? digitos(telefono) : null
  return d ? `tel:+${d}` : null
}

/** Chat de WhatsApp (`https://wa.me/<número>`), con un texto escrito opcional. */
export function enlaceWhatsapp(numeroWhatsapp: string | null | undefined, texto?: string): string | null {
  const d = numeroWhatsapp ? digitos(numeroWhatsapp) : null
  if (!d) return null
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

/** `mailto:` del correo, o `null` si no parece un correo. */
export function enlaceCorreo(correo: string | null | undefined): string | null {
  return correo && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(correo) ? `mailto:${correo}` : null
}

/** El sitio web solo si es `http(s)`; cualquier otro esquema (`javascript:`…) se descarta. */
export function enlaceSeguro(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

/** `"1.2"` → `"a 1,2 km"`; menos de 1 km en metros (`"0.35"` → `"a 350 m"`). */
export function distanciaLegible(km: string | null | undefined): string | null {
  if (!km || !/^\d+(\.\d+)?$/.test(km)) return null
  return comparar(km, '1') < 0 ? `a ${numero(multiplicar(km, '1000'), 0)} m` : `a ${numero(km, 1)} km`
}

/** `"4.5"` → `"4,5"` (promedio de 1 a 5 con un decimal). */
export function calificacionLegible(promedio: string): string {
  return numero(promedio, 1)
}
