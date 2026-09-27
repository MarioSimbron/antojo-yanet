/**
 * In-memory RAG with semantic embeddings: loads .md files in /docs, splits them
 * into chunks and ranks them by cosine similarity using
 * Xenova/paraphrase-multilingual-MiniLM-L12-v2 — the same model used in the
 * course notebooks (paraphrase-multilingual-MiniLM-L12-v2 via sentence-transformers).
 * Falls back to keyword scoring while the model is warming up on first run.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import fs from 'fs/promises';
import path from 'path';

/**
 * A piece of a knowledge-base document.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {string} fuente - Source file name.
 * @property {string} texto - Chunk text.
 */
export interface Chunk {
  fuente: string;
  texto: string;
}

interface ChunkIndexado extends Chunk {
  embedding: number[] | null;
}

let indice: ChunkIndexado[] = [];

// ── Embedding model ──────────────────────────────────────────────────────────

type PipelineFn = (
  text: string,
  opts: { pooling: string; normalize: boolean },
) => Promise<{ data: Float32Array }>;

let pipelineFn: PipelineFn | null = null;
let embeddingListo = false;

/**
 * Lazily loads the multilingual MiniLM embedding model (quantized ONNX,
 * ~50 MB download on first run then cached). Sets `embeddingListo` once ready.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<void>}
 */
async function inicializarEmbedder(): Promise<void> {
  try {
    // Dynamic import for CJS/ESM compatibility
    const { pipeline } = await import('@xenova/transformers');
    const pipe = await (pipeline as (
      task: string,
      model: string,
      opts: { quantized: boolean },
    ) => Promise<PipelineFn>)(
      'feature-extraction',
      'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
      { quantized: true },
    );
    pipelineFn = pipe;
    embeddingListo = true;
    console.log('[rag] Modelo de embeddings listo');
    // Compute any pending embeddings now that the model is available
    await computarEmbeddingsPendientes();
  } catch (e) {
    console.warn('[rag] Modelo de embeddings no disponible, usando keyword scoring:', e);
  }
}

/**
 * Converts text to an L2-normalized embedding vector, or returns null if the
 * model is not yet loaded.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} texto - Text to embed.
 * @returns {Promise<number[] | null>} The embedding vector, or null.
 */
async function vectorizar(texto: string): Promise<number[] | null> {
  if (!pipelineFn) return null;
  const salida = await pipelineFn(texto, { pooling: 'mean', normalize: true });
  return Array.from(salida.data);
}

/**
 * Dot product of two L2-normalized vectors equals their cosine similarity.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number[]} a - First vector.
 * @param {number[]} b - Second vector.
 * @returns {number} Cosine similarity in [-1, 1].
 */
function similitudCoseno(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// ── Keyword scoring (fallback while model loads) ─────────────────────────────

/**
 * Common Spanish stop-words excluded from keyword scoring.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'al', 'en', 'con', 'por', 'para', 'que',
  'se', 'su', 'sus', 'me', 'te', 'le', 'nos', 'les',
  'es', 'son', 'fue', 'hay', 'ya', 'si', 'no', 'mi', 'tu',
]);

/**
 * Normalizes a string for keyword matching.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} s - Raw string.
 * @returns {string} Normalized form.
 */
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');
}

/**
 * Keyword relevance score: +1 per query term found in the text, +2 when the
 * term appears in a heading. Used as fallback before embeddings are ready.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} query - Search query.
 * @param {string} texto - Chunk text.
 * @returns {number} Relevance score (0 = no match).
 */
function keywordScore(query: string, texto: string): number {
  const queryTerms = normalizar(query)
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
  const textoNorm = normalizar(texto);
  const textoHeading = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let score = 0;
  for (const term of queryTerms) {
    if (textoNorm.includes(term)) score += 1;
    const safeT = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (textoHeading.match(new RegExp(`^#{1,3}.*${safeT}`, 'm'))) score += 2;
  }
  return score;
}

// ── Document loading ─────────────────────────────────────────────────────────

/**
 * Reads every .md file in /docs and splits it into chunks at h1/h2 boundaries.
 * Starts embedding computation in the background; retrieval falls back to
 * keyword scoring until all embeddings are ready.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<Chunk[]>} The loaded chunks (empty if /docs does not exist).
 */
