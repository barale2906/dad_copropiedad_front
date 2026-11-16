<script setup lang="ts">
/**
 * Inicio de sesión: "terminal de acceso" HUD. El formulario aparece al instante; el holograma
 * 3D del conjunto se descarga después (y solo en equipos que lo soportan bien).
 */
import { computed, defineAsyncComponent, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { config } from '@/app/config'
import { mensajeDeError } from '@/api/errores'
import { perfil } from '@/escena/calidad'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import { usePreferencias } from '@/stores/preferencias'
import { useSesion } from '@/stores/sesion'
import IOjo from '~icons/tabler/eye'
import IOjoNo from '~icons/tabler/eye-off'
import IHuella from '~icons/tabler/fingerprint'
import ICorreo from '~icons/tabler/mail'
import MarcaDad from './componentes/MarcaDad.vue'

const EscenaCanvas = defineAsyncComponent(() => import('@/escena/EscenaCanvas.vue'))

type Paso = 'credenciales' | 'codigo' | 'recuperar' | 'recuperado'

const sesion = useSesion()
const router = useRouter()
const route = useRoute()

/** Vuelve a donde iba antes de que se le pidiera iniciar sesión (solo rutas internas). */
const destino = () => {
  const v = route.query.volver
  return typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : '/'
}
const prefs = usePreferencias()

const paso = ref<Paso>('credenciales')
const identificador = ref('')
const contrasena = ref('')
const verContrasena = ref(false)
const equipoCompartido = ref(false)
const codigo = ref('')
const correo = ref('')
const error = ref<string | null>(null)
const cargando = ref(false)
const formulario = useTemplateRef<HTMLFormElement>('formulario')

const calidad = perfil(prefs.calidad)
const conHolograma = ref(false)
const hologramaListo = ref(false)
const demo = computed(() => config().modoDemo)

onMounted(() => {
  // El holograma no compite con el primer pintado del formulario.
  if (calidad.nivel === 'alta' || calidad.nivel === 'media') {
    const idle = window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 300))
    idle(() => (conHolograma.value = true))
  }
})

async function enfocarPrimerCampo() {
  await nextTick()
  formulario.value?.querySelector('input')?.focus()
}

async function ir(p: Paso) {
  paso.value = p
  error.value = null
  await enfocarPrimerCampo()
}

async function entrar() {
  error.value = null
  cargando.value = true
  try {
    const r = await sesion.iniciar(identificador.value.trim(), contrasena.value, equipoCompartido.value)
    contrasena.value = ''
    if (r === 'segundo_factor') await ir('codigo')
    else await router.replace(destino())
  } catch (e) {
    error.value = mensajeDeError(e)
  } finally {
    cargando.value = false
  }
}

async function verificarCodigo() {
  error.value = null
  cargando.value = true
  try {
    await sesion.completarSegundoFactor(codigo.value.replace(/\s/g, ''))
    await router.replace(destino())
  } catch (e) {
    error.value = mensajeDeError(e)
    codigo.value = ''
  } finally {
    cargando.value = false
  }
}

async function recuperar() {
  error.value = null
  cargando.value = true
  try {
    await sesion.recuperarContrasena(correo.value.trim())
    await ir('recuperado')
  } catch (e) {
    error.value = mensajeDeError(e)
  } finally {
    cargando.value = false
  }
}

const TITULOS: Record<Paso, [string, string]> = {
  credenciales: ['Acceso', 'Identifíquese para entrar al sistema'],
  codigo: ['Segundo factor', 'Ingrese el código de 6 dígitos de su aplicación autenticadora'],
  recuperar: ['Recuperar acceso', 'Le enviaremos un código para definir una contraseña nueva'],
  recuperado: ['Revise su correo', 'Si la cuenta existe, recibirá un código de 6 dígitos en unos minutos'],
}
</script>

