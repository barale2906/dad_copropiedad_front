/** Textos y reglas del censo: residencias, vehículos, mascotas y propuestas (funciones puras). */
import type {
  AlertaMascota,
  CalidadResidencia,
  EspecieMascota,
  EstadoCambioCenso,
  EstadoMascota,
  TipoCambioCenso,
  TipoVehiculo,
} from '@/api/tipos'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'

export const CALIDAD: Record<CalidadResidencia, string> = {
  propietario_residente: 'Propietario residente',
  tenedor: 'Arrendatario o tenedor',
  familiar: 'Familiar',
  huesped_temporal: 'Huésped temporal',
  empleado_domestico: 'Empleado doméstico',
}

export const TIPO_VEHICULO: Record<TipoVehiculo, string> = { carro: 'Carro', moto: 'Moto', bicicleta: 'Bicicleta', otro: 'Otro' }

export const ESPECIE: Record<EspecieMascota, string> = { perro: 'Perro', gato: 'Gato', otro: 'Otra' }

export const ESTADO_MASCOTA: Record<EstadoMascota, string> = { activa: 'Activa', fallecida: 'Fallecida', trasladada: 'Trasladada' }

export const ALERTA: Record<AlertaMascota, { texto: string; tono: Tono }> = {
  vacunas_vencidas: { texto: 'Vacunas vencidas', tono: 'peligro' },
  vacunas_por_vencer: { texto: 'Vacunas por vencer', tono: 'aviso' },
  sin_registro_de_vacunas: { texto: 'Sin registro de vacunas', tono: 'aviso' },
  sin_poliza: { texto: 'Sin póliza', tono: 'peligro' },
  poliza_vencida: { texto: 'Póliza vencida', tono: 'peligro' },
  poliza_por_vencer: { texto: 'Póliza por vencer', tono: 'aviso' },
}

export const TIPO_CAMBIO: Record<TipoCambioCenso, string> = { residencia: 'Residente', vehiculo: 'Vehículo', mascota: 'Mascota' }

export const ESTADO_CAMBIO: Record<EstadoCambioCenso, { texto: string; tono: Tono }> = {
  pendiente: { texto: 'Pendiente', tono: 'aviso' },
  aprobado: { texto: 'Aprobado', tono: 'exito' },
  rechazado: { texto: 'Rechazado', tono: 'neutro' },
}

/** Placa en mayúsculas y sin espacios ni guiones (`abc-12d` → `ABC12D`). */
export const normalizarPlaca = (placa: string) => placa.replace(/[\s-]/g, '').toUpperCase()

/** Nombres legibles de los campos que llegan en las propuestas. */
const CAMPO: Record<string, string> = {
  nombre: 'Nombre',
  documento: 'Documento',
  tipo_documento: 'Tipo de documento',
  telefono: 'Teléfono',
  correo: 'Correo',
  calidad: 'Calidad',
  es_responsable: 'Responsable del bien',
  tipo: 'Tipo',
  placa: 'Placa',
  marca: 'Marca',
  color: 'Color',
  especie: 'Especie',
  raza: 'Raza',
  potencialmente_peligrosa: 'Potencialmente peligrosa',
  esterilizada: 'Esterilizada',
  vacunas_vencen: 'Vacunas vencen',
  poliza_numero: 'Póliza',
  poliza_vence: 'Póliza vence',
}

const VALOR: Record<string, string> = { ...CALIDAD, ...TIPO_VEHICULO, ...ESPECIE }

function legible(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'string') return VALOR[v] ?? v
  if (typeof v === 'number') return String(v)
  return '…'
}

/**
 * Datos de una propuesta como lista campo → valor, en orden y sin ids internos. Los datos de una
 * persona anidada se aplanan («Nombre», «Documento»…).
 */
export function camposDePropuesta(datos: Record<string, unknown>): { campo: string; valor: string }[] {
  const filas: { campo: string; valor: string }[] = []
  for (const [k, v] of Object.entries(datos)) {
    if (k.endsWith('_id') || k === 'id') continue
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      filas.push(...camposDePropuesta(v as Record<string, unknown>))
    } else {
      filas.push({ campo: CAMPO[k] ?? k, valor: legible(v) })
    }
  }
  return filas
}