export async function cargarDocumentos(): Promise<Chunk[]> {
  const docsDir = path.join(process.cwd(), 'docs');
  let archivos: string[] = [];
  try {
    archivos = await fs.readdir(docsDir);
  } catch {
    return [];
  }

  const nuevos: ChunkIndexado[] = [];
  for (const archivo of archivos.filter((f) => f.endsWith('.md'))) {
    const contenido = await fs.readFile(path.join(docsDir, archivo), 'utf-8');
    const secciones = contenido.split(/\n(?=#{1,2} )/);
    for (const seccion of secciones) {
      // Require at least 80 chars so title-only stubs like "# Horarios de Antojo de Yanet"
      // are excluded — they have no useful content but score high semantically
      // because every doc title contains "Antojo de Yanet".
      if (seccion.trim().length > 80) {
        nuevos.push({ fuente: archivo, texto: seccion.trim(), embedding: null });
      }
    }
  }

  indice = nuevos;
  // Compute embeddings in the background; doesn't block the server startup
  void (embeddingListo ? computarEmbeddingsPendientes() : inicializarEmbedder());

  return indice.map(({ fuente, texto }) => ({ fuente, texto }));
}

/**
 * Computes and stores embeddings for any chunk that does not yet have one.
 * Called automatically after the embedder becomes available.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<void>}
 */
async function computarEmbeddingsPendientes(): Promise<void> {
  let actualizados = 0;
  for (const chunk of indice) {
    if (chunk.embedding === null) {
      chunk.embedding = await vectorizar(chunk.texto);
      actualizados++;
    }
  }
  if (actualizados > 0) {
    console.log(`[rag] ${actualizados} embeddings computados`);
  }
}

// ── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Minimum cosine similarity required to consider a chunk relevant. Filters out
 * chunks that happen to be the "least bad" match for off-topic queries (e.g.
 * greetings) so the system prompt stays clean and sources are not shown for
 * irrelevant messages.
 * 0.25 is the empirical sweet spot for this multilingual MiniLM model: short
 * single-word product queries ("conchas") still clear the bar while genuine
 * off-topic messages (greetings, small talk) stay below it.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const UMBRAL_SEMANTICO = 0.25;

/**
 * Returns the chunks most relevant to a query. Uses cosine similarity over
 * embeddings when the model is ready and all chunks are indexed; falls back to
 * keyword scoring otherwise — same two-step behavior as the course notebooks.
 * Only returns chunks that exceed the minimum relevance threshold so off-topic
 * queries (greetings, small talk) get an empty result rather than spurious context.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} query - Search query.
 * @param {number} [top=3] - Maximum number of chunks to return.
 * @param {string[]} [fuentes] - Optional allowlist of source files; omit to search all docs.
 * @returns {Promise<Chunk[]>} Matching chunks sorted by descending relevance.
 */
export async function buscarChunksRelevantes(query: string, top = 3, fuentes?: string[]): Promise<Chunk[]> {
  if (indice.length === 0) return [];

  const pool = fuentes ? indice.filter((c) => fuentes.includes(c.fuente)) : indice;
  if (pool.length === 0) return [];

  const todosIndexados = pool.every((c) => c.embedding !== null);
  const queryEmbedding = embeddingListo && todosIndexados ? await vectorizar(query) : null;

  if (queryEmbedding) {
    // Semantic retrieval — cosine similarity (same as np.dot in the course notebooks).
    // Apply threshold to avoid returning irrelevant chunks for off-topic queries.
    return [...pool]
      .map((c) => ({ chunk: c, score: similitudCoseno(queryEmbedding, c.embedding!) }))
      .filter((x) => x.score >= UMBRAL_SEMANTICO)
      .sort((a, b) => b.score - a.score)
      .slice(0, top)
      .map(({ chunk }) => ({ fuente: chunk.fuente, texto: chunk.texto }));
  }

  // Keyword fallback — used during cold start while the embedder loads
  return [...pool]
    .map((c) => ({ chunk: c, score: keywordScore(query, c.texto) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, top)
    .map(({ chunk }) => ({ fuente: chunk.fuente, texto: chunk.texto }));
}

/**
 * Returns true when the embedding model has finished loading and all chunks
 * have been indexed. Useful for health checks and tests.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {boolean}
 */
export function embeddingModeloListo(): boolean {
  return embeddingListo && indice.every((c) => c.embedding !== null);
}