<template>
  <main class="login">
    <div
      class="fondo-hud"
      aria-hidden="true"
    />

    <div
      v-if="conHolograma"
      class="holograma"
      :class="{ visible: hologramaListo }"
      aria-hidden="true"
    >
      <EscenaCanvas
        plantilla="conjunto"
        modo="holograma"
        :perfil="calidad"
        @lista="hologramaListo = true"
        @fallo="conHolograma = false"
      />
    </div>

    <section class="presentacion">
      <MarcaDad />
      <h1>
        La copropiedad,<br><span>en un solo mapa.</span>
      </h1>
      <p class="lema">
        Administración, asambleas, portería, reservas y contabilidad: entre a su conjunto o a su
        empresa y elija a dónde ir.
      </p>
      <ul
        class="telemetria"
        aria-label="Capacidades"
      >
        <li><span>01</span> Multi-copropiedad</li>
        <li><span>02</span> Asambleas en vivo</li>
        <li><span>03</span> Contabilidad PH</li>
      </ul>
    </section>

    <HudPanel
      as="div"
      class="acceso"
      resaltado
    >
      <header class="cabecera">
        <p class="rotulo estado">
          <i aria-hidden="true" /> Terminal de acceso
        </p>
        <h2>{{ TITULOS[paso][0] }}</h2>
        <p class="subtitulo">
          {{ TITULOS[paso][1] }}
        </p>
      </header>

      <Transition
        name="vista"
        mode="out-in"
      >
        <form
          v-if="paso === 'credenciales'"
          ref="formulario"
          key="credenciales"
          class="formulario"
          @submit.prevent="entrar"
        >
          <HudCampo
            v-model="identificador"
            etiqueta="Usuario o correo"
            autocompletar="username"
            requerido
          />
          <HudCampo
            v-model="contrasena"
            etiqueta="Contraseña"
            :tipo="verContrasena ? 'text' : 'password'"
            autocompletar="current-password"
            requerido
          >
            <template #despues>
              <button
                type="button"
                class="ver"
                :aria-label="verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                :aria-pressed="verContrasena"
                @click="verContrasena = !verContrasena"
              >
                <IOjoNo v-if="verContrasena" />
                <IOjo v-else />
              </button>
            </template>
          </HudCampo>
          <label class="casilla">
            <input
              v-model="equipoCompartido"
              type="checkbox"
            >
            <span>Equipo compartido (portería): la sesión dura un turno</span>
          </label>
          <p
            v-if="error"
            class="error"
            role="alert"
          >
            {{ error }}
          </p>
          <HudBoton
            tipo="submit"
            bloque
            :cargando="cargando"
          >
            Entrar
          </HudBoton>
          <button
            type="button"
            class="enlace"
            @click="ir('recuperar')"
          >
            ¿Olvidó su contraseña?
          </button>
          <RouterLink
            :to="{ name: 'contrasena' }"
            class="enlace"
          >
            ¿Es nuevo? Defina su contraseña con el código
          </RouterLink>
        </form>

        <form
          v-else-if="paso === 'codigo'"
          ref="formulario"
          key="codigo"
          class="formulario"
          @submit.prevent="verificarCodigo"
        >
          <HudCampo
            v-model="codigo"
            etiqueta="Código"
            autocompletar="one-time-code"
            modo-entrada="numeric"
            :maximo="7"
            requerido
          >
            <template #antes>
              <IHuella class="icono-campo" />
            </template>
          </HudCampo>
          <p
            v-if="error"
            class="error"
            role="alert"
          >
            {{ error }}
          </p>
          <HudBoton
            tipo="submit"
            bloque
            :cargando="cargando"
          >
            Verificar
          </HudBoton>
          <button
            type="button"
            class="enlace"
            @click="ir('credenciales')"
          >
            Volver
          </button>
        </form>

        <form
          v-else-if="paso === 'recuperar'"
          ref="formulario"
          key="recuperar"
          class="formulario"
          @submit.prevent="recuperar"
        >
          <HudCampo
            v-model="correo"
            etiqueta="Correo de la cuenta"
            tipo="email"
            autocompletar="email"
            modo-entrada="email"
            requerido
          >
            <template #antes>
              <ICorreo class="icono-campo" />
            </template>
          </HudCampo>
          <p
            v-if="error"
            class="error"
            role="alert"
          >
            {{ error }}
          </p>
          <HudBoton
            tipo="submit"
            bloque
            :cargando="cargando"
          >
            Enviar código
          </HudBoton>
          <button
            type="button"
            class="enlace"
            @click="ir('credenciales')"
          >
            Volver
          </button>
        </form>

        <div
          v-else
          key="recuperado"
          class="formulario"
        >
          <HudBoton
            :a="{ name: 'contrasena', state: { correo: correo.trim() } }"
            bloque
          >
            Ya tengo el código
          </HudBoton>
          <HudBoton
            variante="secundario"
            bloque
            @click="ir('credenciales')"
          >
            Volver al acceso
          </HudBoton>
        </div>
      </Transition>

      <p
        v-if="demo"
        class="demo"
      >
        <strong>Modo demo:</strong> cualquier usuario y contraseña. Incluya «uno» para una sola
        entidad, «empresa» para la oficina, «2fa» para el segundo factor o «nuevo» para una cuenta sin
        roles. Los códigos del demo son 123456.
      </p>
    </HudPanel>
  </main>
