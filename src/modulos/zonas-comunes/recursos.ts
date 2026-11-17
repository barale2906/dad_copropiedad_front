/** Textos de recursos, parqueaderos y la zona de la maqueta → recursos (funciones puras). */
import type {
  CategoriaBienComun,
  DestinoCobro,
  EstadoRecurso,
  MetodoEntrega,
  ModoAsignacion,
  NaturalezaParqueadero,
  OrigenAsignacionParqueadero,
  PoliticaReserva,
  QuienReserva,
  TipoParqueadero,
  TipoRecurso,
} from '@/api/tipos'
import { comparar, esDecimal, moneda } from '@/formato/decimales'
import { textoDuracion } from '@/formato/franjas'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'

export const CATEGORIA: Record<CategoriaBienComun, string> = {
  salon_social: 'Salón social',
  salon_comunal: 'Salón comunal',
  bbq: 'Zona BBQ',
  piscina: 'Piscina',
  gimnasio: 'Gimnasio',
  cancha: 'Cancha',
  sauna: 'Sauna',
  turco: 'Turco',
  jacuzzi: 'Jacuzzi',
  parque_infantil: 'Parque infantil',
  coworking: 'Coworking',
  sala_juegos: 'Sala de juegos',
  terraza: 'Terraza',
  otro: 'Otro',
}

export const TIPO_RECURSO: Record<TipoRecurso, string> = {
  bien_comun: 'Bien común',
  parqueadero: 'Parqueadero',
  agenda_administracion: 'Agenda de la administración',
  herramienta: 'Herramienta prestable',
}

export const ESTADO_RECURSO: Record<EstadoRecurso, { texto: string; tono: Tono }> = {
  disponible: { texto: 'Disponible', tono: 'exito' },
  en_mantenimiento: { texto: 'En mantenimiento', tono: 'aviso' },
  fuera_de_servicio: { texto: 'Fuera de servicio', tono: 'peligro' },
  inactivo: { texto: 'Inactivo', tono: 'neutro' },
}

export const MODO: Record<ModoAsignacion, string> = {
  libre: 'Uso libre, sin reserva',
  franja_inmediata: 'Reserva con confirmación inmediata',
  franja_con_aprobacion: 'Reserva sujeta a aprobación',
  sorteo: 'Se asigna por sorteo',
  turno_rotativo: 'Turno rotativo',
}

export const QUIEN: Record<QuienReserva, string> = {
  propietario: 'Solo propietarios',
  residente: 'Solo residentes',
  ambos: 'Propietarios y residentes',
}

export const METODO_ENTREGA: Record<MetodoEntrega, string> = {
  sin_entrega: 'Sin entrega',
  entrega_llaves: 'Entrega de llaves',
  entrega_con_inventario: 'Entrega con inventario',
  acceso_automatico: 'Acceso automático',
}

export const DESTINO_COBRO: Record<DestinoCobro, { texto: string; ayuda: string }> = {
  manual: { texto: 'Pago registrado a mano', ayuda: 'La administración registra el pago en cada reserva.' },
  cartera: { texto: 'Cargo en la cuenta de cobro', ayuda: 'Al aprobar la reserva nace el cargo en la cartera del bien.' },
  factura: { texto: 'Factura de venta', ayuda: 'Cada reserva se factura con el ítem de facturación elegido.' },
}

export const TIPO_PARQUEADERO: Record<TipoParqueadero, string> = {
  carro: 'Carro',
  moto: 'Moto',
  bicicleta: 'Bicicleta',
  discapacidad: 'Movilidad reducida',
  electrico: 'Vehículo eléctrico',
}

export const NATURALEZA_PARQUEADERO: Record<NaturalezaParqueadero, string> = {
  privado: 'Privado',
  uso_exclusivo: 'Uso exclusivo',
  comunal: 'Comunal',
  visitantes: 'Visitantes',
}

export const ORIGEN_ASIGNACION: Record<OrigenAsignacionParqueadero, string> = {
  propiedad: 'Propiedad',
  sorteo: 'Sorteo',
  arriendo: 'Arriendo',
  manual: 'Asignación manual',
}

/** Lo que se reserva desde cada zona de la maqueta (`?zona=`). */
export interface FiltroZona {
  nombre: string
  categorias?: CategoriaBienComun[]
  tipo?: TipoRecurso
}

const ZONAS: Record<string, FiltroZona> = {
  'salon-social': { nombre: 'salón social', categorias: ['salon_social', 'salon_comunal'] },
  piscina: { nombre: 'piscina', categorias: ['piscina'] },
  cancha: { nombre: 'cancha', categorias: ['cancha'] },
  gimnasio: { nombre: 'gimnasio', categorias: ['gimnasio'] },
  parqueaderos: { nombre: 'parqueaderos para reservar', tipo: 'parqueadero' },
}

/** Zona de la maqueta → qué recursos mostrar; `null` sin zona o si no se conoce. */
export function filtroDeZona(zona: unknown): FiltroZona | null {
  return typeof zona === 'string' ? (ZONAS[zona] ?? null) : null
}

/** ¿La política permite que la cuenta reserve (y no es por sorteo o uso libre)? */
export const esReservable = (p: Pick<PoliticaReserva, 'modo'>) => p.modo === 'franja_inmediata' || p.modo === 'franja_con_aprobacion'

