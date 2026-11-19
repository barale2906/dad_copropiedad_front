<script setup lang="ts">
/**
 * Habilitación con el motor propio, paso a paso según el estado (registrado → en pruebas →
 * habilitado → producción): software (SoftwareID, PIN y TestSetId), certificado de firma
 * (`por_vencer` visible), set de pruebas, consultar el resultado hasta quedar habilitado,
 * pasar a producción y traer los rangos autorizados. El PIN, el `.p12` y su contraseña nunca
 * vuelven en una respuesta.
 */
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { aBase64 } from '@/api/archivos'
import { mensajeDeError } from '@/api/errores'
import type { Habilitacion, RangoSincronizado } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import { fechaCalendario, fechaHora } from '@/formato/fechas'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudEstado from '@/hud/componentes/HudEstado.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudPasos from '@/hud/componentes/HudPasos.vue'
import { useEntidad } from '@/stores/entidad'
import * as api from '../api'
import { ESTADO_ENVIO, ESTADO_HABILITACION, type PasoHabilitacion, pasoHabilitacion, PASOS_HABILITACION, TIPO_DOCUMENTO_ELECTRONICO } from '../reglas'

const entidad = useEntidad()
const id = computed(() => entidad.activa?.entidad_id ?? '')
const configura = computed(() => entidad.tienePermiso('facturacion.configurar'))
const certifica = computed(() => entidad.tienePermiso('facturacion.certificado.gestionar'))
const selectorP12 = useTemplateRef<HTMLInputElement>('selectorP12')

const estado = ref<'cargando' | 'listo' | 'error'>('cargando')
const error = ref<string | null>(null)
const h = ref<Habilitacion>({ envios: [] })
const vista = ref<PasoHabilitacion>('software')
const resultado = ref<string | null>(null)
const rangos = ref<RangoSincronizado[] | null>(null)

const software = ref({ software_id: '', pin: '', test_set_id: '' })
const p12 = ref<File | null>(null)
const contrasena = ref('')
const set = ref({ cantidad: '8', notas_credito: '1', notas_debito: '1' })

const actual = computed(() => pasoHabilitacion(h.value))
const entero = (t: string) => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : NaN)

const registrar = useAccion(() =>
  api.registrarSoftware(id.value, { software_id: software.value.software_id.trim(), pin: software.value.pin.trim(), test_set_id: software.value.test_set_id.trim() || null }),
)
const certificar = useAccion(async () => api.cargarCertificado(id.value, await aBase64(p12.value ?? new Blob()), contrasena.value))
const enviar = useAccion(() =>
  api.enviarSetPruebas(id.value, { cantidad: entero(set.value.cantidad), notas_credito: entero(set.value.notas_credito) || 0, notas_debito: entero(set.value.notas_debito) || 0 }),
)
const consultar = useAccion(() => api.consultarSetPruebas(id.value))
const producir = useAccion(() => api.pasarAProduccion(id.value), { alConflicto: () => cargar() })
const sincronizar = useAccion(() => api.sincronizarRangos(id.value))

/** Sin la clave maestra en el servidor, registrar el software responde 422: es un tema de soporte. */
const ayudaSoftware = computed(() =>
  registrar.codigo.value === 'validacion' ? 'Si los datos son correctos y el error sigue, el servidor no tiene configurada la clave de facturación: comuníquese con soporte.' : null,
)

function irA(paso: PasoHabilitacion) {
  vista.value = paso
  resultado.value = null
}

async function tras(r: { ok: boolean }, texto: string) {
  if (!r.ok) return
  resultado.value = texto
  await cargar(false)
  vista.value = actual.value
}

async function alRegistrar() {
  const r = await registrar.ejecutar()
  if (r.ok) software.value.pin = ''
  await tras(r, 'Software registrado. El PIN quedó guardado cifrado y no se vuelve a mostrar.')
}

async function alCertificar() {
  if (!p12.value || !contrasena.value) {
    resultado.value = null
    return
  }
  const r = await certificar.ejecutar()
  contrasena.value = ''
  p12.value = null
  await tras(r, 'Certificado cargado y activo.')
}

async function alEnviar() {
  await tras(await enviar.ejecutar(), 'Set de pruebas enviado a la DIAN. Consulte el resultado en unos minutos.')
}

async function alConsultar() {
  const r = await consultar.ejecutar()
  await tras(r, r.ok && r.valor.estado === 'habilitado' ? 'La DIAN aceptó el set: la entidad quedó habilitada.' : 'Aún hay envíos sin aceptar; consulte de nuevo más tarde.')
}

async function alProducir() {
  await tras(await producir.ejecutar(), 'La entidad pasó a producción con el motor propio.')
}

async function alSincronizar() {
  const r = await sincronizar.ejecutar()
  if (r.ok) {
    rangos.value = r.valor
    resultado.value = r.valor.length ? `Se registraron ${r.valor.length} rango(s) como resoluciones de factura.` : 'No hay rangos nuevos: ya estaban registrados.'
  }
}

