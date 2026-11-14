// Presupuesto de peso: falla el build si la app deja de ser liviana.
//
//   inicial → JS que descarga el login (entrada + modulepreload), sin three.js
//   motor3d → chunk diferido con three.js y la escena (EscenaCanvas)
//
// Uso: node scripts/presupuesto.mjs [dist]
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const LIMITES_KB = { inicial: 120, motor3d: 220 }

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
if (motor.length === 0) {
  console.error('✘ No se encontró el chunk de EscenaCanvas: ¿three.js quedó en el bundle inicial?')
  falla = true
}
if (falla) {
  console.error('Presupuesto de peso excedido (ver AGENTS.md §7).')
  process.exit(1)
}
