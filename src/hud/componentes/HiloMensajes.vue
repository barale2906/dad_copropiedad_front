<script setup lang="ts">
/**
 * Hilo de mensajes (tickets, chat, reseñas): autor y hora, los propios a la derecha y las
 * **notas internas** marcadas con texto y estilo propio (no solo con color). Genérico: el padre
 * le pasa los mensajes ya con su autor y su hora formateada. El slot `pie` agrega lo propio de
 * cada mensaje (calificación, «Reportar»…).
 */
import ICandado from '~icons/tabler/lock'

export interface MensajeHilo {
  id: string
  texto: string
  autor: string
  /** Hora ya formateada en la zona de la entidad. */
  hora: string
  propio?: boolean
  interno?: boolean
}

withDefaults(defineProps<{ mensajes: MensajeHilo[]; etiqueta?: string; vacio?: string }>(), {
  etiqueta: 'Mensajes',
  vacio: 'Aún no hay mensajes.',
})
defineSlots<{ pie?: (props: { mensaje: MensajeHilo }) => unknown }>()
</script>

<template>
  <p
    v-if="mensajes.length === 0"
    class="vacio"
  >
    {{ vacio }}
  </p>
  <ol
    v-else
    class="hilo"
    :aria-label="etiqueta"
  >
    <li
      v-for="m in mensajes"
      :key="m.id"
      :class="{ propio: m.propio, interno: m.interno }"
    >
      <small>
        <span
          v-if="m.interno"
          class="marca"
        ><ICandado aria-hidden="true" /> Nota interna ·</span>
        {{ m.autor }} · {{ m.hora }}
      </small>
      <p v-if="m.texto">
        {{ m.texto }}
      </p>
      <div
        v-if="$slots.pie"
        class="pie"
      >
        <slot
          name="pie"
          :mensaje="m"
        />
      </div>
    </li>
  </ol>
</template>

<style scoped>
.hilo {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  max-width: min(100%, 620px);
  padding: 10px 12px;
  border: 1px solid var(--linea);
  background: var(--superficie);
}

li.propio {
  justify-self: end;
  border-color: var(--cian);
}

li.interno {
  border-style: dashed;
  border-color: var(--ambar);
  background: color-mix(in srgb, var(--ambar) 8%, transparent);
}

small,
.vacio {
  color: var(--texto-3);
}

.marca {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ambar);
  font-weight: 600;
}

p {
  margin: 4px 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.vacio {
  margin: 0;
}

.pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-top: 6px;
}
</style>
