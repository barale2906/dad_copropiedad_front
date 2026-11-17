/** Reglas y textos de la ficha de la entidad (funciones puras). */
import type {
  AdvertenciaFicha,
  CambiosCopropiedad,
  DatosCopropiedad,
  FichaEntidad,
  FormaCopropiedad,
  TipoCopropiedad,
  TipoPuntoAtencion,
} from '@/api/tipos'

export const ADVERTENCIA: Record<AdvertenciaFicha, string> = {
  falta_revisor_fiscal: 'No hay revisor fiscal vigente (Ley 675, art. 56).',
  falta_consejo_administracion: 'No hay consejo de administración vigente (Ley 675, art. 53).',
  sin_cuadro_vigente: 'No hay un cuadro de coeficientes vigente.',
}

export const TIPO_COPROPIEDAD: Record<TipoCopropiedad, string> = {
  residencial: 'Residencial',
  comercial: 'Comercial',
  mixta: 'Mixta',
}

export const FORMA_COPROPIEDAD: Record<FormaCopropiedad, string> = {
  edificio: 'Edificio',
  conjunto: 'Conjunto',
  condominio: 'Condominio',
  centro_comercial: 'Centro comercial',
  parcelacion: 'Parcelación',
  otro: 'Otro',
}

export const TIPO_PUNTO: Record<TipoPuntoAtencion, string> = {
  oficina_administracion: 'Oficina de administración',
  porteria: 'Portería',
  recepcion: 'Recepción',
  otro: 'Otro',
}

/** Campos editables de la ficha. Los de la PH solo existen en la copropiedad. */
export type CampoFicha =
  | 'nombre'
  | 'razon_social'
  | 'nit'
  | 'direccion'
  | 'municipio_dane'
  | 'departamento'
  | 'barrio'
  | 'telefono'
  | 'correo'
  | 'sitio_web'
  | 'zona_horaria'
  | CampoPH

type CampoPH =
  | 'tipo'
  | 'forma'
  | 'estrato'
  | 'escritura_numero'
  | 'notaria'
  | 'escritura_fecha'
  | 'matricula_matriz'
  | 'plantilla_codigo'

export const CAMPOS_PH: readonly CampoPH[] = [
  'tipo',
  'forma',
  'estrato',
  'escritura_numero',
  'notaria',
  'escritura_fecha',
  'matricula_matriz',
  'plantilla_codigo',
]

/** Valores del formulario: todo como texto (vacío = sin dato). */
export type ValoresFicha = Record<CampoFicha, string>

type Origen = Partial<Record<CampoFicha, string | number | null | undefined>>

/** Datos de la ficha → valores del formulario. */
export function aValores(datos: FichaEntidad | DatosCopropiedad): ValoresFicha {
  const d = datos as Origen
  const v = (c: CampoFicha) => (d[c] === null || d[c] === undefined ? '' : String(d[c]))
  const campos: CampoFicha[] = [
    'nombre', 'razon_social', 'nit', 'direccion', 'municipio_dane', 'departamento', 'barrio',
    'telefono', 'correo', 'sitio_web', 'zona_horaria', ...CAMPOS_PH,
  ]
  return Object.fromEntries(campos.map((c) => [c, v(c)])) as ValoresFicha
}

/**
 * Solo lo que cambió, listo para el `PATCH` (vacío = `null`; el estrato, número). En una
 * empresa no se envían los campos propios de la PH.
 */
export function cambiosDeFicha(original: ValoresFicha, editado: ValoresFicha, esPH: boolean): CambiosCopropiedad {
  const cambios: Record<string, string | number | null> = {}
  for (const c of Object.keys(editado) as CampoFicha[]) {
    if (!esPH && (CAMPOS_PH as readonly string[]).includes(c)) continue
    const nuevo = editado[c].trim()
    if (nuevo === original[c].trim()) continue
    cambios[c] = nuevo === '' ? null : c === 'estrato' ? Number.parseInt(nuevo, 10) : nuevo
  }
  // Las claves y valores salen de `ValoresFicha`, que espeja el contrato.
  return cambios as CambiosCopropiedad
}

/** Errores de validación del formulario que el cliente puede detectar antes de enviar. */
export function validarFicha(v: ValoresFicha, esPH: boolean): Partial<Record<CampoFicha, string>> {
  const errores: Partial<Record<CampoFicha, string>> = {}
  if (!v.nombre.trim()) errores.nombre = 'Escriba el nombre.'
  if (!zonaValida(v.zona_horaria)) errores.zona_horaria = 'Use una zona válida, por ejemplo America/Bogota.'
  if (v.correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.correo.trim())) errores.correo = 'El correo no es válido.'
  if (esPH) {
    if (v.estrato.trim() && !/^[1-6]$/.test(v.estrato.trim())) errores.estrato = 'El estrato va de 1 a 6.'
    if (v.plantilla_codigo.trim() && !v.plantilla_codigo.includes('{numero}')) {
      errores.plantilla_codigo = 'Debe contener {numero}.'
    }
  }
  return errores
}

/** ¿Es una zona IANA que el navegador reconoce? */
export function zonaValida(zona: string): boolean {
  if (!zona.trim()) return false
  try {
    new Intl.DateTimeFormat('es-CO', { timeZone: zona.trim() })
    return true
  } catch {
    return false
  }
}
