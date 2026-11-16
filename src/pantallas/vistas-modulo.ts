/**
 * Contrato entre el marco de módulos (`ModuloView`) y las vistas reales de cada módulo. La app
 * provee el registro (`src/app/vistas-modulos.ts`); así `pantallas/` no importa `modulos/` y
 * cada vista llega en su propio chunk diferido.
 */
import type { Component, InjectionKey } from 'vue'

/** Clave `seccion/accion` (p. ej. `entidad/usuarios`) → carga diferida de la vista. */
export type VistasModulo = Readonly<Record<string, () => Promise<Component | { default: Component }>>>

export const CLAVE_VISTAS_MODULO: InjectionKey<VistasModulo> = Symbol('vistas-modulo')

export const claveVista = (seccion: string, accion: string) => `${seccion}/${accion}`
