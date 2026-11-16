import { onScopeDispose } from 'vue'

export interface OpcionesRefresco {
  /** Intervalo en ms mientras la pestaña está visible. */
  cada?: number
  /** Refrescar al volver a la pestaña. */
  alVolver?: boolean
}

/**
 * Refresca datos cada `cada` ms **solo con la pestaña visible**, y al volver a ella (portería,
 * documentos en contingencia, tableros). No refresca si la anterior aún no termina.
 * Se detiene solo al destruirse el componente.
 */
export function useRefresco(fn: () => Promise<unknown> | unknown, opciones: OpcionesRefresco = {}) {
  const { cada = 15_000, alVolver = true } = opciones
  let temporizador: ReturnType<typeof setInterval> | undefined
  let enCurso = false

  async function refrescar() {
    if (enCurso) return
    enCurso = true
    try {
      await fn()
    } catch {
      // El componente muestra su propio error; el siguiente ciclo vuelve a intentar.
    } finally {
      enCurso = false
    }
  }

  function arrancar() {
    detener()
    temporizador = setInterval(() => void refrescar(), cada)
  }

  function detener() {
    clearInterval(temporizador)
    temporizador = undefined
  }

  function alCambiarVisibilidad() {
    if (document.visibilityState === 'visible') {
      if (alVolver) void refrescar()
      arrancar()
    } else {
      detener()
    }
  }

  document.addEventListener('visibilitychange', alCambiarVisibilidad)
  if (document.visibilityState === 'visible') arrancar()

  onScopeDispose(() => {
    detener()
    document.removeEventListener('visibilitychange', alCambiarVisibilidad)
  })

  return { refrescar }
}
