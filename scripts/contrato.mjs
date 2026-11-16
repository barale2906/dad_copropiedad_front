// Aviso de contrato desactualizado: compara el openapi.json del backend con la huella del que
// generó src/api/esquema.d.ts. Solo avisa (no falla): el backend puede adelantarse a propósito.
//
//   node scripts/contrato.mjs guardar [openapi.json]  → guarda la huella (lo hace `npm run tipos-api`)
//   node scripts/contrato.mjs [openapi.json]          → compara (lo hace `make verificar`)
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const HUELLA = 'src/api/contrato.huella'
const guardar = process.argv[2] === 'guardar'
const contrato = process.argv[guardar ? 3 : 2] ?? '/contrato/openapi.json'

const huella = (archivo) => createHash('sha256').update(readFileSync(archivo)).digest('hex')

if (!existsSync(contrato)) {
  console.warn(`⚠ contrato: no se encontró ${contrato}; no se comparó (revise BACK_DIR).`)
  process.exit(guardar ? 1 : 0)
}

if (guardar) {
  writeFileSync(HUELLA, `${huella(contrato)}\n`)
  console.log(`✔ contrato: huella guardada en ${HUELLA}`)
} else if (!existsSync(HUELLA) || readFileSync(HUELLA, 'utf8').trim() !== huella(contrato)) {
  console.warn('⚠ contrato: esquema.d.ts no corresponde al openapi.json del backend. Ejecute `make tipos-api`.')
} else {
  console.log('✔ contrato: esquema.d.ts al día con el backend')
}
