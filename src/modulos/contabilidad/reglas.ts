/**
 * Reglas y textos de la contabilidad (funciones puras). El backend decide (partida doble,
 * cuentas que admiten movimiento, periodo abierto); aquí se avisa antes y se arma la petición.
 */
import type {
  BorradorComprobante,
  CentroCosto,
  Comprobante,
  CuentaContable,
  EstadoComprobante,
  EstadoPeriodo,
  EstadoReapertura,
  NivelCuenta,
  PeriodoContable,
} from '@/api/tipos'
import { comparar, restar, sumar } from '@/formato/decimales'

type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro'

export const ESTADO_COMPROBANTE: Record<EstadoComprobante, { texto: string; tono: Tono }> = {
  borrador: { texto: 'Borrador', tono: 'aviso' },
  contabilizado: { texto: 'Contabilizado', tono: 'exito' },
}

export const ESTADO_PERIODO: Record<EstadoPeriodo, { texto: string; tono: Tono }> = {
  abierto: { texto: 'Abierto', tono: 'exito' },
  en_revision: { texto: 'En revisión', tono: 'aviso' },
  cerrado: { texto: 'Cerrado', tono: 'neutro' },
}

export const ESTADO_REAPERTURA: Record<EstadoReapertura, { texto: string; tono: Tono }> = {
  pendiente: { texto: 'Por aprobar', tono: 'aviso' },
  aprobada: { texto: 'Aprobada', tono: 'exito' },
  rechazada: { texto: 'Rechazada', tono: 'peligro' },
}

export const NIVEL_CUENTA: Record<NivelCuenta, string> = {
  clase: 'Clase',
  grupo: 'Grupo',
  cuenta: 'Cuenta',
  subcuenta: 'Subcuenta',
  auxiliar: 'Auxiliar',
}

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const

/** «marzo de 2026»; el mes 13 es el periodo de cierre anual. */
export function nombrePeriodo(p: Pick<PeriodoContable, 'anio' | 'mes'>): string {
  return p.mes === 13 ? `Cierre de ${p.anio}` : `${MESES[p.mes - 1] ?? `mes ${p.mes}`} de ${p.anio}`
}

/** Nivel según el largo del código PUC (1, 2, 4, 6 u 8+ dígitos). */
export function nivelDeCodigo(codigo: string): NivelCuenta {
  const n = codigo.length
  return n <= 1 ? 'clase' : n === 2 ? 'grupo' : n <= 4 ? 'cuenta' : n <= 6 ? 'subcuenta' : 'auxiliar'
}

/** Código del padre en el PUC: `110505` → `1105`, `1105` → `11`, `11` → `1`. */
export function padreDeCodigo(codigo: string): string | null {
  const n = codigo.length
  if (n <= 1) return null
  return codigo.slice(0, n === 2 ? 1 : n <= 4 ? 2 : n <= 6 ? 4 : 6)
}

// Comprobante editable ----------------------------------------------------------------------

export interface LineaEditable {
  /** Clave local estable para la lista (no se envía). */
  clave: string
  cuenta: string
  tercero: { id: string; nombre: string } | null
  centro: string
  debito: string
  credito: string
  descripcion: string
}

export interface ComprobanteEditable {
  tipo: string
  fecha: string
  descripcion: string
  lineas: LineaEditable[]
}

let consecutivo = 0
export const lineaVacia = (): LineaEditable => ({ clave: `l${++consecutivo}`, cuenta: '', tercero: null, centro: '', debito: '', credito: '', descripcion: '' })

export const comprobanteVacio = (fecha: string, tipo = ''): ComprobanteEditable => ({ tipo, fecha, descripcion: '', lineas: [lineaVacia(), lineaVacia()] })

const valor = (t: string) => (t.trim() ? t.trim() : '0')
const enBlanco = (l: LineaEditable) => !l.cuenta && !l.debito && !l.credito && !l.descripcion && !l.tercero && !l.centro

export interface Totales {
  debito: string
  credito: string
  /** Débitos menos créditos. */
  diferencia: string
  cuadra: boolean
}

/** Totales con decimales exactos (los montos ya vienen como texto decimal de `HudCampoMonto`). */
export function totales(lineas: Pick<LineaEditable, 'debito' | 'credito'>[]): Totales {
  const debito = sumar('0', ...lineas.map((l) => valor(l.debito)))
  const credito = sumar('0', ...lineas.map((l) => valor(l.credito)))
  const diferencia = restar(debito, credito)
  return { debito, credito, diferencia, cuadra: comparar(diferencia, '0') === 0 && comparar(debito, '0') > 0 }
}

/**
 * Monto que cuadra el comprobante si se pone en la línea `i` del lado indicado (atajo `=`):
 * la diferencia de las demás líneas, o `''` si ese lado no la cuadra.
 */
export function montoQueCuadra(lineas: LineaEditable[], i: number, lado: 'debito' | 'credito'): string {
  const otras = lineas.filter((_, k) => k !== i)
  const d = totales(otras).diferencia
  const signo = comparar(d, '0')
  if (lado === 'debito' && signo < 0) return restar('0', d)
  if (lado === 'credito' && signo > 0) return d
  return ''
}

/** Copia de la línea `i` debajo de ella (atajo Ctrl+D). */
export function duplicarLinea(lineas: LineaEditable[], i: number): LineaEditable[] {
  const l = lineas[i]
  if (!l) return lineas
  return [...lineas.slice(0, i + 1), { ...l, clave: lineaVacia().clave }, ...lineas.slice(i + 1)]
}

/**
 * Avisos antes de enviar (el backend vuelve a validar con `regla_contable`): partida doble,
 * débito y crédito en la misma línea, cuentas que no admiten movimiento y tercero o centro
 * exigidos por la cuenta.
 */
