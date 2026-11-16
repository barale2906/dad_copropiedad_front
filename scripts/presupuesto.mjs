// Presupuesto de peso: falla el build si la app deja de ser liviana.
//
//   inicial → JS que descarga el login (entrada + modulepreload), sin three.js
//   motor3d → chunk diferido con three.js y la escena (EscenaCanvas)
//   módulo  → JS propio de cada src/modulos/<seccion>/ (sus chunks diferidos), por separado
//
// Uso: node scripts/presupuesto.mjs [dist]
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const LIMITES_KB = { inicial: 120, motor3d: 220, modulo: 90 }

const dist = process.argv[2] ?? 'dist'
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const gz = (archivo) => gzipSync(readFileSync(join(dist, archivo))).length / 1024

const iniciales = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.js)"/g)].map((m) => m[1])
const inicial = iniciales.reduce((t, a) => t + gz(a), 0)

const motor = readdirSync(join(dist, 'assets')).filter((a) => /^EscenaCanvas-.*\.js$/.test(a))
const motor3d = motor.reduce((t, a) => t + gz(join('assets', a)), 0)

let falla = false
for (const [nombre, valor] of Object.entries({ inicial, motor3d })) {
  const limite = LIMITES_KB[nombre]
  const ok = valor <= limite
  falla ||= !ok
  console.log(`${ok ? '✔' : '✘'} ${nombre.padEnd(8)} ${valor.toFixed(1).padStart(6)} KB gzip (límite ${limite} KB)`)
}
// Peso propio de cada módulo, según el manifiesto de Vite (src → archivo generado).
const manifiesto = join(dist, '.vite', 'manifest.json')
if (existsSync(manifiesto)) {
  const entradas = Object.values(JSON.parse(readFileSync(manifiesto, 'utf8')))
  const porModulo = new Map()
  for (const e of entradas) {
    const m = /^src\/modulos\/([^/]+)\//.exec(e.src ?? '')
    if (m && e.file.endsWith('.js')) porModulo.set(m[1], (porModulo.get(m[1]) ?? new Set()).add(e.file))
  }
  for (const [modulo, archivos] of porModulo) {
    const peso = [...archivos].reduce((t, a) => t + gz(a), 0)
    const ok = peso <= LIMITES_KB.modulo
    falla ||= !ok
    console.log(`${ok ? '✔' : '✘'} módulo ${modulo.padEnd(14)} ${peso.toFixed(1).padStart(6)} KB gzip (límite ${LIMITES_KB.modulo} KB)`)
  }
  if (porModulo.size === 0) console.log('· módulos: aún no hay módulos en src/modulos/')
  rmSync(join(dist, '.vite'), { recursive: true, force: true })
}

if (motor.length === 0) {
  console.error('✘ No se encontró el chunk de EscenaCanvas: ¿three.js quedó en el bundle inicial?')
  falla = true
}
if (falla) {
  console.error('Presupuesto de peso excedido (ver AGENTS.md §7).')
  process.exit(1)
}
