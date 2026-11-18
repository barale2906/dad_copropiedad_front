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
  FilaBalance,
  LibroMayor,
  MarcoTecnico,
  Naturaleza,
  NivelCuenta,
  PeriodoContable,
} from '@/api/tipos'
import { comparar, leerDecimal, restar, sumar } from '@/formato/decimales'

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

// Configuración ------------------------------------------------------------------------------

export const MARCO_TECNICO: Record<MarcoTecnico, string> = {
  grupo_1: 'Grupo 1 (NIIF plenas)',
  grupo_2: 'Grupo 2 (NIIF para pymes)',
  grupo_3: 'Grupo 3 (microempresas)',
  otro: 'Otro marco',
}

export const ESTADO_RUBRO: Record<'situacion_financiera' | 'resultados', string> = { situacion_financiera: 'Estado de situación financiera', resultados: 'Estado de resultados' }

/** «11, 12» → `['11', '12']` (solo dígitos, sin repetir). */
export function leerPrefijos(texto: string): string[] {
  return [...new Set(texto.split(/[\s,;]+/).map((p) => p.trim()).filter((p) => /^\d+$/.test(p)))]
}

// Reportes -----------------------------------------------------------------------------------

const NIVELES: NivelCuenta[] = ['clase', 'grupo', 'cuenta', 'subcuenta', 'auxiliar']

export interface FilaArbol {
  clave: string
  codigo: string
  nombre: string
  /** 0 = clase … 4 = auxiliar; las filas por tercero o centro van un nivel debajo de su cuenta. */
  nivel: number
  /** Código del padre en el árbol (`null` en las clases). */
  padre: string | null
  tieneHijas: boolean
  /** Fila con movimiento (no agregada). */
  hoja: boolean
  saldo_inicial: string
  debitos: string
  creditos: string
  saldo_final: string
}

/**
 * Árbol del balance de prueba: las filas del backend (cuentas con movimiento, o por tercero o
 * centro de costo) suman en sus ancestros del PUC hasta la clase. Ordenado por código.
 */
export function arbolBalance(
  filas: FilaBalance[],
  nombres: Map<string, string>,
  etiqueta: (f: FilaBalance) => string | null = () => null,
): FilaArbol[] {
  const nodos = new Map<string, FilaArbol>()
  const vacio = (codigo: string, padre: string | null): FilaArbol => ({
    clave: codigo, codigo, nombre: nombres.get(codigo) ?? codigo, nivel: NIVELES.indexOf(nivelDeCodigo(codigo)), padre,
    tieneHijas: false, hoja: false, saldo_inicial: '0', debitos: '0', creditos: '0', saldo_final: '0',
  })
  const sumarEn = (n: FilaArbol, f: FilaBalance) => {
    n.saldo_inicial = sumar(n.saldo_inicial, f.saldo_inicial)
    n.debitos = sumar(n.debitos, f.debitos)
    n.creditos = sumar(n.creditos, f.creditos)
    n.saldo_final = sumar(n.saldo_final, f.saldo_final)
  }
  for (const f of filas) {
    const detalle = etiqueta(f)
    const cuenta = nodos.get(f.codigo) ?? { ...vacio(f.codigo, padreDeCodigo(f.codigo)), nombre: f.nombre }
    nodos.set(f.codigo, cuenta)
    if (detalle) {
      const clave = `${f.codigo}|${f.persona_id ?? ''}|${f.centro_costo_id ?? ''}`
      const hija = { ...vacio(f.codigo, f.codigo), clave, nombre: detalle, nivel: cuenta.nivel + 1, hoja: true }
      sumarEn(hija, f)
      nodos.set(clave, hija)
      cuenta.tieneHijas = true
    } else cuenta.hoja = true
    sumarEn(cuenta, f)
    for (let p = padreDeCodigo(f.codigo); p; p = padreDeCodigo(p)) {
      const ancestro = nodos.get(p) ?? vacio(p, padreDeCodigo(p))
      nodos.set(p, ancestro)
      ancestro.tieneHijas = true
      sumarEn(ancestro, f)
    }
  }
  return [...nodos.values()].sort((a, b) => (a.codigo === b.codigo ? (a.hoja === b.hoja ? a.clave.localeCompare(b.clave) : a.hoja ? 1 : -1) : a.codigo.localeCompare(b.codigo)))
}

/** Filas visibles: hasta `nivelMaximo` y sin los descendientes de las plegadas. */
export function filasVisibles(arbol: FilaArbol[], nivelMaximo: number, plegadas: Set<string>): FilaArbol[] {
  const porClave = new Map(arbol.map((f) => [f.clave, f]))
  const oculta = (f: FilaArbol): boolean => {
    for (let p = f.padre; p; p = porClave.get(p)?.padre ?? null) if (plegadas.has(p)) return true
    return false
  }
  return arbol.filter((f) => f.nivel <= nivelMaximo && !oculta(f))
}

/** Totales del balance (solo las filas del backend): los débitos y créditos deben ser iguales. */
export function totalesBalance(filas: FilaBalance[]) {
  const debitos = sumar('0', ...filas.map((f) => f.debitos))
  const creditos = sumar('0', ...filas.map((f) => f.creditos))
  return { debitos, creditos, cuadra: comparar(debitos, creditos) === 0 }
}

/** Saldo en el sentido de la naturaleza de la cuenta (el backend envía débitos − créditos). */
export const saldoNatural = (debitosMenosCreditos: string, n: Naturaleza) => (n === 'debito' ? debitosMenosCreditos : restar('0', debitosMenosCreditos))

/** Movimientos del mayor con el saldo acumulado en el sentido de la cuenta. */
export function saldoCorrido(m: LibroMayor) {
  let saldo = m.saldo_inicial
  return m.movimientos.map((x) => {
    saldo = sumar(saldo, x.debito, restar('0', x.credito))
    return { ...x, saldo: saldoNatural(saldo, m.cuenta.naturaleza) }
  })
}

// Saldos iniciales desde CSV ----------------------------------------------------------------

/**
 * Lee un CSV de saldos iniciales: `cuenta, débito, crédito[, centro]` (coma o punto y coma,
 * con o sin encabezado; montos como «1.234,56» o «1234.56»). Devuelve las líneas y los errores
 * por fila (numeradas como en el archivo).
 */
export function leerCsvSaldos(texto: string): { lineas: LineaEditable[]; errores: string[] } {
  const lineas: LineaEditable[] = []
  const errores: string[] = []
  texto.split(/\r?\n/).forEach((fila, i) => {
    if (!fila.trim()) return
    const separador = fila.includes(';') ? ';' : ','
    const [cuenta = '', debito = '', credito = '', centro = ''] = fila.split(separador).map((c) => c.trim().replace(/^"|"$/g, ''))
    if (i === 0 && !/^\d+$/.test(cuenta)) return
    const n = `Fila ${i + 1}`
    if (!/^\d+$/.test(cuenta)) {
      errores.push(`${n}: la cuenta «${cuenta}» no es un código PUC.`)
      return
    }
    const d = debito ? leerDecimal(debito) : '0'
    const c = credito ? leerDecimal(credito) : '0'
    if (d === null || c === null) {
      errores.push(`${n}: un monto no es válido.`)
      return
    }
    lineas.push({ ...lineaVacia(), cuenta, debito: comparar(d, '0') === 0 ? '' : d, credito: comparar(c, '0') === 0 ? '' : c, centro })
  })
  return { lineas, errores }
}
