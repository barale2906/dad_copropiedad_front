// Genera src/api/esquema.d.ts desde el openapi.json del backend.
//
// Quita los `operationId` antes de generar: openapi-typescript agrupa los tipos por
// operationId y el contrato repite varios (p. ej. `listar` en decenas de rutas), lo que haría
// que una ruta tomara los tipos de otra. Sin ellos, cada ruta lleva sus propios tipos.
//
//   node scripts/tipos-api.mjs [openapi.json]
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const contrato = process.argv[2] ?? '/contrato/openapi.json'
const esquema = JSON.parse(readFileSync(contrato, 'utf8'))

let quitados = 0
for (const ruta of Object.values(esquema.paths ?? {})) {
  for (const operacion of Object.values(ruta)) {
    if (operacion && typeof operacion === 'object' && 'operationId' in operacion) {
      delete operacion.operationId
      quitados++
    }
  }
}

const carpeta = mkdtempSync(join(tmpdir(), 'contrato-'))
const limpio = join(carpeta, 'openapi.json')
try {
  writeFileSync(limpio, JSON.stringify(esquema))
  execFileSync('npx', ['openapi-typescript', limpio, '-o', 'src/api/esquema.d.ts'], { stdio: 'inherit' })
} finally {
  rmSync(carpeta, { recursive: true, force: true })
}
console.log(`✔ tipos: ${quitados} operationId omitidos para que cada ruta tenga sus tipos`)
execFileSync('node', ['scripts/contrato.mjs', 'guardar', contrato], { stdio: 'inherit' })
