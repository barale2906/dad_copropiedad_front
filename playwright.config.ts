import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas E2E contra el build de producción servido por Nginx (`make e2e`), en modo demo.
 * Chromium usa SwiftShader para que la maqueta WebGL se dibuje sin GPU.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // La maqueta se dibuja por software (SwiftShader): con más navegadores en paralelo la CPU se
  // satura y el primer cuadro tarda más que la espera de `esperarMaqueta`.
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_URL ?? 'http://localhost:8088',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
})
