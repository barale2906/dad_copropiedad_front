import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { centrosCosto, cuentasContables, tiposComprobante } from '@/api/contabilidad'
import type { CentroCosto, CuentaContable, TipoComprobante } from '@/api/tipos'
import { useEntidad } from './entidad'

/**
 * Plan de cuentas, centros de costo y tipos de comprobante de la entidad activa, para cualquier
 * módulo contable (contabilidad, tesorería, cartera, facturación). Se carga una vez y se
 * reinicia al cambiar de entidad; tras crear o editar, `recargar()`.
 */
export const usePlanCuentas = defineStore('plan-cuentas', () => {
  const entidadId = ref<string | null>(null)
  const cuentas = ref<CuentaContable[]>([])
  const centros = ref<CentroCosto[]>([])
  const tipos = ref<TipoComprobante[]>([])
  const cargado = ref(false)
  let enCurso: Promise<void> | null = null

  const porId = computed(() => new Map(cuentas.value.map((c) => [c.id, c])))
  const porCodigo = computed(() => new Map(cuentas.value.map((c) => [c.codigo, c])))
  const centroPorId = computed(() => new Map(centros.value.map((c) => [c.id, c])))
  /** Cuentas donde se puede registrar (auxiliares activas que aceptan movimiento). */
  const imputables = computed(() => cuentas.value.filter((c) => c.activa && c.acepta_movimiento))

  function actual(): string {
    const id = useEntidad().activa?.entidad_id ?? ''
    if (entidadId.value !== id) {
      entidadId.value = id
      cuentas.value = []
      centros.value = []
      tipos.value = []
      cargado.value = false
      enCurso = null
    }
    return id
  }

  async function cargar(id: string) {
    const [c, cc, t] = await Promise.all([cuentasContables(id), centrosCosto(id), tiposComprobante(id)])
    if (actual() !== id) return
    cuentas.value = [...c].sort((a, b) => a.codigo.localeCompare(b.codigo))
    centros.value = cc
    tipos.value = t
    cargado.value = true
  }

  /** Carga lo que falte (una sola petición a la vez). */
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

  return { cuentas, centros, tipos, cargado, porId, porCodigo, centroPorId, imputables, asegurar, recargar }
})