</template>

<style scoped>
.login {
  position: relative;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 440px);
  align-items: center;
  gap: clamp(24px, 5vw, 80px);
  padding: var(--gutter) clamp(16px, 6vw, 96px);
  overflow: hidden;
  isolation: isolate;
}

.holograma {
  position: absolute;
  inset: -6% 36% 24% -4%;
  z-index: -1;
  opacity: 0;
  transition: opacity 1.2s var(--curva);
  pointer-events: none;
  mask-image: radial-gradient(ellipse at center, black 40%, transparent 75%);
}

.holograma.visible {
  opacity: 0.9;
}

.presentacion {
  display: grid;
  gap: 20px;
  max-width: 560px;
  align-self: end;
  padding-bottom: clamp(0px, 6vh, 64px);
}

h1 {
  font-size: clamp(34px, 5.2vw, 64px);
  font-weight: 700;
  text-shadow: 0 0 30px rgb(56 232 255 / 25%);
}

h1 span {
  color: var(--cian);
}

.lema {
  margin: 0;
  max-width: 46ch;
  color: var(--texto-2);
  font-size: 16px;
}

.telemetria {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-family: var(--fuente-display);
  font-size: 14px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--texto-2);
}

.telemetria span {
  color: var(--cian);
  margin-right: 6px;
}

.acceso {
  width: 100%;
}

.cabecera {
  display: grid;
  gap: 6px;
  margin-bottom: 22px;
}

.estado {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--cian);
  margin: 0 0 6px;
}

.estado i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--verde);
  box-shadow: 0 0 10px var(--verde);
  animation: latido 2s ease-in-out infinite;
}

@keyframes latido {
  50% {
    opacity: 0.35;
  }
}

h2 {
  font-size: 30px;
}

.subtitulo {
  margin: 0;
  color: var(--texto-2);
  font-size: 14px;
}

.formulario {
  display: grid;
  gap: 16px;
}

.ver {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  background: none;
  color: var(--texto-3);
  cursor: pointer;
  font-size: 20px;
}

.ver:hover {
  color: var(--cian);
}

.icono-campo {
  color: var(--texto-3);
  font-size: 20px;
}

.casilla {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 13px;
  color: var(--texto-2);
  cursor: pointer;
}

.casilla input {
  margin-top: 3px;
  accent-color: var(--cian);
}

.error {
  margin: 0;
  padding: 10px 12px;
  border-left: 3px solid var(--magenta);
  background: rgb(255 77 141 / 10%);
  color: #ffd1e0;
  font-size: 14px;
}

.enlace {
  justify-self: center;
  border: 0;
  background: none;
  color: var(--texto-2);
  font-size: 14px;
  cursor: pointer;
  padding: 6px;
}

.enlace:hover {
  color: var(--cian);
}

.demo {
  margin: 20px 0 0;
  padding-top: 14px;
  border-top: 1px dashed var(--linea);
  font-size: 12.5px;
  color: var(--texto-3);
}

.demo strong {
  color: var(--ambar);
}

@media (max-width: 860px) {
  .login {
    grid-template-columns: 1fr;
    align-content: start;
    gap: 24px;
    padding-top: 28px;
  }

  .holograma {
    inset: 0 0 45% 0;
  }

  .presentacion {
    align-self: start;
    padding-bottom: 0;
    gap: 14px;
  }

  .lema,
  .telemetria {
    display: none;
  }

  h1 {
    font-size: clamp(30px, 8vw, 44px);
    margin-top: clamp(40px, 16vh, 140px);
  }
}
</style>
