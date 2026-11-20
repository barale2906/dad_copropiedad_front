/** Textos de la publicidad compartidos por el directorio y la consola de la plataforma. */
import type { FormatoCreativo } from '@/api/tipos'

/** Textos del formato de una pieza. */
export const FORMATO_PIEZA: Record<FormatoCreativo, string> = {
  banner: 'Anuncio',
  tarjeta_destacada: 'Destacado',
  oferta_cupon: 'Oferta con cupón',
  mensaje_whatsapp: 'Mensaje',
  boletin_correo: 'Boletín',
  pantalla_lobby: 'Pantalla del lobby',
}
