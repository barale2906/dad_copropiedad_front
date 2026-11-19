import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { perfilesTributarios } from '@/api/tributario'
import type { PerfilTributario } from '@/api/tipos'
import { useEntidad } from './entidad'

/**
 * Perfil tributario de la entidad activa, calculado una vez para todos los módulos: la versión
 * vigente confirmada (la de mayor versión con `vigente_desde` ya cumplido) y el borrador por
 * confirmar. Sin perfil confirmado no se emiten documentos ni hay ventas con IVA: lo avisan
 * tributario, contabilidad y facturación.
 */
export const usePerfilTributario = defineStore('perfil-tributario', () => {
  const entidadId = ref<string | null>(null)
  const perfiles = ref<PerfilTributario[]>([])
  const cargado = ref(false)
  let enCurso: Promise<void> | null = null

  const confirmados = computed(() => perfiles.value.filter((p) => p.estado === 'confirmado').sort((a, b) => b.version - a.version))
  const vigente = computed(() => confirmados.value[0] ?? null)
  const borrador = computed(() => perfiles.value.filter((p) => p.estado === 'borrador').sort((a, b) => b.version - a.version)[0] ?? null)
  /** Ya se consultó y no hay ninguna versión confirmada. */
  const sinConfirmar = computed(() => cargado.value && !vigente.value)

  function actual(): string {
    const id = useEntidad().activa?.entidad_id ?? ''
    if (entidadId.value !== id) {
      entidadId.value = id
      perfiles.value = []
      cargado.value = false
      enCurso = null
    }
    return id
  }

  async function cargar(id: string) {
    const lista = await perfilesTributarios(id)
    if (actual() !== id) return
    perfiles.value = lista
    cargado.value = true
  }

  async function asegurar(): Promise<void> {
    const id = actual()
    if (cargado.value) return
    enCurso ??= cargar(id).finally(() => (enCurso = null))
    await enCurso
  }

  async function recargar(): Promise<void> {
    const id = actual()
    cargado.value = false
    enCurso = null
    await cargar(id)
  }

  return { perfiles, cargado, vigente, borrador, sinConfirmar, asegurar, recargar }
})
