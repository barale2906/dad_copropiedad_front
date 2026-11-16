import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, exigir } from '@/api/cliente'
import type { DispositivoPush, InscripcionSegundoFactor, Perfil, Permiso } from '@/api/tipos'
import { useSesion } from './sesion'

/**
 * La cuenta de la persona, fuera de cualquier entidad (`GET /yo`): perfil, correo, segundo
 * factor, sesiones y dispositivos. Decide también si ve la consola de la plataforma.
 */
export const useCuenta = defineStore('cuenta', () => {
  const perfil = ref<Perfil | null>(null)
  const dispositivos = ref<DispositivoPush[]>([])

  const permisosPlataforma = computed(() => new Set<Permiso>(perfil.value?.permisos_plataforma ?? []))
  const segundoFactorActivo = computed(() => perfil.value?.segundo_factor_activo ?? false)

  /** Id de la cuenta (para las reglas de cuatro ojos). */
  const id = computed(() => perfil.value?.id ?? null)

  async function cargar(): Promise<Perfil> {
    perfil.value = await exigir(api().GET('/api/v1/yo'))
    return perfil.value
  }

  /** Carga el perfil una sola vez (lo usan las guardas y la barra). */
  async function asegurar(): Promise<Perfil> {
    return perfil.value ?? cargar()
  }

  async function cambiarContrasena(actual: string, nueva: string): Promise<void> {
    await exigir(
      api().PUT('/api/v1/yo/contrasena', { body: { contrasena_actual: actual, contrasena_nueva: nueva } }),
    )
  }

  async function reenviarVerificacion(): Promise<void> {
    await exigir(api().POST('/api/v1/yo/correo/reenviar'))
  }

  async function verificarCorreo(codigo: string): Promise<void> {
    await exigir(api().POST('/api/v1/yo/correo/verificar', { body: { codigo } }))
    await cargar()
  }

  /** Paso 1 del segundo factor: secreto y URI `otpauth://` para el QR. */
  async function inscribirSegundoFactor(): Promise<InscripcionSegundoFactor> {
    return exigir(api().POST('/api/v1/yo/segundo-factor'))
  }

  /** Paso 2: confirma con el primer código de la aplicación autenticadora. */
  async function confirmarSegundoFactor(codigo: string): Promise<void> {
    await exigir(api().POST('/api/v1/yo/segundo-factor/confirmar', { body: { codigo } }))
    await cargar()
  }

  /**
   * Cierra todas las sesiones de la cuenta (también esta). Devuelve cuántas cerró; después
   * hay que volver a iniciar sesión.
   */
  async function cerrarTodasLasSesiones(): Promise<number> {
    const r = await exigir(api().DELETE('/api/v1/yo/sesiones'))
    await useSesion().cerrar()
    return r.cerradas
  }

  async function cargarDispositivos(): Promise<void> {
    dispositivos.value = await exigir(api().GET('/api/v1/yo/dispositivos-push'))
  }

  async function quitarDispositivo(dispositivoId: string): Promise<void> {
    await exigir(
      api().DELETE('/api/v1/yo/dispositivos-push/{dispositivo_id}', {
        params: { path: { dispositivo_id: dispositivoId } },
      }),
    )
    dispositivos.value = dispositivos.value.filter((d) => d.id !== dispositivoId)
  }

  /** Al cerrar la sesión: no queda nada de la cuenta anterior. */
  function limpiar(): void {
    perfil.value = null
    dispositivos.value = []
  }

  return {
    perfil,
    dispositivos,
    id,
    permisosPlataforma,
    segundoFactorActivo,
    cargar,
    asegurar,
    cambiarContrasena,
    reenviarVerificacion,
    verificarCorreo,
    inscribirSegundoFactor,
    confirmarSegundoFactor,
    cerrarTodasLasSesiones,
    cargarDispositivos,
    quitarDispositivo,
    limpiar,
  }
})
