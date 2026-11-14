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
  },
  test: {
    environment: 'jsdom',
  },
})
