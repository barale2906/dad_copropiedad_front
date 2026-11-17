/**
 * Estado de la portería: los códigos de los bienes para mostrar las visitas y los paquetes. Se
 * cargan una vez por entidad con `…/acceso/bienes` (páginas de 200), que no exige
 * `bienes_privados.ver`, y quedan en `useBienes` para que `codigo(id)` los muestre.
 */
import { defineStore } from 'pinia'
import { useBienes } from '@/stores/bienes'
import { bienesPorteria } from './api'

export const usePorteria = defineStore('porteria', () => {
  let cargada: string | null = null
  let enCurso: Promise<void> | null = null

  async function cargar(id: string): Promise<void> {
    const bienes = useBienes()
    let despues: string | undefined
    do {
      const pagina = await bienesPorteria(id, undefined, despues, 200)
      bienes.recordar(pagina.datos)
      despues = pagina.siguiente ?? undefined
    } while (despues)
    cargada = id
  }

  /** Asegura los códigos de los bienes de la entidad; si falla, se reintenta la próxima vez. */
  async function asegurarCodigos(id: string): Promise<void> {
    // Al cambiar de entidad `useBienes` olvida los códigos: se vuelven a cargar.
    if (cargada === id && Object.keys(useBienes().codigos).length) return
    enCurso ??= cargar(id).finally(() => {
      enCurso = null
    })
    await enCurso
  }

  return { asegurarCodigos }
})
