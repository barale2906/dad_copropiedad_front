/** Alias legibles de los esquemas del contrato (`esquema.d.ts` se genera con `make tipos-api`). */
import type { components } from './esquema'

type S = components['schemas']

export type EntidadDeLaCuenta = S['EntidadDeLaCuenta']
export type TipoEntidad = S['TipoEntidad']
export type Modulo = S['Modulo']
export type Permiso = S['Permiso']
export type Capacidades = S['CapacidadesRespuesta']
export type Tokens = S['TokensRespuesta']
export type InicioRespuesta = S['InicioRespuesta']
export type SesionRespuesta = S['SesionRespuesta']
export type CodigoError = S['CodigoError']
export type ErrorRespuesta = S['ErrorRespuesta']