function elegirP12(e: Event) {
  p12.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function cargar(conEspera = true) {
  if (conEspera) estado.value = 'cargando'
  try {
    h.value = await api.habilitacion(id.value)
    software.value = { ...software.value, software_id: h.value.software_id ?? '', test_set_id: h.value.test_set_id ?? '' }
    estado.value = 'listo'
  } catch (e) {
    error.value = mensajeDeError(e)
    estado.value = 'error'
  }
}

onMounted(async () => {
  await cargar()
  vista.value = actual.value
})
</script>

<template>
  <section aria-labelledby="titulo-habilitacion">
    <header class="encabezado">
      <div>
        <h1 id="titulo-habilitacion">
          Habilitación DIAN
        </h1>
        <p class="texto-2">
          Para facturar con el motor propio. Para que las facturas salgan por él, el perfil tributario confirmado debe tener el canal «propio».
        </p>
      </div>
      <HudInsignia
        v-if="h.estado"
        :tono="h.estado === 'produccion' ? 'exito' : 'info'"
      >
        {{ ESTADO_HABILITACION[h.estado] }}{{ h.ambiente ? ` · ambiente de ${h.ambiente === 'produccion' ? 'producción' : 'habilitación'}` : '' }}
      </HudInsignia>
    </header>

    <HudEstado
      v-if="estado === 'cargando'"
      estado="cargando"
    />
    <HudEstado
      v-else-if="estado === 'error'"
      estado="error"
      :mensaje="error ?? undefined"
      @reintentar="cargar()"
    />
    <template v-else>
      <HudPasos
        :pasos="PASOS_HABILITACION"
        :actual="actual"
        etiqueta="Pasos de la habilitación"
        @ir="irA($event as PasoHabilitacion)"
      />
      <p
        v-if="resultado"
        class="ok"
        role="status"
      >
        {{ resultado }}
      </p>
      <p
        v-if="h.certificado?.por_vencer"
        class="aviso"
      >
        El certificado de firma vence el {{ fechaCalendario(h.certificado.vigente_hasta.slice(0, 10)) }} (o ya venció): cargue uno nuevo.
      </p>

      <HudPanel
        v-if="vista === 'software'"
        etiqueta="1. Software"
      >
        <form
          class="campos"
          novalidate
          @submit.prevent="alRegistrar"
        >
          <p class="texto-2">
            Datos del catálogo de participantes de la DIAN. Cambiar el software reinicia la habilitación.
          </p>
          <HudCampo
            v-model="software.software_id"
            etiqueta="SoftwareID"
            autocompletar="off"
          />
          <HudCampo
            v-model="software.pin"
            etiqueta="PIN del software"
            tipo="password"
            modo-entrada="numeric"
            autocompletar="off"
            ayuda="Se guarda cifrado y no vuelve a mostrarse."
          />
          <HudCampo
            v-model="software.test_set_id"
            etiqueta="TestSetId"
            autocompletar="off"
          />
          <p
            v-if="registrar.error.value"
            class="error"
            role="alert"
          >
            {{ registrar.error.value }} {{ ayudaSoftware }}
          </p>
          <div class="botones">
            <HudBoton
              tipo="submit"
              :cargando="registrar.cargando.value"
              :deshabilitado="!configura"
            >
              Registrar software
            </HudBoton>
          </div>
        </form>
      </HudPanel>

      <HudPanel
        v-if="vista === 'certificado'"
        etiqueta="2. Certificado de firma"
      >
        <div class="campos">
          <dl
            v-if="h.certificado"
            class="datos"
          >
            <div><dt>Titular</dt><dd>{{ h.certificado.sujeto }}</dd></div>
            <div><dt>Emisor</dt><dd>{{ h.certificado.emisor }}</dd></div>
            <div><dt>Vence</dt><dd>{{ fechaCalendario(h.certificado.vigente_hasta.slice(0, 10)) }}</dd></div>
          </dl>
          <form
            v-if="certifica"
            class="campos"
            novalidate
            @submit.prevent="alCertificar"
          >
            <input
              ref="selectorP12"
              type="file"
              class="solo-lector"
              accept=".p12,.pfx,application/x-pkcs12"
              tabindex="-1"
              aria-hidden="true"
              @change="elegirP12"
            >
            <div class="botones">
              <HudBoton
                variante="secundario"
                @click="selectorP12?.click()"
              >
                {{ p12 ? `Archivo: ${p12.name}` : 'Elegir el archivo .p12 o .pfx' }}
              </HudBoton>
            </div>
            <HudCampo
              v-model="contrasena"
              etiqueta="Contraseña del certificado"
              tipo="password"
              autocompletar="off"
              ayuda="Se guarda cifrada y no vuelve a mostrarse."
            />
            <p
              v-if="certificar.error.value"
              class="error"
              role="alert"
            >
              {{ certificar.error.value }}
            </p>
            <div class="botones">
              <HudBoton
                tipo="submit"
                :cargando="certificar.cargando.value"
                :deshabilitado="!p12 || !contrasena"
              >
                Cargar certificado
              </HudBoton>
            </div>
          </form>
          <p
            v-else
            class="texto-2"
          >
            Cargar el certificado requiere el permiso «Gestionar el certificado de firma».
          </p>
        </div>
      </HudPanel>

      <HudPanel
        v-if="vista === 'set'"
        etiqueta="3. Set de pruebas"
      >
        <form
          class="campos"
          novalidate
          @submit.prevent="alEnviar"
        >
          <p class="texto-2">
            La DIAN indica cuántos documentos pide al registrar el software (de 1 a 50 en total).
          </p>
          <div class="filtros">
            <HudCampo
              v-model="set.cantidad"
              etiqueta="Facturas de prueba"
              modo-entrada="numeric"
            />
            <HudCampo
              v-model="set.notas_credito"
              etiqueta="Notas crédito"
              modo-entrada="numeric"
            />
            <HudCampo
              v-model="set.notas_debito"
              etiqueta="Notas débito"
              modo-entrada="numeric"
            />
          </div>
          <p
            v-if="enviar.error.value"
            class="error"
            role="alert"
          >
            {{ enviar.error.value }}
          </p>
          <div class="botones">
            <HudBoton
              tipo="submit"
              :cargando="enviar.cargando.value"
              :deshabilitado="!configura"
            >
              Enviar set de pruebas
            </HudBoton>
          </div>
        </form>
      </HudPanel>

      <HudPanel
        v-if="vista === 'consulta'"
        etiqueta="4. Resultado del set"
      >
        <div class="campos">
          <ul
            v-if="h.envios.length"
            class="lista"
            aria-label="Envíos del set de pruebas"
          >
            <li
              v-for="e in h.envios"
              :key="e.id"
            >
              <span class="crece">
                <strong>{{ TIPO_DOCUMENTO_ELECTRONICO[e.tipo] }} {{ e.numero }}</strong>
                <small>Enviado {{ fechaHora(e.enviado_en, entidad.zonaHoraria) }}{{ e.respuesta ? ` · ${e.respuesta}` : '' }}</small>
              </span>
              <HudInsignia :tono="ESTADO_ENVIO[e.estado].tono">
                {{ ESTADO_ENVIO[e.estado].texto }}
              </HudInsignia>
            </li>
          </ul>
          <p
            v-if="consultar.error.value"
            class="error"
            role="alert"
          >
            {{ consultar.error.value }}
          </p>
          <div class="botones">
            <HudBoton
              :cargando="consultar.cargando.value"
              :deshabilitado="!configura"
              @click="alConsultar"
            >
              Consultar resultado
            </HudBoton>
          </div>
        </div>
      </HudPanel>

      <HudPanel
        v-if="vista === 'produccion'"
        etiqueta="5. Producción"
      >
        <div class="campos">
          <p class="texto-2">
            La DIAN habilitó a la entidad. Al pasar a producción, las facturas tienen validez ante la DIAN.
          </p>
          <p
            v-if="producir.error.value"
            class="error"
            role="alert"
          >
            {{ producir.error.value }}
          </p>
          <div class="botones">
            <HudBoton
              :cargando="producir.cargando.value"
              :deshabilitado="!configura || h.estado !== 'habilitado'"
              @click="alProducir"
            >
              Pasar a producción
            </HudBoton>
          </div>
        </div>
      </HudPanel>

      <HudPanel
        v-if="vista === 'rangos'"
        etiqueta="6. Rangos de numeración"
      >
        <div class="campos">
          <p class="texto-2">
            Trae de la DIAN los rangos autorizados al software y registra los que falten como resoluciones de factura.
          </p>
          <ul
            v-if="rangos?.length"
            class="lista"
            aria-label="Rangos registrados"
          >
            <li
              v-for="r in rangos"
              :key="r.id"
            >
              <span class="crece">
                <strong>{{ r.prefijo }} {{ r.desde }} a {{ r.hasta }}</strong>
                <small>Resolución {{ r.numero_resolucion }} · vigente hasta {{ fechaCalendario(r.vigente_hasta) }}</small>
              </span>
            </li>
          </ul>
          <p
            v-if="sincronizar.error.value"
            class="error"
            role="alert"
          >
            {{ sincronizar.error.value }}
          </p>
          <div class="botones">
            <HudBoton
              :cargando="sincronizar.cargando.value"
              :deshabilitado="!configura || h.estado !== 'produccion'"
              @click="alSincronizar"
            >
              Traer rangos de la DIAN
            </HudBoton>
          </div>
        </div>
      </HudPanel>
    </template>
  </section>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
