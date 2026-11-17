import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, exigir } from '@/api/cliente'
import { useEntidad } from './entidad'

/**
 * Comunicados sin leer de la cuenta en la PH activa, para el aviso de la barra superior. Es una
 * consulta liviana (primera página); solo aplica con `gestion_administrativa` y vínculo con un bien.
 */
export const useComunicadosPendientes = defineStore('comunicados-pendientes', () => {
  const cantidad = ref(0)

  /** ¿Tiene sentido consultar? (módulo contratado y la cuenta es propietario o residente). */
  function aplica(): boolean {
    const e = useEntidad()
    return e.esPH && e.tieneModulo('gestion_administrativa') && (e.tieneRol('propietario') || e.tieneRol('residente'))
  }

  async function actualizar(): Promise<void> {
    const id = useEntidad().activa?.entidad_id
    if (!id || !aplica()) {
      cantidad.value = 0
      return
    }
    try {
      const pagina = await exigir(
        api().GET('/api/v1/copropiedades/{copropiedad_id}/mis-comunicados', { params: { path: { copropiedad_id: id }, query: { limite: 50 } } }),
      )
      cantidad.value = pagina.datos.filter((c) => !c.leido_en).length
    } catch {
      /* el aviso es secundario: si falla, se deja como estaba */
    }
  }

  return { cantidad, aplica, actualizar }
})
