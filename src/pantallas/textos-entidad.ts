/** Textos para el usuario sobre el tipo y el estado de una entidad (selector y barra superior). */
import type { EstadoEntidad, TipoEntidad } from '@/api/tipos'

export const TIPO_ENTIDAD: Record<TipoEntidad, string> = {
  propiedad_horizontal: 'Propiedad horizontal',
  empresa: 'Empresa',
  plataforma: 'Plataforma',
}

export const ESTADO_ENTIDAD: Record<EstadoEntidad, string> = {
  en_configuracion: 'En configuración',
  activa: 'Activa',
  suspendida: 'Suspendida',
  retirada: 'Retirada',
}

/**
 * Aviso para una entidad que no está activa (la guía pide avisarlo), o `null` si lo está.
 * El backend sigue decidiendo qué operaciones admite en cada estado.
 */
export function avisoDeEstado(estado: EstadoEntidad): string | null {
  switch (estado) {
    case 'activa':
      return null
    case 'en_configuracion':
      return 'Esta entidad aún está en configuración.'
    case 'suspendida':
      return 'Esta entidad está suspendida. Comuníquese con DAD para reactivarla.'
    case 'retirada':
      return 'Esta entidad fue retirada del servicio.'
  }
}
