/**
 * Groq SDK wrapper with controlled error handling: a missing or invalid API key returns
 * a typed error instead of throwing.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import Groq from 'groq-sdk';

/**
 * Typed error returned when the Groq call cannot be completed.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @property {'groq_error'} type - Discriminator tag.
 * @property {string} message - Human-readable error message.
 */
export type GroqError = { type: 'groq_error'; message: string };

let groqClient: Groq | null = null;

/**
 * Groq model used by the assistant. Configurable through GROQ_MODEL because Groq
 * retires models over time; defaults to gpt-oss-20b, the tool-calling model used in
 * production and in the course pipeline (the Groq free tier no longer offers Llama
 * chat models).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {string} The model ID.
 */
function getModelo(): string {
  return process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
}

/**
 * Sampling temperature for every call. Groq defaults to 1.0, which made tool routing
 * non-deterministic: the routing evaluation showed the same message ("Quiero 2 conchas
 * de vainilla") going to agregar_al_carrito on one run and buscar_en_menu on the next.
 * A low value keeps tool selection stable while leaving some variety in the wording.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const TEMPERATURA = 0.2;

/**
 * Lazily creates the Groq client singleton.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Groq | null} The client, or null if GROQ_API_KEY is not set.
 */
function getClient(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null;
  // The free tier allows 8,000 tokens per minute and one DulceBot message uses 3–5k
  // (two calls), so quick consecutive messages hit 429 with a sub-second retry-after.
  // The SDK honours that header with back-off; 4 retries (default 2) absorb the burst.
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 4 });
  return groqClient;
}

/**
 * Chat message accepted by the Groq chat completions API.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export type GroqMessage = Groq.Chat.ChatCompletionMessageParam;

/**
 * Function-calling tool definition accepted by the Groq chat completions API.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
export type GroqTool = Groq.Chat.ChatCompletionTool;

/**
 * Calls the configured Groq model (see getModelo), optionally with tools.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {GroqMessage[]} messages - Conversation messages (system, history, user, tool).
 * @param {GroqTool[]} [tools] - Tools the model may call; enables `tool_choice: 'auto'`.
 * @returns {Promise<Groq.Chat.ChatCompletion | GroqError>} The completion, or a GroqError
 *   if the client is unavailable or the request fails.
 */
export async function llamarGroq(
  messages: GroqMessage[],
  tools?: GroqTool[],
): Promise<Groq.Chat.ChatCompletion | GroqError> {
  const client = getClient();
  if (!client) {
    return { type: 'groq_error', message: 'Asistente no disponible en este momento' };
  }

  try {
    return await client.chat.completions.create({
      model: getModelo(),
      messages,
      tools,
      tool_choice: tools ? 'auto' : undefined,
      temperature: TEMPERATURA,
      max_tokens: 1024,
    });
  } catch (e: unknown) {
    // Log the technical detail for developers; never expose it to the customer.
    console.error('[groq] Request failed:', e instanceof Error ? e.message : e);
    return {
      type: 'groq_error',
      message: 'En este momento no puedo responder. Intenta de nuevo en un momento.',
    };
  }
}

/**
 * Meta's Llama Prompt Guard 2 classifier served by Groq. The 86M variant is
 * multilingual (the 22M one only covers English), and Groq does not count its calls
 * against the daily token quota. Configurable through GROQ_GUARD_MODEL.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {string} The guard model ID.
 */
function getModeloGuard(): string {
  return process.env.GROQ_GUARD_MODEL || 'meta-llama/llama-prompt-guard-2-86m';
}

/**
 * Scores how likely a user message is a prompt-injection or jailbreak attempt using
 * Llama Prompt Guard 2. Fails open: any error (missing key, rate limit, retired model)
 * returns null so the chat keeps working without the guard.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} texto - The raw user message.
 * @returns {Promise<number | null>} Attack probability in [0, 1], or null if unavailable
 *   or disabled with DISABLE_PROMPT_GUARD.
 */
export async function evaluarPromptInjection(texto: string): Promise<number | null> {
  const client = getClient();
  if (!client || process.env.DISABLE_PROMPT_GUARD) return null;

  try {
    const r = await client.chat.completions.create({
      model: getModeloGuard(),
      // The classifier has a 512-token window; longer messages are scored on their start.
      messages: [{ role: 'user', content: texto.slice(0, 2000) }],
    });
    const score = Number.parseFloat(r.choices[0]?.message?.content ?? '');
    return Number.isFinite(score) ? score : null;
  } catch (e: unknown) {
    console.warn('[guard] Prompt Guard unavailable:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Type guard that tells whether a value is a GroqError.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {unknown} r - Value to check (usually the result of llamarGroq).
 * @returns {boolean} true if `r` is a GroqError.
 */
export function esError(r: unknown): r is GroqError {
  return typeof r === 'object' && r !== null && (r as GroqError).type === 'groq_error';
}
