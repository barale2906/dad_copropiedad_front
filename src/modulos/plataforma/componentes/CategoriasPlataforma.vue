<script setup lang="ts">
/**
 * Catálogo de categorías del directorio (todas, también restringidas e inactivas): crear una
 * rama o una subcategoría y editar nombre, sinónimos, restricción y si está activa.
 */
import { computed, ref } from 'vue'
import type { CategoriaDirectorio } from '@/api/tipos'
import { useAccion } from '@/composables/useAccion'
import HudBoton from '@/hud/componentes/HudBoton.vue'
import HudCampo from '@/hud/componentes/HudCampo.vue'
import HudInsignia from '@/hud/componentes/HudInsignia.vue'
import HudPanel from '@/hud/componentes/HudPanel.vue'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import { guardarCategoria } from '../api-publicidad'

const categorias = defineModel<CategoriaDirectorio[]>({ required: true })

const vacio = () => ({ codigo: '', nombre: '', padre: '', sinonimos: '', restringida: false, activa: true })
const f = ref(vacio())
const editando = ref<string | null>(null)
const intentado = ref(false)
const resultado = ref<string | null>(null)

const ramas = computed(() => categorias.value.filter((c) => !c.padre))
const opcionesRama = computed(() => [{ valor: '', etiqueta: 'Es una rama' }, ...ramas.value.map((r) => ({ valor: r.codigo, etiqueta: r.nombre }))])
const ordenadas = computed(() =>
  [...ramas.value]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .flatMap((r) => [r, ...categorias.value.filter((c) => c.padre === r.codigo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))]),
)
const errorCodigo = computed(() => (intentado.value && !/^[a-z0-9_]{2,40}$/.test(f.value.codigo) ? 'Use letras minúsculas sin tilde, números o guion bajo.' : null))
const errorNombre = computed(() => (intentado.value && f.value.nombre.trim().length < 2 ? 'Escriba el nombre.' : null))

const guardar = useAccion(() =>
  guardarCategoria(f.value.codigo, {
    nombre: f.value.nombre.trim(),
    padre: f.value.padre || null,
    sinonimos: f.value.sinonimos.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30),
    restringida: f.value.restringida,
    activa: f.value.activa,
  }),
)

function editar(c: CategoriaDirectorio) {
  guardar.reiniciar()
  intentado.value = false
  editando.value = c.codigo
  f.value = { codigo: c.codigo, nombre: c.nombre, padre: c.padre ?? '', sinonimos: c.sinonimos.join(', '), restringida: c.restringida, activa: c.activa }
}

function nueva() {
  guardar.reiniciar()
  intentado.value = false
  editando.value = null
  f.value = vacio()
}

async function enviar() {
  intentado.value = true
  if (errorCodigo.value || errorNombre.value) return
  const r = await guardar.ejecutar()
  if (!r.ok) return
  categorias.value = categorias.value.some((c) => c.codigo === r.valor.codigo)
    ? categorias.value.map((c) => (c.codigo === r.valor.codigo ? r.valor : c))
    : [...categorias.value, r.valor]
  resultado.value = `Categoría «${r.valor.nombre}» guardada.`
  nueva()
}
</script>

<template>
  <div class="campos">
    <HudPanel :etiqueta="editando ? 'Editar categoría' : 'Nueva categoría'">
      <form
        class="campos"
        novalidate
        @submit.prevent="enviar"
      >
        <div class="filtros">
          <HudCampo
            v-model="f.codigo"
            etiqueta="Código"
            :error="errorCodigo"
            :ayuda="editando ? 'El código no cambia.' : undefined"
          />
          <HudCampo
            v-model="f.nombre"
            etiqueta="Nombre"
            :error="errorNombre"
          />
          <HudSelector
            v-model="f.padre"
            etiqueta="Rama"
            :opciones="opcionesRama"
          />
        </div>
        <HudCampo
          v-model="f.sinonimos"
          etiqueta="Sinónimos (separados por coma)"
          ayuda="Ayudan a la búsqueda y a «Busco …»: modista, arreglos de ropa…"
        />
        <label class="casilla"><input
          v-model="f.restringida"
          type="checkbox"
        > Restringida (licores, apuestas, salud con fórmula: no se elige en una ficha)</label>
        <label class="casilla"><input
          v-model="f.activa"
          type="checkbox"
        > Activa</label>
        <div class="botones">
          <HudBoton
            tipo="submit"
            :cargando="guardar.cargando.value"
          >
            Guardar categoría
          </HudBoton>
          <HudBoton
            v-if="editando"
            variante="fantasma"
            @click="nueva"
          >
            Cancelar edición
          </HudBoton>
        </div>
        <p
          v-if="guardar.error.value"
          class="error"
          role="alert"
        >
          {{ guardar.error.value }}
        </p>
      </form>
    </HudPanel>
    <p
      v-if="resultado"
      class="ok"
      role="status"
    >
      {{ resultado }}
    </p>
    <ul class="lista">
      <li
        v-for="c in ordenadas"
        :key="c.codigo"
      >
        <span class="crece">
          <strong>{{ c.padre ? '— ' : '' }}{{ c.nombre }}</strong>
          <small>{{ c.codigo }}<template v-if="c.sinonimos.length"> · {{ c.sinonimos.join(', ') }}</template></small>
        </span>
        <HudInsignia
          v-if="c.restringida"
          tono="peligro"
        >
          Restringida
        </HudInsignia>
        <HudInsignia
          v-if="!c.activa"
          tono="neutro"
        >
          Inactiva
        </HudInsignia>
        <HudBoton
          variante="fantasma"
          @click="editar(c)"
        >
          Editar<span class="solo-lector"> {{ c.nombre }}</span>
        </HudBoton>
      </li>
    </ul>
  </div>
</template>

<style scoped src="@/hud/estilos/modulo.css"></style>
