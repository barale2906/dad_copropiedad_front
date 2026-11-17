/** Textos del control de acceso que comparten el portal del residente y la portería. */
import type { TipoCorrespondencia, TipoVisita } from '@/api/tipos'

export const TIPO_VISITA: Record<TipoVisita, string> = {
  visita: 'Visita',
  domicilio: 'Domicilio',
  proveedor: 'Proveedor',
  trasteo: 'Trasteo',
  servicio_domestico: 'Servicio doméstico',
}

export const TIPO_PAQUETE: Record<TipoCorrespondencia, string> = {
  paquete: 'Paquete',
  sobre: 'Sobre',
  recibo: 'Recibo',
  otro: 'Otro',
}

/** Opciones para un `HudSelector` a partir de un mapa de textos. */
export const opcionesDe = <K extends string>(textos: Record<K, string>) =>
  (Object.keys(textos) as K[]).map((valor) => ({ valor, etiqueta: textos[valor] }))