export function avisosComprobante(c: ComprobanteEditable, cuentas: Map<string, CuentaContable>): string[] {
  const avisos: string[] = []
  if (!c.tipo) avisos.push('Elija el tipo de comprobante.')
  if (!c.fecha) avisos.push('Indique la fecha.')
  if (!c.descripcion.trim()) avisos.push('Escriba la descripción del comprobante.')
  const lineas = c.lineas.filter((l) => !enBlanco(l))
  if (lineas.length < 2) avisos.push('Un comprobante lleva al menos dos líneas.')
  c.lineas.forEach((l, i) => {
    if (enBlanco(l)) return
    const n = `Línea ${i + 1}`
    const cuenta = cuentas.get(l.cuenta)
    const d = comparar(valor(l.debito), '0')
    const cr = comparar(valor(l.credito), '0')
    if (!l.cuenta) avisos.push(`${n}: elija la cuenta.`)
    else if (!cuenta) avisos.push(`${n}: la cuenta ${l.cuenta} no existe en el plan de cuentas.`)
    else if (!cuenta.acepta_movimiento || !cuenta.activa) avisos.push(`${n}: la cuenta ${l.cuenta} no admite movimientos.`)
    else {
      if (cuenta.exige_tercero && !l.tercero) avisos.push(`${n}: la cuenta ${l.cuenta} exige un tercero.`)
      if (cuenta.exige_centro_costo && !l.centro) avisos.push(`${n}: la cuenta ${l.cuenta} exige un centro de costo.`)
    }
    if (d > 0 && cr > 0) avisos.push(`${n}: lleve el valor al débito o al crédito, no a ambos.`)
    if (d <= 0 && cr <= 0) avisos.push(`${n}: falta el valor.`)
  })
  const t = totales(lineas)
  if (lineas.length >= 2 && !t.cuadra) avisos.push('Los débitos y los créditos no suman lo mismo.')
  return avisos
}

/** La petición para el backend (por códigos; sin las líneas en blanco). */
export function peticionComprobante(c: ComprobanteEditable): BorradorComprobante {
  return {
    tipo: c.tipo,
    fecha: c.fecha,
    descripcion: c.descripcion.trim(),
    lineas: c.lineas
      .filter((l) => !enBlanco(l))
      .map((l) => ({
        cuenta: l.cuenta,
        persona_id: l.tercero?.id ?? null,
        centro_costo: l.centro || null,
        debito: valor(l.debito),
        credito: valor(l.credito),
        descripcion: l.descripcion.trim() || null,
      })),
  }
}

/** Lleva un comprobante del backend (líneas por id) al editor (por códigos). */
export function editableDe(
  c: Comprobante,
  cuentas: Map<string, CuentaContable>,
  centros: Map<string, CentroCosto>,
  terceros: Map<string, string> = new Map(),
): ComprobanteEditable {
  const monto = (t: string) => (comparar(t, '0') === 0 ? '' : t)
  return {
    tipo: c.tipo,
    fecha: c.fecha,
    descripcion: c.descripcion,
    lineas: c.lineas.map((l) => ({
      ...lineaVacia(),
      cuenta: cuentas.get(l.cuenta_id)?.codigo ?? '',
      tercero: l.persona_id ? { id: l.persona_id, nombre: terceros.get(l.persona_id) ?? '' } : null,
      centro: l.centro_costo_id ? (centros.get(l.centro_costo_id)?.codigo ?? '') : '',
      debito: monto(l.debito),
      credito: monto(l.credito),
      descripcion: l.descripcion ?? '',
    })),
  }
}

// Acciones por estado ------------------------------------------------------------------------

export type AccionComprobante = 'editar' | 'eliminar' | 'contabilizar' | 'revertir'

export interface PermisosComprobante {
  crear: boolean
  contabilizar: boolean
  revertir: boolean
}

/** Borrador: editar, eliminar y contabilizar. Contabilizado: solo revertir (si no es un reverso ni ya se revirtió). */
export function accionesComprobante(
  c: Pick<Comprobante, 'estado' | 'revierte_a' | 'revertido_por'>,
  q: PermisosComprobante,
): AccionComprobante[] {
  if (c.estado === 'borrador') {
    return [...(q.crear ? (['editar', 'eliminar'] as const) : []), ...(q.contabilizar ? (['contabilizar'] as const) : [])]
  }
  return q.revertir && !c.revierte_a && !c.revertido_por ? ['revertir'] : []
}

export type AccionPeriodo = 'revision' | 'cerrar' | 'devolver' | 'reabrir'

/**
 * Abierto → en revisión o cerrado; en revisión → cerrado o de vuelta a abierto. Un cerrado
 * solo se reabre con una solicitud que aprueba **otra** cuenta.
 */
export function accionesPeriodo(estado: EstadoPeriodo, q: { cerrar: boolean; reabrir: boolean }): AccionPeriodo[] {
  if (estado === 'abierto') return q.cerrar ? ['revision', 'cerrar'] : []
  if (estado === 'en_revision') return q.cerrar ? ['cerrar', 'devolver'] : []
  return q.reabrir ? ['reabrir'] : []
}

export const ESTADO_DESTINO: Record<Exclude<AccionPeriodo, 'reabrir'>, EstadoPeriodo> = {
  revision: 'en_revision',
  cerrar: 'cerrado',
  devolver: 'abierto',
}

export const TEXTO_ACCION_PERIODO: Record<AccionPeriodo, string> = {
  revision: 'Pasar a revisión',
  cerrar: 'Cerrar el periodo',
  devolver: 'Devolver a abierto',
  reabrir: 'Solicitar reapertura',
}