/** Resumen legible de la política para mostrar antes de confirmar. */
export function resumenPolitica(p: PoliticaReserva): string[] {
  const lineas = [MODO[p.modo]]
  lineas.push(
    p.duracion_minima_min === p.duracion_maxima_min
      ? `Duración: ${textoDuracion(p.duracion_minima_min)}`
      : `Duración: de ${textoDuracion(p.duracion_minima_min)} a ${textoDuracion(p.duracion_maxima_min)}`,
  )
  lineas.push(`Reserve con al menos ${p.anticipacion_minima_horas} h y hasta ${p.anticipacion_maxima_dias} días de anticipación`)
  if (comparar(p.tarifa, '0') > 0) {
    lineas.push(`Tarifa: ${moneda(p.tarifa)} por ${p.cobro_por === 'hora' ? 'hora' : 'reserva'}`)
    if (p.tarifa_festivo && comparar(p.tarifa_festivo, p.tarifa) !== 0) lineas.push(`En festivos: ${moneda(p.tarifa_festivo)}`)
  } else {
    lineas.push('Sin costo')
  }
  if (comparar(p.deposito, '0') > 0) lineas.push(`Depósito: ${moneda(p.deposito)}`)
  if (p.aforo) lineas.push(`Aforo: ${p.aforo} personas`)
  if (p.max_invitados > 0) lineas.push(`Hasta ${p.max_invitados} invitados`)
  if (comparar(p.penalidad_porcentaje, '0') > 0) {
    lineas.push(
      `Cancelar con menos de ${p.cancelacion_sin_penalidad_horas} h de anticipación cuesta el ${p.penalidad_porcentaje} % del valor`,
    )
  }
  if (p.max_reservas_mes) lineas.push(`Máximo ${p.max_reservas_mes} reservas al mes por bien`)
  lineas.push(QUIEN[p.quien])
  return lineas
}

/** Política por defecto de un bien común nuevo (la administración la ajusta). */
export const POLITICA_INICIAL: PoliticaReserva = {
  modo: 'franja_inmediata',
  duracion_minima_min: 60,
  duracion_maxima_min: 240,
  granularidad_min: 60,
  anticipacion_minima_horas: 2,
  anticipacion_maxima_dias: 30,
  max_reservas_mes: null,
  max_simultaneas: 1,
  alistamiento_min: 0,
  quien: 'ambos',
  tenedor_requiere_autorizacion: false,
  aforo: null,
  tarifa: '0',
  cobro_por: 'reserva',
  tarifa_festivo: null,
  deposito: '0',
  cancelacion_sin_penalidad_horas: 24,
  penalidad_porcentaje: '0',
  max_invitados: 0,
  metodo_entrega: 'sin_entrega',
}

/** Campos numéricos enteros de la política (en el formulario van como texto). */
export const ENTEROS = [
  'duracion_minima_min',
  'duracion_maxima_min',
  'granularidad_min',
  'anticipacion_minima_horas',
  'anticipacion_maxima_dias',
  'alistamiento_min',
  'cancelacion_sin_penalidad_horas',
  'max_invitados',
] as const
export const OPCIONALES = ['max_reservas_mes', 'max_simultaneas', 'aforo'] as const

type Entero = (typeof ENTEROS)[number] | (typeof OPCIONALES)[number]

/** Valores del formulario de la política: los números como texto (vacío = sin límite). */
export type ValoresPolitica = Omit<PoliticaReserva, Entero | 'tarifa_festivo'> & Record<Entero, string> & { tarifa_festivo: string }

export function aValoresPolitica(p: PoliticaReserva): ValoresPolitica {
  const v = { ...p, tarifa_festivo: p.tarifa_festivo ?? '' } as unknown as Record<string, unknown>
  for (const c of [...ENTEROS, ...OPCIONALES]) v[c] = p[c] === null || p[c] === undefined ? '' : String(p[c])
  return v as ValoresPolitica
}

const entero = (t: string) => (/^\d+$/.test(t.trim()) ? Number.parseInt(t, 10) : Number.NaN)

/** Errores por campo (vacío = válida). */
export function validarPolitica(v: ValoresPolitica): Partial<Record<keyof ValoresPolitica, string>> {
  const e: Partial<Record<keyof ValoresPolitica, string>> = {}
  for (const c of ENTEROS) if (Number.isNaN(entero(v[c]))) e[c] = 'Escriba un número entero.'
  for (const c of OPCIONALES) if (v[c].trim() && Number.isNaN(entero(v[c]))) e[c] = 'Escriba un número entero o déjelo vacío.'
  const min = entero(v.duracion_minima_min)
  const max = entero(v.duracion_maxima_min)
  const paso = entero(v.granularidad_min)
  if (!e.granularidad_min && paso <= 0) e.granularidad_min = 'Debe ser mayor que cero.'
  if (!e.duracion_maxima_min && !e.duracion_minima_min && max < min) e.duracion_maxima_min = 'No puede ser menor que la mínima.'
  if (!e.duracion_minima_min && min <= 0) e.duracion_minima_min = 'Debe ser mayor que cero.'
  for (const c of ['tarifa', 'deposito', 'penalidad_porcentaje'] as const) if (!esDecimal(v[c] || '0')) e[c] = 'Escriba un valor válido.'
  if (v.tarifa_festivo && !esDecimal(v.tarifa_festivo)) e.tarifa_festivo = 'Escriba un valor válido.'
  if (!e.penalidad_porcentaje && comparar(v.penalidad_porcentaje || '0', '100') > 0) e.penalidad_porcentaje = 'No puede pasar del 100 %.'
  return e
}

/** Valores del formulario → política para el backend. */
export function dePolitica(v: ValoresPolitica): PoliticaReserva {
  const p = { ...v } as unknown as Record<string, unknown>
  for (const c of ENTEROS) p[c] = entero(v[c])
  for (const c of OPCIONALES) p[c] = v[c].trim() ? entero(v[c]) : null
  p.tarifa = v.tarifa || '0'
  p.deposito = v.deposito || '0'
  p.penalidad_porcentaje = v.penalidad_porcentaje || '0'
  p.tarifa_festivo = v.tarifa_festivo || null
  return p as unknown as PoliticaReserva
}
