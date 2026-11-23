import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Administradora, CatalogoLaboral, ContratoConVersiones, EmpleadoResumen, FichaEmpleado } from '@/api/tipos'
import { catalogo as pedirCatalogo, empleado as pedirEmpleado, empleados as pedirEmpleados } from './api'
import { contratoVigente } from './reglas'

/** Páginas que se recorren como máximo al listar todos los empleados (50 por página). */
const MAX_PAGINAS = 20

/**
 * Catálogo laboral vigente y empleados de la entidad activa, que comparten las vistas de la
 * nómina: los periodos y las novedades solo traen `empleado_id` o `contrato_id`, y aquí se
 * resuelven sus nombres. Se piden una vez por entidad; `recargar` tras un alta o una importación.
 */
export const useNomina = defineStore('nomina', () => {
  const entidadId = ref<string | null>(null)
  const catalogo = ref<CatalogoLaboral | null>(null)
  const empleados = ref<EmpleadoResumen[]>([])
  const fichas = ref(new Map<string, FichaEmpleado>())
  let pendiente: Promise<void> | null = null
  let pendienteFichas: Promise<void> | null = null

  async function todosLosEmpleados(id: string): Promise<EmpleadoResumen[]> {
    const lista: EmpleadoResumen[] = []
    let despues: string | undefined
    for (let i = 0; i < MAX_PAGINAS; i++) {
      const p = await pedirEmpleados(id, despues)
      lista.push(...p.datos)
      if (!p.siguiente) break
      despues = p.siguiente
    }
    return lista
  }

  async function recargar(id: string): Promise<void> {
    const [c, e] = await Promise.all([pedirCatalogo(id), todosLosEmpleados(id)])
    if (entidadId.value !== id) fichas.value = new Map()
    entidadId.value = id
    catalogo.value = c
    empleados.value = e
  }

  /** Carga una vez por entidad (las llamadas simultáneas comparten la misma consulta). */
  function asegurar(id: string): Promise<void> {
    if (entidadId.value === id && catalogo.value) return Promise.resolve()
    pendiente ??= recargar(id).finally(() => (pendiente = null))
    return pendiente
  }

  /** Fichas de todos los empleados (para pasar de un contrato a su empleado). */
  function asegurarFichas(id: string): Promise<void> {
    pendienteFichas ??= (async () => {
      await asegurar(id)
      const faltan = empleados.value.filter((e) => !fichas.value.has(e.id))
      const nuevas = await Promise.all(faltan.map((e) => pedirEmpleado(id, e.id)))
      const mapa = new Map(fichas.value)
      for (const f of nuevas) mapa.set(f.id, f)
      fichas.value = mapa
    })().finally(() => (pendienteFichas = null))
    return pendienteFichas
  }

  /** Guarda una ficha recién pedida o cambiada (alta, prórroga, versión). */
  function recordar(f: FichaEmpleado): void {
    fichas.value = new Map(fichas.value).set(f.id, f)
  }

  const porContrato = computed(() => {
    const m = new Map<string, { empleado: FichaEmpleado; contrato: ContratoConVersiones }>()
    for (const f of fichas.value.values()) for (const c of f.contratos) m.set(c.contrato.id, { empleado: f, contrato: c })
    return m
  })

  /** Empleados con un contrato sin terminar, para registrar novedades. */
  const conContratoVigente = computed(() =>
    [...fichas.value.values()]
      .flatMap((f) => {
        const c = contratoVigente(f)
        return c ? [{ empleado: f, contrato: c }] : []
      })
      .sort((a, b) => a.empleado.codigo.localeCompare(b.empleado.codigo, 'es', { numeric: true })),
  )

  const empleado = (id: string) => empleados.value.find((e) => e.id === id) ?? null
  const nombre = (empleadoId: string) => {
    const e = empleado(empleadoId)
    return e ? `${e.codigo} · ${e.nombre}` : 'Empleado'
  }
  const nombreDelContrato = (contratoId: string) => {
    const x = porContrato.value.get(contratoId)
    return x ? `${x.empleado.codigo} · ${x.empleado.nombre}` : 'Empleado'
  }
  const administradoras = computed<Administradora[]>(() => catalogo.value?.administradoras ?? [])
  const administradora = (id: string | null | undefined) => (id ? (administradoras.value.find((a) => a.id === id)?.nombre ?? 'Administradora') : '—')

  return {
    catalogo,
    empleados,
    fichas,
    administradoras,
    porContrato,
    conContratoVigente,
    asegurar,
    asegurarFichas,
    recargar,
    recordar,
    empleado,
    nombre,
    nombreDelContrato,
    administradora,
  }
})
