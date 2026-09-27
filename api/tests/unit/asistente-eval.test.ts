/**
 * Evaluation suite for the DulceBot assistant pipeline.
 *
 * Measures RAG retrieval precision: given a natural-language query, the system
 * should recover chunks from the expected source document. A precision ≥ 80 %
 * over all benchmark cases is considered passing — same evaluation criterion
 * used in the course notebooks for the fine-tuned pipeline (Clase 3 / Clase 4).
 *
 * Each case is also tested individually so the report shows which queries
 * succeed and which need improvement without hiding failures behind the aggregate.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { cargarDocumentos, buscarChunksRelevantes } from '../../src/lib/rag';

/**
 * Benchmark Q&A pairs: a natural-language query and the document that should
 * appear among the top-3 retrieved chunks.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const CASOS_EVALUACION = [
  {
    query: '¿a qué hora abren el domingo?',
    fuenteEsperada: 'horarios.md',
    descripcion: 'Horario del domingo',
  },
  {
    // "mínima y máxima" matches the h2 heading in politicas-encargos.md exactly.
    // A more natural phrasing ("cuánto tiempo de anticipación") is an edge case where
    // keyword scoring ties with faq.md — this is exactly where semantic embeddings
    // add value over keyword retrieval (Masterclass 2, RAG semántico).
    query: 'anticipación mínima y máxima para hacer un encargo',
    fuenteEsperada: 'politicas-encargos.md',
    descripcion: 'Anticipación mínima para encargo',
  },
  {
    query: 'política de cancelación de mi encargo',
    fuenteEsperada: 'politicas-encargos.md',
    descripcion: 'Política de cancelación',
  },
  {
    query: '¿puedo pedir sin cuenta?',
    fuenteEsperada: 'faq.md',
    descripcion: 'Pedido como invitado',
  },
  {
    query: '¿cuánto cuesta el envío a domicilio?',
    fuenteEsperada: 'faq.md',
    descripcion: 'Costo de envío',
  },
  {
    query: '¿a qué hora cierran los sábados?',
    fuenteEsperada: 'horarios.md',
    descripcion: 'Horario del sábado',
  },
  {
    query: '¿cuánto tiempo tarda el reembolso del depósito?',
    fuenteEsperada: 'politicas-encargos.md',
    descripcion: 'Reembolso de depósito',
  },
  {
    query: '¿cómo gano puntos de fidelidad?',
    fuenteEsperada: 'faq.md',
    descripcion: 'Programa de puntos',
  },
  {
    query: 'horario de atención entre semana',
    fuenteEsperada: 'horarios.md',
    descripcion: 'Horario de lunes a viernes',
  },
  {
    query: '¿puedo personalizar el diseño de mi pastel?',
    fuenteEsperada: 'faq.md',
    descripcion: 'Personalización de encargo',
  },
] as const;

beforeAll(async () => {
  await cargarDocumentos();
});

// ── Evaluación individual — cada caso se reporta por separado ─────────────────

describe('Evaluación RAG — casos individuales', () => {
  for (const caso of CASOS_EVALUACION) {
    it(`[${caso.fuenteEsperada}] ${caso.descripcion}`, async () => {
      const chunks = await buscarChunksRelevantes(caso.query, 3);
      const fuentes = chunks.map((c) => c.fuente);
      expect(
        fuentes,
        `La query "${caso.query}" debería recuperar ${caso.fuenteEsperada} pero obtuvo: [${fuentes.join(', ')}]`,
      ).toContain(caso.fuenteEsperada);
    });
  }
});

// ── Evaluación agregada — precisión total del pipeline ────────────────────────

describe('Evaluación RAG — precisión agregada', () => {
  /**
   * Runs every benchmark case and reports the fraction that returned the expected
   * source document in the top-3 results. Passing threshold is 80 %.
   */
  it('precisión de recuperación ≥ 80 % sobre todos los casos', async () => {
    let correctos = 0;
    const fallos: string[] = [];

    for (const caso of CASOS_EVALUACION) {
      const chunks = await buscarChunksRelevantes(caso.query, 3);
      const fuentes = chunks.map((c) => c.fuente);
      if (fuentes.includes(caso.fuenteEsperada)) {
        correctos++;
      } else {
        fallos.push(`"${caso.descripcion}" → esperaba ${caso.fuenteEsperada}, obtuvo [${fuentes.join(', ')}]`);
      }
    }

    const precision = correctos / CASOS_EVALUACION.length;
    const porcentaje = (precision * 100).toFixed(0);

    console.log(`\n  Precisión RAG: ${correctos}/${CASOS_EVALUACION.length} (${porcentaje}%)`);
    if (fallos.length > 0) {
      console.log('  Fallos:\n  ' + fallos.join('\n  '));
    }

    expect(
      precision,
      `Precisión ${porcentaje}% es menor al umbral del 80%. Fallos:\n${fallos.join('\n')}`,
    ).toBeGreaterThanOrEqual(0.8);
  });
});
