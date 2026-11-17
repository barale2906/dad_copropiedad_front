import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, exigir } from '@/api/cliente'
import type { Capacidades, EntidadDeLaCuenta, FichaEntidad, Modulo, Permiso } from '@/api/tipos'
import { useSesion } from './sesion'

const CLAVE_ULTIMA = 'dad.entidad.ultima'

/**
 * Zona horaria cuando no se puede leer la ficha (la consulta exige `copropiedad.datos.ver`, que
 * residentes y porteros no tienen). Hoy todas las entidades operan en Colombia.
 */
export const ZONA_HORARIA_PREDETERMINADA = 'America/Bogota'

/** Entidad activa (PH o empresa) y lo que la cuenta puede hacer en ella. */
export const useEntidad = defineStore('entidad', () => {
  const activa = ref<EntidadDeLaCuenta | null>(null)
  const capacidades = ref<Capacidades | null>(null)
  const ficha = ref<FichaEntidad | null>(null)

  const modulos = computed(() => new Set<Modulo>(capacidades.value?.modulos ?? []))
  const permisos = computed(() => new Set<Permiso>(capacidades.value?.permisos ?? []))
  const esPH = computed(
    () => (capacidades.value?.tipo ?? activa.value?.tipo) === 'propiedad_horizontal',
  )
  /** Acceso de soporte de la plataforma: la entidad se ve en solo lectura (plan 15). */
  const modoSoporte = computed(() => capacidades.value?.modo_soporte ?? false)
  /**
   * Suspendida por la plataforma (p. ej. por mora): los permisos ya llegan recortados a lecturas,
   * portería y atención a titulares; un 403 `sin_permiso` se debe a la suspensión.
   */
  const suspendida = computed(
    () => (capacidades.value?.entidad_suspendida ?? false) || activa.value?.estado === 'suspendida',
  )
  /** Zona IANA en que se muestran las fechas de la entidad (nunca la del navegador). */
  const zonaHoraria = computed(() => ficha.value?.zona_horaria ?? ZONA_HORARIA_PREDETERMINADA)

  function tieneModulo(m: Modulo): boolean {
    return modulos.value.has(m)
  }

  function tienePermiso(p: Permiso): boolean {
    return permisos.value.has(p)
  }

  /** Rol de la cuenta en la entidad (p. ej. los derivados `propietario` y `residente`). */
  function tieneRol(rol: string): boolean {
    return activa.value?.roles.includes(rol) ?? false
  }

  /**
   * Entra a la entidad: pide sus capacidades (permisos efectivos + módulos contratados) y, si
   * la cuenta puede verla, su ficha (zona horaria). Sin ficha se entra igual.
   */
  async function entrar(entidadId: string): Promise<void> {
    if (activa.value?.entidad_id === entidadId && capacidades.value) return
    const e = useSesion().entidades.find((x) => x.entidad_id === entidadId)
    if (!e) throw new Error('La cuenta no tiene acceso a esa entidad')
    const cap = await exigir(
      api().GET('/api/v1/entidades/{entidad_id}/capacidades', {
        params: { path: { entidad_id: entidadId } },
      }),
    )
    activa.value = e
    capacidades.value = cap
    ficha.value = await cargarFicha(entidadId, cap)
    try {
      localStorage.setItem(CLAVE_ULTIMA, entidadId)
    } catch {
      /* sin almacenamiento */
    }
  }

  async function cargarFicha(entidadId: string, cap: Capacidades): Promise<FichaEntidad | null> {
    if (!cap.permisos.includes('copropiedad.datos.ver')) return null
    try {
      return await exigir(
        api().GET('/api/v1/entidades/{entidad_id}', { params: { path: { entidad_id: entidadId } } }),
      )
    } catch {
      return null
    }
  }

  /** Tras un 403 `sin_permiso` o `modulo_no_habilitado`: los roles o el contrato cambiaron. */
  async function refrescar(): Promise<void> {
    const id = activa.value?.entidad_id
    capacidades.value = null
    if (id) await entrar(id)
  }

  function salir(): void {
    activa.value = null
    capacidades.value = null
    ficha.value = null
  }

  function ultima(): string | null {
    try {
      return localStorage.getItem(CLAVE_ULTIMA)
    } catch {
      return null
    }
  }

  return {
    activa,
    capacidades,
    ficha,
    esPH,
    modoSoporte,
    suspendida,
    zonaHoraria,
    tieneModulo,
    tienePermiso,
    tieneRol,
    entrar,
    refrescar,
    salir,
    ultima,
  }
})
