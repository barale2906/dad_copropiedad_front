<script setup lang="ts">
/**
 * Tarjeta de un comercio o servicio del directorio: nombre (enlace a la ficha si se da `a`),
 * categoría, calificación, distancia y contacto directo (WhatsApp, llamar, correo, sitio web).
 * Solo muestra: la sirven el directorio con sesión y el público (plan 16).
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import type { FichaDirectorio } from '@/api/tipos'
import { distanciaLegible, enlaceCorreo, enlaceSeguro, enlaceTelefono, enlaceWhatsapp } from '@/formato/directorio'
import CalificacionEstrellas from './CalificacionEstrellas.vue'
import HudInsignia from './HudInsignia.vue'
import ICorreo from '~icons/tabler/mail'
import ISitio from '~icons/tabler/world'
import ITelefono from '~icons/tabler/phone'
import IWhatsapp from '~icons/tabler/brand-whatsapp'

const props = withDefaults(
  defineProps<{
    ficha: FichaDirectorio
    /** Nombre ya resuelto de la categoría principal. */
    categoria?: string
    /** Destino de la ficha completa. */
    a?: RouteLocationRaw
    /** Nivel del encabezado del nombre (1 en la ficha completa, 3 dentro de una sección). */
    nivel?: 1 | 2 | 3
    /** Ficha completa: descripción entera, horario y dirección. */
    completa?: boolean
  }>(),
  { categoria: undefined, a: undefined, nivel: 3, completa: false },
)
defineEmits<{ contacto: [medio: 'whatsapp' | 'telefono' | 'correo' | 'sitio'] }>()

const contacto = computed(() => {
  const c = props.ficha.contacto
  return [
    { medio: 'whatsapp' as const, texto: 'WhatsApp', icono: IWhatsapp, url: enlaceWhatsapp(c.whatsapp) },
    { medio: 'telefono' as const, texto: 'Llamar', icono: ITelefono, url: enlaceTelefono(c.telefono) },
    { medio: 'correo' as const, texto: 'Correo', icono: ICorreo, url: enlaceCorreo(c.correo) },
    { medio: 'sitio' as const, texto: 'Sitio web', icono: ISitio, url: enlaceSeguro(c.sitio_web) },
  ].filter((x): x is typeof x & { url: string } => x.url !== null)
})
const distancia = computed(() => distanciaLegible(props.ficha.distancia_km))
const encabezado = computed(() => `h${props.nivel}`)
</script>

<template>
  <article
    class="tarjeta-anunciante"
    :class="{ destacada: ficha.destacada }"
  >
    <header>
      <component
        :is="encabezado"
        class="nombre"
      >
        <RouterLink
          v-if="a"
          :to="a"
        >
          {{ ficha.nombre_comercial }}
        </RouterLink>
        <template v-else>
          {{ ficha.nombre_comercial }}
        </template>
      </component>
      <HudInsignia
        v-if="ficha.destacada"
        tono="aviso"
      >
        Destacada
      </HudInsignia>
    </header>
    <p
      v-if="categoria || distancia"
      class="meta"
    >
      <span v-if="categoria">{{ categoria }}</span>
      <span v-if="distancia">{{ distancia }}</span>
    </p>
    <CalificacionEstrellas
      :valor="ficha.calificacion_promedio"
      :resenas="ficha.resenas"
    />
    <p
      v-if="ficha.descripcion"
      class="descripcion"
      :class="{ completa }"
    >
      {{ ficha.descripcion }}
    </p>
    <dl
      v-if="completa && (ficha.horario || ficha.direccion)"
      class="datos"
    >
      <div v-if="ficha.horario">
        <dt>Horario</dt>
        <dd>{{ ficha.horario }}</dd>
      </div>
      <div v-if="ficha.direccion">
        <dt>Dirección</dt>
        <dd>{{ ficha.direccion }}</dd>
      </div>
    </dl>
    <ul
      v-if="contacto.length"
      class="contacto"
      :aria-label="`Contacto de ${ficha.nombre_comercial}`"
    >
      <li
        v-for="c in contacto"
        :key="c.medio"
      >
        <a
          :href="c.url"
          :target="c.medio === 'whatsapp' || c.medio === 'sitio' ? '_blank' : undefined"
          :rel="c.medio === 'whatsapp' || c.medio === 'sitio' ? 'noopener noreferrer' : undefined"
          @click="$emit('contacto', c.medio)"
        >
          <component
            :is="c.icono"
            aria-hidden="true"
          />
          {{ c.texto }}<span class="solo-lector"> de {{ ficha.nombre_comercial }}</span>
        </a>
      </li>
    </ul>
    <slot />
  </article>
</template>

<style scoped>
.tarjeta-anunciante {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--linea);
  background: var(--superficie);
}

.destacada {
  border-color: color-mix(in srgb, var(--ambar) 55%, transparent);
}

header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 10px;
}

.nombre {
  margin: 0;
  font-size: 19px;
  overflow-wrap: anywhere;
}

h1.nombre {
  font-size: clamp(24px, 5vw, 34px);
}

.nombre a {
  color: var(--texto);
  text-decoration: none;
}

.nombre a:hover,
.nombre a:focus-visible {
  color: var(--cian);
  text-decoration: underline;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 0;
  color: var(--texto-2);
  font-size: 14px;
}

.descripcion {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--texto-2);
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
}

.descripcion.completa {
  display: block;
  white-space: pre-wrap;
}

.datos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 8px 16px;
  margin: 0;
}

dt {
  color: var(--texto-3);
  font-size: 13px;
}

dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}

.contacto {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}

.contacto a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--linea-fuerte);
  color: var(--cian);
  font-size: 15px;
  text-decoration: none;
}

.contacto a:hover,
.contacto a:focus-visible {
  background: var(--cian-tenue);
}
</style>
