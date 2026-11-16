/** Ayudantes compartidos por las pruebas unitarias y de componentes. */
import { createPinia, setActivePinia } from 'pinia'
import { iniciarCliente } from '@/api/cliente'
import type { Capacidades, EntidadDeLaCuenta } from '@/api/tipos'
import { fetchDemo } from '@/mocks/demo'
import { useEntidad } from '@/stores/entidad'

export const API = 'http://api.prueba'

/** Pinia limpio + cliente HTTP contra el backend simulado del modo demo. */
export function prepararConDemo(): void {
  localStorage.clear()
  setActivePinia(createPinia())
  iniciarCliente(API, fetchDemo)
}

export const ENTIDAD_PH: EntidadDeLaCuenta = {
  entidad_id: '00000000-0000-4000-8000-000000000001',
  nombre: 'Conjunto de prueba',
  nit: null,
  tipo: 'propiedad_horizontal',
  estado: 'activa',
  roles: ['administrador'],
}

/** Capacidades de prueba: `modo_soporte` es opcional (por defecto, sin soporte). */
export type CapacidadesDePrueba = Omit<Capacidades, 'modo_soporte'> & { modo_soporte?: boolean }

/** Deja una entidad activa con las capacidades dadas, sin pasar por la API. */
export function conCapacidades(cap: CapacidadesDePrueba, entidad: EntidadDeLaCuenta = ENTIDAD_PH) {
  const e = useEntidad()
  e.activa = entidad
  e.capacidades = { modo_soporte: false, ...cap }
  return e
}
