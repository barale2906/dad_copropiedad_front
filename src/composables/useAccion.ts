import { computed, onScopeDispose, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ErrorApi, mensajeDeError } from '@/api/errores'
import { uuid } from '@/api/uuid'
import { useEntidad } from '@/stores/entidad'

export interface OpcionesAccion<R> {
  /** 409 `conflicto_estado`: el recurso cambió; recárguelo (el mensaje se muestra igual). */
  alConflicto?: () => void | Promise<void>
  alExito?: (resultado: R) => void
}

/**
 * Ejecuta una acción del usuario contra la API (crear, aprobar, anular…):
 *
 * - Genera la `Idempotency-Key` al **iniciar** la acción y la reutiliza en los reintentos,
 *   hasta que termina bien (entonces la próxima acción usa otra).
 * - `cargando` sirve para deshabilitar el botón; mientras dura, no se ejecuta dos veces.
 * - Traduce los errores por `codigo`: 403 `sin_permiso` / `modulo_no_habilitado` refresca las
 *   capacidades; 409 `conflicto_estado` llama `alConflicto`; 403 `segundo_factor_requerido`
 *   lleva a Mi cuenta; 429 bloquea con cuenta regresiva (`segundosEspera`).
 *
 * ```ts
 * const aprobar = useAccion((clave, id: string) =>
 *   exigir(api().POST('…/{id}/aprobar', { params: …, headers: idempotencia(clave) })))
 * ```
 */
export function useAccion<A extends unknown[], R>(
  fn: (clave: string, ...args: A) => Promise<R>,
  opciones: OpcionesAccion<R> = {},
) {
  const entidad = useEntidad()
  const router = useRouter()

  const cargando = ref(false)
  const error = ref<string | null>(null)
  const codigo = ref<ErrorApi['codigo'] | null>(null)
  const bloqueadoHasta = ref(0)
  const ahora = ref(Date.now())
  let clave: string | null = null
  let reloj: ReturnType<typeof setInterval> | undefined

  const segundosEspera = computed(() => Math.max(0, Math.ceil((bloqueadoHasta.value - ahora.value) / 1000)))

  function esperar(segundos: number) {
    bloqueadoHasta.value = Date.now() + segundos * 1000
    ahora.value = Date.now()
    clearInterval(reloj)
    reloj = setInterval(() => {
      ahora.value = Date.now()
      if (segundosEspera.value === 0) clearInterval(reloj)
    }, 1000)
  }

  async function traducir(e: unknown) {
    error.value = mensajeDeError(e)
    codigo.value = e instanceof ErrorApi ? e.codigo : null
    if (!(e instanceof ErrorApi)) return
    switch (e.codigo) {
      case 'sin_permiso':
      case 'modulo_no_habilitado':
        await entidad.refrescar().catch(() => undefined)
        break
      case 'conflicto_estado':
        await opciones.alConflicto?.()
        break
      case 'segundo_factor_requerido':
        error.value = 'Esta acción exige el segundo factor. Actívelo en Mi cuenta.'
        await router.push({ name: 'cuenta', hash: '#segundo-factor' })
        break
      case 'idempotencia_reusada':
        // La clave se usó con otros datos: la próxima vez va una nueva.
        clave = null
        break
      case 'demasiadas_peticiones':
      case 'demasiados_intentos':
        if (e.reintentarEn) esperar(e.reintentarEn)
        break
    }
  }

  /** Ejecuta la acción; devuelve el resultado o `undefined` si falló (ver `error`). */
  async function ejecutar(...args: A): Promise<R | undefined> {
    if (cargando.value || segundosEspera.value > 0) return undefined
    cargando.value = true
    error.value = null
    codigo.value = null
    clave ??= uuid()
    try {
      const r = await fn(clave, ...args)
      clave = null
      opciones.alExito?.(r)
      return r
    } catch (e) {
      await traducir(e)
      return undefined
    } finally {
      cargando.value = false
    }
  }

  /** Olvida el error y la clave (p. ej. al cerrar el formulario sin reintentar). */
  function reiniciar() {
    error.value = null
    codigo.value = null
    clave = null
  }

  onScopeDispose(() => clearInterval(reloj))

  return { ejecutar, cargando, error, codigo, segundosEspera, reiniciar }
}
