/**
 * Verificación pública de certificados (sin sesión: el código es la credencial). Valen los códigos
 * que emite el demo (`PYS-…` paz y salvo, `DEU-…` deuda); tras 5 códigos que no corresponden, 429
 * con `Retry-After`, como el límite por IP del backend.
 */
import { cuerpo, error, fechaDemo, json, type Manejador } from './http'

let fallidos = 0

export function iniciarPublico(): void {
  fallidos = 0
}

export const verificacionDemo: Manejador = async (req, ruta) => {
  if (req.method !== 'POST' || !/^\/copropiedades\/[^/]+\/certificados\/verificacion$/.test(ruta)) return null
  if (fallidos >= 5) {
    const r = error(429, 'demasiadas_peticiones', 'Demasiados intentos desde esta conexión.')
    r.headers.set('Retry-After', '30')
    return r
  }
  const { codigo } = await cuerpo<{ codigo: string }>(req)
  if (/^PYS-[A-Z0-9-]+$/.test(codigo)) return json({ valido: true, tipo: 'paz_y_salvo', corte: fechaDemo(-3) })
  if (/^DEU-[A-Z0-9-]+$/.test(codigo)) return json({ valido: true, tipo: 'deuda', corte: fechaDemo(-3) })
  fallidos++
  return json({ valido: false, tipo: null, corte: null })
}
