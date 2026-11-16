/** Reglas de interfaz comunes a todos los módulos (funciones puras). */

/**
 * Botones que ofrece un recurso según su estado (guía §6). Cada módulo declara su mapa
 * estado → acciones; lo que no está en el mapa no ofrece nada.
 *
 * ```ts
 * const BOTONES = { borrador: ['emitir', 'eliminar'], emitida: ['anular'] } as const
 * accionesPermitidas(factura.estado, BOTONES)
 * ```
 */
export function accionesPermitidas<E extends string, B extends string>(
  estado: E,
  mapa: Partial<Record<E, readonly B[]>>,
): readonly B[] {
  return mapa[estado] ?? []
}

/**
 * Cuatro ojos: quien creó, cargó o ejecutó un registro no lo aprueba, autoriza ni verifica.
 * `autores` son las cuentas que intervinieron (los nulos se ignoran).
 */
export function puedeAprobar(autores: (string | null | undefined)[], cuentaId: string | null | undefined): boolean {
  return !!cuentaId && !autores.includes(cuentaId)
}
