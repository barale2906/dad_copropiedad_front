import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'

export default defineConfig({
  plugins: [vue(), Icons({ compiler: 'vue3' })],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: process.env.VITE_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
  },
  build: {
    target: 'es2022',
    // three.js vive en su propio chunk diferido (~150 KB gzip); el aviso por defecto no aplica.
    chunkSizeWarningLimit: 700,
    // Lo lee scripts/presupuesto.mjs (peso por módulo) y lo borra al terminar.
    manifest: true,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      // La lógica (API, sesión, permisos, navegación) exige cobertura; las vistas y el motor 3D
      // se cubren con las pruebas E2E (Playwright).
      include: [
        'src/api/**/*.ts',
        'src/stores/**/*.ts',
        'src/app/carga.ts',
        'src/composables/**/*.ts',
        'src/formato/**/*.ts',
        'src/escena/mapa-modulos.ts',
        'src/modulos/*/api.ts',
        'src/modulos/*/usuarios.ts',
        'src/modulos/*/permisos.ts',
        'src/modulos/entidad/{ficha,suscripcion,auditoria,proteccion,organizaciones,store}.ts',
        'src/modulos/entidad/api-*.ts',
        'src/modulos/archivo/{archivo,store}.ts',
        'src/modulos/porteria/reglas.ts',
        'src/modulos/administracion/reglas.ts',
        'src/modulos/asambleas/reglas.ts',
        'src/modulos/asambleas/useTableroEnVivo.ts',
        'src/modulos/zonas-comunes/{reservas,recursos,store}.ts',
        'src/modulos/unidades/{coeficientes,titulares,censo,bienes}.ts',
        'src/modulos/mi/reglas.ts',
        'src/pantallas/navegacion.ts',
        'src/pantallas/textos-entidad.ts',
      ],
      exclude: ['src/api/esquema.d.ts', 'src/api/tipos.ts'],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
})
