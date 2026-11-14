import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, exigir } from '@/api/cliente'
import type { Capacidades, EntidadDeLaCuenta, Modulo, Permiso } from '@/api/tipos'
import { useSesion } from './sesion'

const CLAVE_ULTIMA = 'dad.entidad.ultima'

/** Entidad activa (PH o empresa) y lo que la cuenta puede hacer en ella. */
export const useEntidad = defineStore('entidad', () => {
  const activa = ref<EntidadDeLaCuenta | null>(null)
  const capacidades = ref<Capacidades | null>(null)

  const modulos = computed(() => new Set<Modulo>(capacidades.value?.modulos ?? []))
  const permisos = computed(() => new Set<Permiso>(capacidades.value?.permisos ?? []))
  const esPH = computed(
    () => (capacidades.value?.tipo ?? activa.value?.tipo) === 'propiedad_horizontal',
  )

  function tieneModulo(m: Modulo): boolean {
    return modulos.value.has(m)
  }

  function tienePermiso(p: Permiso): boolean {
    return permisos.value.has(p)
  }

  /** Entra a la entidad y pide sus capacidades (permisos efectivos + módulos contratados). */
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
    try {
      localStorage.setItem(CLAVE_ULTIMA, entidadId)
    } catch {
      /* sin almacenamiento */
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
    esPH,
    tieneModulo,
    tienePermiso,
    entrar,
    refrescar,
    salir,
    ultima,
  }
})
