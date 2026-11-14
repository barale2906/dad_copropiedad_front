import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, exigir } from '@/api/cliente'
import { guardarTokens, haySesion, limpiar, renovar } from '@/api/tokens'
import type { EntidadDeLaCuenta } from '@/api/tipos'

export type EstadoSesion = 'desconocido' | 'anonimo' | 'autenticado'

export const useSesion = defineStore('sesion', () => {
  const estado = ref<EstadoSesion>('desconocido')
  const entidades = ref<EntidadDeLaCuenta[]>([])
  const desafio = ref<{ id: string; expira: number } | null>(null)

  function entrar(lista: EntidadDeLaCuenta[] | null | undefined): void {
    entidades.value = [...(lista ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    desafio.value = null
    estado.value = 'autenticado'
  }

  /** Al arrancar: si hay token de renovación guardado, recupera la sesión. */
  async function restaurar(): Promise<void> {
    if (!haySesion()) {
      estado.value = 'anonimo'
      return
    }
    try {
      if (await renovar()) {
        entrar(await exigir(api().GET('/api/v1/yo/entidades')))
        return
      }
    } catch {
      // Red caída o error del servidor: se pide iniciar sesión otra vez.
    }
    estado.value = 'anonimo'
  }

  /** Devuelve `'segundo_factor'` si hay que pedir el código TOTP. */
  async function iniciar(
    identificador: string,
    contrasena: string,
    equipoCompartido = false,
  ): Promise<'sesion' | 'segundo_factor'> {
    const r = await exigir(
      api().POST('/api/v1/auth/sesion', {
        body: { identificador, contrasena, equipo_compartido: equipoCompartido },
      }),
    )
    if (r.resultado === 'segundo_factor' && r.desafio) {
      desafio.value = {
        id: r.desafio,
        expira: r.desafio_expira_en ? Date.parse(r.desafio_expira_en) : Date.now() + 300_000,
      }
      return 'segundo_factor'
    }
    if (!r.tokens) throw new Error('Respuesta de sesión sin tokens')
    guardarTokens(r.tokens)
    entrar(r.entidades)
    return 'sesion'
  }

  async function completarSegundoFactor(codigo: string): Promise<void> {
    if (!desafio.value) throw new Error('No hay desafío pendiente')
    const r = await exigir(
      api().POST('/api/v1/auth/sesion/segundo-factor', {
        body: { desafio: desafio.value.id, codigo },
      }),
    )
    guardarTokens(r.tokens)
    entrar(r.entidades)
  }

  async function recuperarContrasena(correo: string): Promise<void> {
    await exigir(api().POST('/api/v1/auth/contrasena/recuperar', { body: { correo } }))
  }

  async function cerrar(): Promise<void> {
    try {
      await api().DELETE('/api/v1/auth/sesion')
    } catch {
      // Se cierra localmente aunque falle la red.
    }
    limpiar()
    alTerminar()
  }

  /** Limpia el estado local (también cuando la sesión vence o se cierra en otra pestaña). */
  function alTerminar(): void {
    estado.value = 'anonimo'
    entidades.value = []
    desafio.value = null
  }

  return {
    estado,
    entidades,
    desafio,
    restaurar,
    iniciar,
    completarSegundoFactor,
    recuperarContrasena,
    cerrar,
    alTerminar,
  }
})
