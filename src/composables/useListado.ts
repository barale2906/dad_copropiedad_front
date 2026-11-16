import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { ErrorApi, mensajeDeError } from '@/api/errores'

/** Página de un listado por cursor (`PaginaRespuesta_…` del contrato). */
export interface Pagina<T> {
  datos: T[]
  siguiente?: string | null
}

export type EstadoListado = 'cargando' | 'listo' | 'vacio' | 'error'

export interface OpcionesListado<F> {
  /** Filtros reactivos: al cambiar, se recarga desde la primera página (con retardo). */
  filtros?: Ref<F>
  /** Espera tras el último cambio de filtros antes de consultar (búsqueda al escribir). */
  retardo?: number
  /** Consultar al crear (por defecto, sí). */
  inmediato?: boolean
}

/**
 * Listado paginado por cursor (`limite`, `despues`, `siguiente`): primera página, «cargar
 * más», recarga y búsqueda con retardo. Descarta respuestas viejas si los filtros cambian
 * mientras se consulta.
 *
 * ```ts
 * const reservas = useListado((despues, f) =>
 *   exigir(api().GET('…/reservas', { params: { query: { despues, limite: 50, estado: f.estado } } })),
 *   { filtros })
 * ```
 */
export function useListado<T, F = undefined>(
  consultar: (despues: string | undefined, filtros: F) => Promise<Pagina<T>>,
  opciones: OpcionesListado<F> = {},
) {
  const { filtros, retardo = 300, inmediato = true } = opciones

  const filas = shallowRef<T[]>([])
  const siguiente = ref<string | null>(null)
  const primeraCarga = ref(true)
  const cargando = ref(false)
  const error = ref<string | null>(null)
  const referencia = ref<string | null>(null)
  let turno = 0
  let temporizador: ReturnType<typeof setTimeout> | undefined

  const estado = computed<EstadoListado>(() => {
    if (error.value && filas.value.length === 0) return 'error'
    if (primeraCarga.value) return 'cargando'
    return filas.value.length === 0 ? 'vacio' : 'listo'
  })
  const hayMas = computed(() => siguiente.value !== null)

  async function pedir(despues: string | undefined): Promise<void> {
    const mio = ++turno
    cargando.value = true
    error.value = null
    referencia.value = null
    try {
      const p = await consultar(despues, filtros?.value as F)
      if (mio !== turno) return
      filas.value = despues ? [...filas.value, ...p.datos] : p.datos
      siguiente.value = p.siguiente ?? null
    } catch (e) {
      if (mio !== turno) return
      error.value = mensajeDeError(e)
      referencia.value = e instanceof ErrorApi ? e.requestId : null
    } finally {
      if (mio === turno) {
        cargando.value = false
        primeraCarga.value = false
      }
    }
  }

  /** Vuelve a la primera página (tras crear o editar algo, o al pulsar «Reintentar»). */
  function recargar(): Promise<void> {
    clearTimeout(temporizador)
    if (filas.value.length === 0) primeraCarga.value = true
    return pedir(undefined)
  }

  /** Trae la página siguiente y la agrega al final. */
  function cargarMas(): Promise<void> {
    if (!siguiente.value || cargando.value) return Promise.resolve()
    return pedir(siguiente.value)
  }

  if (filtros) {
    watch(
      filtros,
      () => {
        clearTimeout(temporizador)
        temporizador = setTimeout(() => {
          filas.value = []
          primeraCarga.value = true
          void pedir(undefined)
        }, retardo)
      },
      { deep: true },
    )
  }

  onScopeDispose(() => {
    clearTimeout(temporizador)
    turno++
  })

  if (inmediato) void pedir(undefined)

  return { filas, estado, cargando, error, referencia, hayMas, cargarMas, recargar }
}
