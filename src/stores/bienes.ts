import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, exigir } from '@/api/cliente'
import type { BienPrivado, MiResidencia } from '@/api/tipos'
import { useEntidad } from './entidad'

/** Lo mínimo para mostrar y elegir un bien. */
export type BienCorto = Pick<BienPrivado, 'id' | 'codigo'>

/**
 * Bienes privados de la PH activa para cualquier módulo (reservas, censo, portería, cartera,
 * asambleas): los propios de la cuenta, buscar por código y el código de un bien por su id (las
 * respuestas del backend solo traen `bien_privado_id`). Se reinicia al cambiar de entidad.
 */
export const useBienes = defineStore('bienes', () => {
  const entidadId = ref<string | null>(null)
  const codigos = ref<Record<string, string>>({})
  const propios = ref<BienPrivado[] | null>(null)
  const residencias = ref<MiResidencia[] | null>(null)
  let pendientes = new Set<string>()

  /** Id de la entidad activa; si cambió, olvida lo de la anterior. */
  function actual(): string {
    const id = useEntidad().activa?.entidad_id ?? ''
    if (entidadId.value !== id) {
      entidadId.value = id
      codigos.value = {}
      propios.value = null
      residencias.value = null
      pendientes = new Set()
    }
    return id
  }

  function recordar(lista: BienCorto[]) {
    actual()
    codigos.value = { ...codigos.value, ...Object.fromEntries(lista.map((b) => [b.id, b.codigo])) }
  }

  /** Bienes de los que la cuenta es titular vigente (no exige permisos). */
  async function asegurarPropios(): Promise<BienPrivado[]> {
    const id = actual()
    if (propios.value) return propios.value
    const lista = await exigir(
      api().GET('/api/v1/copropiedades/{copropiedad_id}/mis-bienes-privados', { params: { path: { copropiedad_id: id } } }),
    )
    // Si la entidad cambió mientras se consultaba, la lista es de la anterior: no se guarda.
    if (actual() === id) {
      propios.value = lista
      recordar(lista)
    }
    return lista
  }

  /** Bienes donde la cuenta reside hoy, con su calidad (no exige permisos). */
  async function asegurarResidencias(): Promise<MiResidencia[]> {
    const id = actual()
    if (residencias.value) return residencias.value
    const lista = await exigir(
      api().GET('/api/v1/copropiedades/{copropiedad_id}/mis-residencias', { params: { path: { copropiedad_id: id } } }),
    )
    if (actual() === id) {
      residencias.value = lista
      recordar(lista.map((r) => ({ id: r.bien_privado_id, codigo: r.bien_codigo })))
    }
    return lista
  }

  /**
   * Bienes a cuyo nombre la cuenta puede actuar (reservar, anunciar visitas, radicar PQRS): los
   * que tiene como titular y aquellos donde reside (un arrendatario no es titular), sin repetir y
   * ordenados por código. Si una de las dos consultas falla, se usan los de la otra.
   */
  async function asegurarMisBienes(): Promise<BienCorto[]> {
    const [titular, reside] = await Promise.allSettled([asegurarPropios(), asegurarResidencias()])
    if (titular.status === 'rejected' && reside.status === 'rejected') throw titular.reason
    const lista = new Map<string, BienCorto>()
    if (titular.status === 'fulfilled') titular.value.forEach((b) => lista.set(b.id, { id: b.id, codigo: b.codigo }))
    if (reside.status === 'fulfilled') reside.value.forEach((r) => lista.set(r.bien_privado_id, { id: r.bien_privado_id, codigo: r.bien_codigo }))
    return [...lista.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
  }

  /** Página de bienes cuyo código contiene `q` (`bienes_privados.ver`). */
  async function buscar(q: string, despues?: string) {
    const id = actual()
    const pagina = await exigir(
      api().GET('/api/v1/copropiedades/{copropiedad_id}/bienes-privados', {
        params: { path: { copropiedad_id: id }, query: { q: q.trim() || undefined, limite: 20, despues } },
      }),
    )
    recordar(pagina.datos)
    return pagina
  }

  /**
   * Busca los códigos que faltan, en paralelo y sin repetir (requiere `bienes_privados.ver`;
   * sin él quedan como «Bien»).
   */
  async function resolver(ids: string[]): Promise<void> {
    const id = actual()
    if (!useEntidad().tienePermiso('bienes_privados.ver')) return
    const faltan = [...new Set(ids)].filter((b) => b && !(b in codigos.value) && !pendientes.has(b))
    faltan.forEach((b) => pendientes.add(b))
    await Promise.all(
      faltan.map(async (b) => {
        try {
          const ficha = await exigir(
            api().GET('/api/v1/copropiedades/{copropiedad_id}/bienes-privados/{bien_privado_id}', {
              params: { path: { copropiedad_id: id, bien_privado_id: b } },
            }),
          )
          // Copiar después de esperar: copiar antes pisaría lo que resuelvan las demás en paralelo.
          codigos.value = { ...codigos.value, [b]: ficha.bien_privado.codigo }
        } catch {
          /* se muestra «Bien» */
        } finally {
          pendientes.delete(b)
        }
      }),
    )
  }

  /** Código del bien, o «Bien» si aún no se conoce (o si es de otra entidad). */
  const codigo = (id: string) =>
    (entidadId.value === (useEntidad().activa?.entidad_id ?? '') ? codigos.value[id] : undefined) ?? 'Bien'

  return { codigos, propios, residencias, recordar, asegurarPropios, asegurarResidencias, asegurarMisBienes, buscar, resolver, codigo }
})
