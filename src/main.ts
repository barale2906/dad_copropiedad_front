// Inter trae todos los subconjuntos, pero cada uno con su unicode-range: el navegador solo
// descarga el latino. De Rajdhani (títulos) se importa solo el latino.
import '@fontsource-variable/inter/wght.css'
import '@fontsource/rajdhani/latin-600.css'
import '@fontsource/rajdhani/latin-700.css'
import './hud/estilos/tokens.css'
import './hud/estilos/base.css'

import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { cargarConfig } from './app/config'
import { router } from './app/router'
import { iniciarCliente } from './api/cliente'
import { alCerrarSesion } from './api/tokens'
import { useCuenta } from './stores/cuenta'
import { useEntidad } from './stores/entidad'
import { useSesion } from './stores/sesion'

const cfg = await cargarConfig()
if (cfg.modoDemo) {
  const { fetchDemo } = await import('./mocks/demo')
  iniciarCliente(cfg.apiUrl, fetchDemo)
} else {
  iniciarCliente(cfg.apiUrl)
}

const app = createApp(App).use(createPinia()).use(router)

// Sesión vencida, revocada o cerrada en otra pestaña → al inicio de sesión.
alCerrarSesion(() => {
  useSesion().alTerminar()
  useEntidad().salir()
  useCuenta().limpiar()
  if (router.currentRoute.value.name !== 'ingresar') router.replace({ name: 'ingresar' })
})

app.mount('#app')
