import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, exigir } from '@/api/cliente'
import { guardarTokens, haySesion, limpiar, renovar, tokenAcceso } from '@/api/tokens'
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

  /**
   * Define la contraseña con el código que llegó al correo: la usan «olvidé mi contraseña» y
   * los usuarios nuevos que creó un administrador (no hay registro abierto).
   */
  async function definirContrasena(correo: string, codigo: string, contrasenaNueva: string): Promise<void> {
    await exigir(
      api().POST('/api/v1/auth/contrasena/restablecer', {
        body: { correo, codigo, contrasena_nueva: contrasenaNueva },
      }),
    )
  }

  /**
   * Cierra la sesión **primero en este navegador** (aunque se recargue o se cierre la pestaña
   * enseguida, ya no queda abierta) y luego la revoca en el servidor sin esperar respuesta.
   */
  async function cerrar(): Promise<void> {
    if (!tokenAcceso() && haySesion()) await renovar().catch(() => false)
    const token = tokenAcceso()
    limpiar()
    alTerminar()
    if (token) {
      api()
        .DELETE('/api/v1/auth/sesion', { headers: { Authorization: `Bearer ${token}` } })
        .catch(() => {
          // Sin red: el token vence solo; localmente ya se cerró.
        })
    }
  }

  /**
   * Agrega a la sesión una entidad que la cuenta abre como **soporte** de la plataforma (no está
   * en sus entidades): así se puede entrar a ella con las rutas normales durante el acceso.
   */
  function agregarSoporte(e: EntidadDeLaCuenta): void {
    if (entidades.value.some((x) => x.entidad_id === e.entidad_id)) return
    entidades.value = [...entidades.value, { ...e, roles: ['soporte'] }]
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
    definirContrasena,
    cerrar,
    alTerminar,
    agregarSoporte,
  }
})
