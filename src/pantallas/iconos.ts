/** Icono de cada sección (Tabler, solo se empaquetan los que se importan). */
import type { Component } from 'vue'
import IArchivo from '~icons/tabler/archive'
import IBanco from '~icons/tabler/building-bank'
import ICalculadora from '~icons/tabler/calculator'
import IEdificio from '~icons/tabler/building-skyscraper'
import IEscudo from '~icons/tabler/shield-lock'
import IFactura from '~icons/tabler/file-invoice'
import IFicha from '~icons/tabler/id-badge-2'
import IGrupo from '~icons/tabler/users-group'
import IImpuesto from '~icons/tabler/receipt-tax'
import ILista from '~icons/tabler/clipboard-list'
import IPiscina from '~icons/tabler/pool'
import ITv from '~icons/tabler/device-tv'
import IUsuarios from '~icons/tabler/users'
import IBilletera from '~icons/tabler/wallet'

export const ICONOS: Record<string, Component> = {
  unidades: IEdificio,
  'zonas-comunes': IPiscina,
  porteria: IEscudo,
  asambleas: IGrupo,
  administracion: ILista,
  cartera: IBilletera,
  contabilidad: ICalculadora,
  tesoreria: IBanco,
  tributario: IImpuesto,
  facturacion: IFactura,
  publicidad: ITv,
  entidad: IFicha,
  archivo: IArchivo,
  nomina: IUsuarios,
}
