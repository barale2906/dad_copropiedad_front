import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { BienPrivado, CobroRecurso, Recurso } from '@/api/tipos'
import { codigoDeBien, listarRecursos, misBienes, obtenerCobro } from './api'

/**
 * Datos de apoyo de Zonas comunes compartidos entre sus vistas: los recursos de la PH (las
 * reservas solo traen `recurso_id`), los códigos de los bienes y cómo se cobra cada recurso.
 * Se cargan una vez por entidad y bajo demanda.
 */
export const useZonasComunes = defineStore('zonas-comunes', () => {
  const entidadId = ref<string | null>(null)
  const recursos = ref<Recurso[]>([])
  const cargados = ref(false)
  const codigos = ref<Record<string, string>>({})
  const propios = ref<BienPrivado[] | null>(null)
  const cobros = ref<Record<string, CobroRecurso>>({})
  let pendientes = new Set<string>()

  function para(id: string) {
    if (entidadId.value === id) return
    entidadId.value = id
    recursos.value = []
    cargados.value = false
    codigos.value = {}
    propios.value = null
    cobros.value = {}
    pendientes = new Set()
  }

  /** Todos los recursos de la PH (una sola vez; `forzar` para recargar tras editar). */
  async function asegurarRecursos(id: string, forzar = false): Promise<Recurso[]> {
    para(id)
    if (!cargados.value || forzar) {
      recursos.value = await listarRecursos(id)
      cargados.value = true
    }
    return recursos.value
  }

  function recordarRecurso(r: Recurso) {
    const i = recursos.value.findIndex((x) => x.id === r.id)
    recursos.value = i < 0 ? [...recursos.value, r] : recursos.value.map((x) => (x.id === r.id ? r : x))
  }

  const nombreRecurso = (id: string) => recursos.value.find((r) => r.id === id)?.nombre ?? 'Recurso'
  const recurso = (id: string) => recursos.value.find((r) => r.id === id) ?? null

  /** Bienes de los que la cuenta es titular (para reservar a su nombre). */
  async function asegurarPropios(id: string): Promise<BienPrivado[]> {
    para(id)
    if (!propios.value) {
      propios.value = await misBienes(id)
      recordarBienes(propios.value)
    }
    return propios.value
  }

  function recordarBienes(lista: Pick<BienPrivado, 'id' | 'codigo'>[]) {
    codigos.value = { ...codigos.value, ...Object.fromEntries(lista.map((b) => [b.id, b.codigo])) }
  }

  /**
   * Busca los códigos que faltan (requiere `bienes_privados.ver`; sin él quedan como «Bien»).
   * Ignora los que ya se están buscando.
   */
  async function resolverBienes(id: string, ids: string[], puedeVer: boolean): Promise<void> {
    para(id)
    if (!puedeVer) return
    const faltan = [...new Set(ids)].filter((b) => !(b in codigos.value) && !pendientes.has(b))
    faltan.forEach((b) => pendientes.add(b))
    await Promise.all(
      faltan.map(async (b) => {
        try {
          // Esperar antes de copiar: con varias búsquedas en paralelo, copiar primero pisaría las demás.
          const codigo = await codigoDeBien(id, b)
          codigos.value = { ...codigos.value, [b]: codigo }
        } catch {
          /* se muestra «Bien» */
        } finally {
          pendientes.delete(b)
        }
      }),
    )
  }

  const codigoBien = (id: string) => codigos.value[id] ?? 'Bien'

  /** Cómo se cobra un recurso (decide si se ofrece «Registrar pago» o «Facturar»). */
  async function cobroDe(id: string, recursoId: string): Promise<CobroRecurso | null> {
    para(id)
    if (!cobros.value[recursoId]) {
      try {
        const cobro = await obtenerCobro(id, recursoId)
        cobros.value = { ...cobros.value, [recursoId]: cobro }
      } catch {
        return null
      }
    }
    return cobros.value[recursoId] ?? null
  }

  function recordarCobro(recursoId: string, c: CobroRecurso) {
    cobros.value = { ...cobros.value, [recursoId]: c }
  }

  return {
    recursos,
    codigos,
    cobros,
    asegurarRecursos,
    recordarRecurso,
    nombreRecurso,
    recurso,
    asegurarPropios,
    recordarBienes,
    resolverBienes,
    codigoBien,
    cobroDe,
    recordarCobro,
  }
})
