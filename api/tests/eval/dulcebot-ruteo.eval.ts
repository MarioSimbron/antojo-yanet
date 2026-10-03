/**
 * Routing evaluation for DulceBot: given a user message and role, does the model
 * choose the expected tool (or answer directly)? This is the equivalent of the
 * classification step in the course pipeline (Clase 4 — mensaje → clasificación →
 * RAG → prompt → respuesta → evaluación), where function calling plays the role of
 * the intent classifier. Results are reported as accuracy plus a confusion matrix,
 * the same metric used in the "El Comandero" notebook.
 *
 * Calls the real Groq API (one request per case, no tools are executed), so it runs
 * only with `npm run eval` and needs GROQ_API_KEY. The free tier allows ~8,000
 * tokens per minute and each case uses ~3,000, so failed calls are retried with a
 * back-off instead of being counted as wrong answers.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { cargarDocumentos } from '../../src/lib/rag';
import { decidirHerramienta } from '../../src/services/asistente.service';

/**
 * A labelled routing case: the message, the role that sends it and the tool the
 * model is expected to call ('NINGUNA' = answer directly from the RAG context).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
interface CasoRuteo {
  mensaje: string;
  rol?: string;
  esperada: string;
}

/**
 * Benchmark set. Covers the three bugs fixed earlier (availability vs. purchase,
 * "X de Y" names, ambiguous products), the knowledge-base questions that must be
 * answered from RAG without tools, off-topic messages and one task per staff role.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const CASOS: CasoRuteo[] = [
  // Disponibilidad y precio → búsqueda, nunca carrito (Bug 2)
  { mensaje: '¿Vendes pan?', esperada: 'buscar_en_menu' },
  { mensaje: '¿Tienen conchas?', esperada: 'buscar_en_menu' },
  { mensaje: '¿Cuánto cuesta el churro de chocolate?', esperada: 'buscar_en_menu' },
  { mensaje: '¿Qué pasteles tienen?', esperada: 'buscar_en_menu' },
  // Intención explícita de compra → carrito (Bugs 1 y 3)
  { mensaje: 'Quiero 2 conchas de vainilla', esperada: 'agregar_al_carrito' },
  { mensaje: 'Dame una galleta de jamoncillo', esperada: 'agregar_al_carrito' },
  { mensaje: 'Agrega una galleta a mi carrito', esperada: 'agregar_al_carrito' },
  // Inventario, pedidos y encargos
  { mensaje: '¿Cuántas conchas de chocolate les quedan en existencia?', esperada: 'consultar_stock' },
  { mensaje: '¿Cómo va mi pedido 15?', esperada: 'consultar_pedido' },
  { mensaje: 'Quiero encargar un pastel de tres leches para el sábado', esperada: 'iniciar_encargo' },
  { mensaje: 'Necesito un pastel personalizado para 30 personas', esperada: 'iniciar_encargo' },
  // Conocimiento del negocio → respuesta directa desde el RAG
  { mensaje: '¿A qué hora abren el domingo?', esperada: 'NINGUNA' },
  { mensaje: '¿Cuánto cuesta el envío a domicilio?', esperada: 'NINGUNA' },
  { mensaje: '¿Qué pasa si cancelo mi encargo dos días antes?', esperada: 'NINGUNA' },
  // Saludos y temas ajenos
  { mensaje: 'Hola, buenos días', esperada: 'NINGUNA' },
  { mensaje: '¿Quién ganó el partido de ayer?', esperada: 'NINGUNA' },
  // Staff
  { mensaje: '¿Cuántos pedidos activos hay?', rol: 'CAJERO', esperada: 'listar_pedidos_activos' },
  { mensaje: 'Pasa el pedido 12 a EN_PREPARACION', rol: 'CAJERO', esperada: 'cambiar_estatus_pedido' },
  { mensaje: '¿Qué entregas tengo pendientes?', rol: 'REPARTIDOR', esperada: 'mis_pedidos_asignados' },
  { mensaje: '¿Qué tengo que hornear hoy?', rol: 'MAESTRO_PANADERO', esperada: 'mis_tareas' },
  { mensaje: '¿Cómo van las ventas de esta semana?', rol: 'ADMIN', esperada: 'ver_reporte_ventas' },
];

/**
 * Minimum routing accuracy required for the suite to pass.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const UMBRAL_PRECISION = 0.8;

/**
 * Waits for the given number of milliseconds.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} ms - Delay in milliseconds.
 * @returns {Promise<void>}
 */
const esperar = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Asks the model for its routing decision, retrying on API errors (typically the
 * free-tier tokens-per-minute limit) so transient failures are not scored as misses.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {CasoRuteo} caso - The case to evaluate.
 * @returns {Promise<string>} The tool chosen by the model, or 'NINGUNA'.
 */
async function decidirConReintento(caso: CasoRuteo): Promise<string> {
  const auth = caso.rol ? { usuarioId: 1, rol: caso.rol } : undefined;
  for (let intento = 1; ; intento++) {
    try {
      return await decidirHerramienta(caso.mensaje, auth);
    } catch (e) {
      if (intento >= 4) throw e;
      await esperar(30_000 * intento);
    }
  }
}

/**
 * Renders a confusion matrix (rows = expected, columns = predicted) as a text table.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {{ esperada: string; obtenida: string }[]} resultados - Scored cases.
 * @returns {string} The formatted matrix.
 */
function matrizConfusion(resultados: { esperada: string; obtenida: string }[]): string {
  const etiquetas = [...new Set(resultados.flatMap((r) => [r.esperada, r.obtenida]))].sort();
  const abreviar = (s: string) => s.slice(0, 10).padStart(10);
  const filas = etiquetas.map((esperada) => {
    const celdas = etiquetas.map((obtenida) => {
      const n = resultados.filter((r) => r.esperada === esperada && r.obtenida === obtenida).length;
      return String(n || '.').padStart(10);
    });
    return `${esperada.padEnd(24)}${celdas.join(' ')}`;
  });
  return [`${'esperada \\ obtenida'.padEnd(24)}${etiquetas.map(abreviar).join(' ')}`, ...filas].join('\n');
}

beforeAll(async () => {
  await cargarDocumentos();
});

describe('Evaluación de ruteo de DulceBot (mensaje → herramienta)', () => {
  it.skipIf(!process.env.GROQ_API_KEY)(`precisión de ruteo ≥ ${UMBRAL_PRECISION * 100} %`, async () => {
    const resultados: { mensaje: string; rol: string; esperada: string; obtenida: string }[] = [];

    for (const caso of CASOS) {
      const obtenida = await decidirConReintento(caso);
      resultados.push({ mensaje: caso.mensaje, rol: caso.rol ?? 'INVITADO', esperada: caso.esperada, obtenida });
      console.log(`${obtenida === caso.esperada ? '✅' : '❌'} [${caso.rol ?? 'INVITADO'}] "${caso.mensaje}" → ${obtenida} (esperada: ${caso.esperada})`);
    }

    const aciertos = resultados.filter((r) => r.obtenida === r.esperada).length;
    const precision = aciertos / resultados.length;
    console.log(`\nPrecisión de ruteo: ${aciertos}/${resultados.length} (${(precision * 100).toFixed(0)}%)\n`);
    console.log(matrizConfusion(resultados));

    expect(precision).toBeGreaterThanOrEqual(UMBRAL_PRECISION);
  });
});
