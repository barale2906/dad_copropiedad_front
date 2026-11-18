<script setup lang="ts">
/**
 * Tabla jerárquica del balance de prueba: clases, grupos, cuentas, subcuentas y auxiliares
 * (y el detalle por tercero o centro) con saldo inicial, débitos, créditos y saldo final. Se
 * elige hasta qué nivel mostrar y cada fila con hijas se pliega o despliega (botón con
 * `aria-expanded`). En papel se imprime lo que se ve.
 */
import { computed, ref } from 'vue'
import { moneda } from '@/formato/decimales'
import HudSelector from '@/hud/componentes/HudSelector.vue'
import IAbajo from '~icons/tabler/chevron-down'
import IDerecha from '~icons/tabler/chevron-right'
import { type FilaArbol, filasVisibles } from '../reglas'

const props = defineProps<{ arbol: FilaArbol[]; titulo: string }>()

const NIVELES = [
  { valor: '0', etiqueta: 'Clase' },
  { valor: '1', etiqueta: 'Grupo' },
  { valor: '2', etiqueta: 'Cuenta' },
  { valor: '3', etiqueta: 'Subcuenta' },
  { valor: '4', etiqueta: 'Auxiliar' },
  { valor: '5', etiqueta: 'Con detalle' },
] as const
const nivel = ref<(typeof NIVELES)[number]['valor']>('5')
const plegadas = ref(new Set<string>())

const filas = computed(() => filasVisibles(props.arbol, Number(nivel.value), plegadas.value))
const plegable = (f: FilaArbol) => f.tieneHijas && f.nivel < Number(nivel.value)
const cero = (t: string) => t === '0' || /^-?0(\.0+)?$/.test(t)
const monto = (t: string) => (cero(t) ? '' : moneda(t))

function alternar(f: FilaArbol) {
  const s = new Set(plegadas.value)
  if (s.has(f.clave)) s.delete(f.clave)
  else s.add(f.clave)
  plegadas.value = s
}
</script>

<template>
  <div class="reporte">
    <div class="no-imprimir controles">
      <HudSelector
        v-model="nivel"
        etiqueta="Mostrar hasta"
        :opciones="[...NIVELES]"
      />
    </div>
    <div class="desplazable">
      <table :aria-label="titulo">
        <thead>
          <tr>
            <th scope="col">
              Cuenta
            </th>
            <th
              scope="col"
              class="num"
            >
              Saldo inicial
            </th>
            <th
              scope="col"
              class="num"
            >
              Débitos
            </th>
            <th
              scope="col"
              class="num"
            >
              Créditos
            </th>
            <th
              scope="col"
              class="num"
            >
              Saldo final
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="f in filas"
            :key="f.clave"
            :class="[`nivel-${f.nivel}`, { agrupada: !f.hoja }]"
          >
            <th
              scope="row"
              :style="{ paddingLeft: `${8 + f.nivel * 16}px` }"
            >
              <button
                v-if="plegable(f)"
                type="button"
                class="plegar no-imprimir"
                :aria-expanded="!plegadas.has(f.clave)"
                @click="alternar(f)"
              >
                <IAbajo
                  v-if="!plegadas.has(f.clave)"
                  aria-hidden="true"
                />
                <IDerecha
                  v-else
                  aria-hidden="true"
                />
                <span class="solo-lector">{{ plegadas.has(f.clave) ? 'Desplegar' : 'Plegar' }} {{ f.codigo }}</span>
              </button>
              <span
                v-else
                class="hueco no-imprimir"
                aria-hidden="true"
              />
              <span class="codigo">{{ f.clave === f.codigo ? f.codigo : '' }}</span> {{ f.nombre }}
            </th>
            <td class="num">
              {{ monto(f.saldo_inicial) }}
            </td>
            <td class="num">
              {{ monto(f.debitos) }}
            </td>
            <td class="num">
              {{ monto(f.creditos) }}
            </td>
            <td class="num">
              {{ monto(f.saldo_final) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.reporte {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.controles {
  max-width: 260px;
}

.desplazable {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  font-size: 15px;
}

th,
td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--linea);
  text-align: left;
}

thead th {
  color: var(--texto-3);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

tbody th {
  font-weight: 400;
}

.num {
  font-family: var(--fuente-mono);
  text-align: right;
  white-space: nowrap;
}

.agrupada th,
.agrupada td {
  font-weight: 700;
}

.nivel-0 {
  background: var(--cian-tenue);
}

.codigo {
  font-family: var(--fuente-mono);
}

.plegar,
.hueco {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-right: 4px;
  vertical-align: middle;
}

.plegar {
  border: 0;
  background: transparent;
  color: var(--cian);
  cursor: pointer;
}

.plegar:focus-visible {
  outline: 2px solid var(--cian);
}
</style>
