import { reactive } from 'vue'
import { mensajeDeError } from '@/api/errores'
import type { Rol, Usuario } from '@/api/tipos'
import { asignacionesDe, type DestinoUsuarios, quitarAsignacion, reenviarCodigo } from '@/api/usuarios'
import { asignacionesVigentes, type EstadoDetalleUsuario } from '@/formato/usuarios'
import { useAccion } from './useAccion'

/**
 * Lógica del detalle de un usuario (sus roles vigentes, quitar uno, reenviar el código) para
 * `<DetalleUsuario>`, por la ruta de la entidad o la de la plataforma (`destino`).
 *
 * ```ts
 * const detalle = useDetalleUsuario(() => entidadId.value, () => roles.value, () => usuarios.recargar())
 * detalle.abrir(usuario)  // y <DetalleUsuario :detalle="detalle" …>
 * ```
 */
export function useDetalleUsuario(destino: () => DestinoUsuarios, roles: () => Rol[], alCambio: () => void) {
  let usuario: Usuario | null = null

  const quitar = useAccion((_clave, id: string) => quitarAsignacion(destino(), id))
  const reenviar = useAccion(() => reenviarCodigo(destino(), usuario?.cuenta_id ?? ''))

  const estado = reactive({
    estado: 'cargando' as EstadoDetalleUsuario['estado'],
    error: null as string | null,
    asignaciones: [] as EstadoDetalleUsuario['asignaciones'],
    codigoEnviado: false,
    quitando: quitar.cargando,
    errorQuitar: quitar.error,
    reenviando: reenviar.cargando,
    errorReenviar: reenviar.error,
    cargar,
    async quitar(id: string) {
      const r = await quitar.ejecutar(id)
      if (!r.ok) return false
      alCambio()
      await cargar()
      return true
    },
    async reenviar() {
      if ((await reenviar.ejecutar()).ok) estado.codigoEnviado = true
    },
  })

  async function cargar() {
    if (!usuario) return
    estado.estado = 'cargando'
    try {
      estado.asignaciones = asignacionesVigentes(await asignacionesDe(destino(), usuario.cuenta_id), roles())
      estado.estado = 'listo'
    } catch (e) {
      estado.error = mensajeDeError(e)
      estado.estado = 'error'
    }
  }

  /** Prepara el detalle de otro usuario (al abrir el diálogo). */
  function abrir(u: Usuario) {
    usuario = u
    estado.codigoEnviado = false
    quitar.reiniciar()
    reenviar.reiniciar()
    void cargar()
  }

  const detalle: EstadoDetalleUsuario & { abrir: (u: Usuario) => void } = Object.assign(estado, { abrir })
  return detalle
}
