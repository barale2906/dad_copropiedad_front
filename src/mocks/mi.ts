/**
 * Demo del portal del propietario y residente: mi cartera (un bien en mora y otro al día), mis
 * comunicados, mis datos y la autorización de publicidad (las visitas y los paquetes
 * los atiende `porteria.ts`; las PQRS, `gestion.ts`). Se reinicia en cada sesión.
 */
import type {
  ComunicadoRecibido,
  CuentaCobro,
  Obligacion,
} from '@/api/tipos'
import { cuerpo, error, json, type Manejador, sinContenido } from './http'
import { bienesDemo, personasDemo } from './unidades'

const id = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, '0')}`
const DIA = 86_400_000
const hace = (dias: number) => new Date(Date.now() - dias * DIA).toISOString()
const fecha = (dias: number) => new Date(Date.now() + dias * DIA).toISOString().slice(0, 10)
const T1_101 = id(7001)
const T1_102 = id(7002)
/** Persona de la cuenta demo en la PH (titular de T1-101). */
const PERSONA = id(5100)

let obligaciones: Obligacion[] = []
let comunicados: ComunicadoRecibido[] = []
let publicidad = false
let consecutivo = 9500

function obligacion(n: number, concepto: string, dias: number, valor: string, saldo: string): Obligacion {
  return {
    id: id(n), bien_privado_id: T1_101, concepto_cobro_id: id(n + 50), concepto_codigo: concepto.slice(0, 3).toUpperCase(),
    concepto_nombre: concepto, concepto_tipo: 'ordinaria', periodo: fecha(dias - 15), valor, vencimiento: fecha(dias),
    deudor_persona_id: PERSONA, origen: 'liquidacion', estado: 'vigente', ajustes: '0', aplicado: String(Number(valor) - Number(saldo)), saldo,
  }
}

function comunicado(n: number, titulo: string, dias: number, extra: Partial<ComunicadoRecibido['comunicado']> = {}, leido = true): ComunicadoRecibido {
  return {
    comunicado: {
      id: id(n), titulo, cuerpo: `${titulo}.\n\nLa administración informa a todos los residentes los detalles de este aviso.`,
      finalidad: 'comunicaciones', audiencia: { tipo: 'todos' }, importante: false, requiere_confirmacion: false, estado: 'enviado',
      enviado_en: hace(dias), adjuntos: [], creado_en: hace(dias + 1), actualizado_en: hace(dias), ...extra,
    },
    leido_en: leido ? hace(dias) : null,
    enterado_en: null,
  }
}

/** ¿La cuenta demo autorizó la publicidad? (las piezas del directorio dependen de esto). */
export function publicidadAutorizada(): boolean {
  return publicidad
}

export function iniciarMi(): void {
  consecutivo = 9500
  obligaciones = [
    obligacion(9101, 'Cuota de administración', -20, '350000.00', '350000.00'),
    obligacion(9102, 'Cuota de administración', 10, '350000.00', '350000.00'),
    obligacion(9103, 'Intereses de mora', -5, '8750.00', '8750.00'),
  ]
  comunicados = [
    comunicado(9201, 'Corte de agua el sábado', 0, { importante: true, requiere_confirmacion: true }, false),
    comunicado(9202, 'Mantenimiento de ascensores', 4),
    comunicado(9203, 'Asamblea ordinaria 2027', 12),
  ]
  publicidad = false
}

function estadoDe(bienId: string) {
  const b = bienesDemo().find((x) => x.id === bienId)
  const propias = obligaciones.filter((o) => o.bien_privado_id === bienId && o.estado === 'vigente')
  const hoy = fecha(0)
  const saldo = propias.reduce((s, o) => s + Number(o.saldo), 0)
  const vencido = propias.filter((o) => o.vencimiento < hoy).reduce((s, o) => s + Number(o.saldo), 0)
  return {
    bien: { id: bienId, codigo: b?.codigo ?? '', tipo: b?.tipo ?? 'apartamento', activo: true, referencia_pago: `REF-${b?.codigo ?? ''}` },
    corte: hoy, obligaciones: propias, pagos: bienId === T1_102 ? [{ recibo_id: id(9601), fecha: fecha(-10), obligacion_id: id(9602), valor: '350000.00' }] : [],
    saldo: saldo.toFixed(2), vencido: vencido.toFixed(2), anticipos: '0',
  }
}

const cuentaCobro = (n: number, dias: number, total: string): CuentaCobro => ({
  id: id(n), numero: `CC-${n}`, liquidacion_id: id(n + 1), bien_privado_id: T1_101, periodo: fecha(dias - 15), deudor_persona_id: PERSONA,
  saldo_anterior: '0', cargos: total, total, vencimiento: fecha(dias), referencia_pago: 'REF-T1-101', creada_en: hace(-dias + 15),
})

export const mi: Manejador = async (req, ruta) => {
  const m = req.method
  if (ruta.match(/^\/entidades\/[^/]+\/publicidad\/autorizacion$/)) {
    if (m === 'GET') return json({ autorizada: publicidad, politica: { version: 1, texto: 'Recibirá ofertas de los comercios del directorio según sus preferencias. Puede retirarse cuando quiera.', vigente_desde: hace(90) } })
    if (m === 'POST') {
      const { version } = await cuerpo<{ version: number }>(req)
      if (version !== 1) return error(422, 'validacion', 'Debe aceptar la política vigente.')
      publicidad = true
      return sinContenido()
    }
    if (m === 'DELETE') {
      publicidad = false
      return sinContenido()
    }
  }
  const base = ruta.match(/^\/copropiedades\/[^/]+(\/.*)$/)?.[1]
  if (!base) return null

  // Mi cartera
  if (m === 'GET' && base === '/mi-cartera/bienes') return json([estadoDe(T1_101).bien, estadoDe(T1_102).bien])
  const cartera = base.match(/^\/mi-cartera\/bienes\/([^/]+)\/(estado-cuenta|cuentas-cobro|paz-y-salvo)$/)
  if (cartera) {
    const bienId = cartera[1] ?? ''
    if (![T1_101, T1_102].includes(bienId)) return error(404, 'no_encontrado', 'El bien no es de la cuenta.')
    if (m === 'GET' && cartera[2] === 'estado-cuenta') return json(estadoDe(bienId))
    if (m === 'GET' && cartera[2] === 'cuentas-cobro') return json(bienId === T1_101 ? [cuentaCobro(9701, 10, '708750.00'), cuentaCobro(9702, -20, '350000.00')] : [])
    if (m === 'POST' && cartera[2] === 'paz-y-salvo') {
      const e = estadoDe(bienId)
      if (Number(e.saldo) > 0) return error(409, 'conflicto', `El bien tiene un saldo de ${e.saldo}.`)
      return json(
        {
          certificado: { id: id(++consecutivo), tipo: 'paz_y_salvo', bien_privado_id: bienId, corte: fecha(0), saldo: '0', vencido: '0', pdf_sha256: 'x', emitido_en: new Date().toISOString() },
          codigo: 'PYS-7Q4K-2M9D',
          pdf_base64: btoa('%PDF-1.4 paz y salvo demo'),
        },
        201,
      )
    }
  }
  if (m === 'GET' && base.match(/^\/mi-cartera\/cuentas-cobro\/[^/]+\/pdf$/)) {
    return new Response('%PDF-1.4 cuenta de cobro demo', { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="cuenta-de-cobro.pdf"' } })
  }

  // Comunicados
  if (m === 'GET' && base === '/mis-comunicados') return json({ datos: comunicados, siguiente: null })
  const com = base.match(/^\/mis-comunicados\/([^/]+)(\/enterado)?$/)
  if (com) {
    const c = comunicados.find((x) => x.comunicado.id === com[1])
    if (!c) return error(404, 'no_encontrado', 'No es destinatario.')
    if (m === 'GET' && !com[2]) {
      c.leido_en ??= new Date().toISOString()
      return json({ ...c, enlaces_adjuntos: c.comunicado.importante ? [{ archivo_id: id(9801), nombre: 'Horario del corte.pdf', tipo_mime: 'application/pdf', url: 'https://archivos.demo.dad/corte.pdf?firma=demo' }] : [] })
    }
    if (m === 'POST' && com[2]) {
      if (!c.comunicado.requiere_confirmacion) return error(409, 'conflicto', 'El comunicado no pide confirmación.')
      c.enterado_en ??= new Date().toISOString()
      return json(c)
    }
  }

  // Mis datos (la persona de la cuenta demo)
  if (m === 'GET' && base === '/proteccion-datos/mis-datos') {
    const p = personasDemo().find((x) => x.id === PERSONA)
    if (!p) return error(404, 'no_encontrado', 'La cuenta no tiene persona en la copropiedad.')
    return json({
      persona: p,
      autorizaciones: [{ id: id(9951), finalidad: 'administracion', medio: 'web', politica_version: 1, otorgada_en: hace(200) }],
      solicitudes: [],
    })
  }
  return null
}
