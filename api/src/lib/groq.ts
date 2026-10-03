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
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
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
 * Type guard that tells whether a value is a GroqError.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {unknown} r - Value to check (usually the result of llamarGroq).
 * @returns {boolean} true if `r` is a GroqError.
 */
export function esError(r: unknown): r is GroqError {
  return typeof r === 'object' && r !== null && (r as GroqError).type === 'groq_error';
}
