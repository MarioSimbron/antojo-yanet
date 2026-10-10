/**
 * WhatsApp channel for DulceBot through the Twilio Sandbox. Receives Twilio webhooks,
 * dedups them by MessageSid, processes one message at a time per phone number and replies
 * inside the same HTTP response as TwiML <Message> (no REST call, no KYC needed). When
 * DulceBot takes longer than the TwiML deadline, the webhook is acknowledged empty and the
 * reply is sent afterwards through the Twilio REST API.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import express, { Router, type Request, type Response, type NextFunction } from 'express';
import twilio from 'twilio';
import { procesarMensajeChat } from '../services/asistente.service.js';
import { twilioClient, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } from '../lib/twilio-client.js';

/** WhatsApp rejects message bodies longer than 1600 characters (Twilio error 21617). */
const MAX_CARACTERES = 1600;

/** Twilio drops the webhook after 15 s, so the TwiML reply must be ready before this. */
const LIMITE_TWIML_MS = 12_000;

/** Human hints for the Twilio error codes we expect while running on the Sandbox. */
const PISTAS_ERROR: Record<number, string> = {
  20003: 'la cuenta no tiene aprobado el perfil KYC (Trust Hub) para enviar por la API REST',
  21608: 'cuenta trial: el número destino no está verificado',
  21617: 'el mensaje excede 1600 caracteres',
  21654: 'restricción del sandbox (ContentSid)',
  63015: 'el número no se ha unido al sandbox (debe enviar "join <código>")',
  63016: 'fuera de la ventana de 24 h de WhatsApp',
};

const processedSids = new Set<string>();
const locks = new Map<string, Promise<void>>();

/**
 * Normalizes a Twilio WhatsApp sender into a bare phone number used as the DulceBot
 * sessionId. Mexican mobile numbers sent as 521 + 10 digits are reduced to 52 + 10 digits.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} from - Twilio `From` value, e.g. "whatsapp:+5215598765432".
 * @returns {string} Digits only, e.g. "525598765432".
 */
export function normalizePhoneNumber(from: string): string {
  const numero = from.replace(/^whatsapp:/, '').replace('+', '');
  if (numero.startsWith('521') && numero.length === 13) return `52${numero.slice(3)}`;
  return numero;
}

/**
 * Splits a reply into chunks WhatsApp accepts, cutting at a line break or a space when
 * possible so words are not broken.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} texto - Full reply text.
 * @param {number} [max=1600] - Maximum characters per chunk.
 * @returns {string[]} Non-empty chunks, in order.
 */
export function dividirMensaje(texto: string, max = MAX_CARACTERES): string[] {
  const partes: string[] = [];
  let resto = texto.trim();
  while (resto.length > max) {
    let corte = resto.lastIndexOf('\n', max);
    if (corte <= 0) corte = resto.lastIndexOf(' ', max);
    if (corte <= 0) corte = max;
    partes.push(resto.slice(0, corte).trim());
    resto = resto.slice(corte).trim();
  }
  if (resto) partes.push(resto);
  return partes;
}

/**
 * Runs a task after every previous task queued for the same phone number, so two
 * messages from one person are processed in order and never in parallel. A failing
 * task is logged and does not block the queue.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} numero - Normalized phone number (queue key).
 * @param {() => Promise<T>} tarea - Work to run in turn.
 * @returns {Promise<T | undefined>} The task result, or undefined if it failed (never rejects).
 */
export function encolarPorNumero<T>(numero: string, tarea: () => Promise<T>): Promise<T | undefined> {
  const previa = locks.get(numero) ?? Promise.resolve();
  const actual = previa.then(tarea).catch((err) => {
    console.error(`[whatsapp] Error procesando mensaje de ${numero}:`, err);
    return undefined;
  });
  const turno = actual.then(() => undefined);
  locks.set(numero, turno);
  void turno.then(() => {
    if (locks.get(numero) === turno) locks.delete(numero);
  });
  return actual;
}

/**
 * Asks DulceBot for a reply (the normalized number is the sessionId, so history persists
 * per phone) and splits it into WhatsApp-sized chunks. Errors are logged, never rethrown.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} numero - Normalized phone number used as sessionId.
 * @param {string} body - Text the customer wrote.
 * @returns {Promise<string[]>} Reply chunks; empty when DulceBot failed or replied nothing.
 */
async function generarRespuesta(numero: string, body: string): Promise<string[]> {
  try {
    const { respuesta } = await procesarMensajeChat(body, numero);
    const partes = dividirMensaje(respuesta ?? '');
    if (partes.length === 0) {
      console.warn(`[whatsapp] DulceBot devolvió una respuesta vacía para ${numero}; no se envía nada`);
    }
    return partes;
  } catch (err) {
    console.error(`[whatsapp] DulceBot falló con el mensaje de ${numero}:`, err);
    return [];
  }
}

/**
 * Sends reply chunks through the Twilio REST API (fallback for slow replies). A Twilio
 * failure is logged with its error code and a hint, without rethrowing.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} numero - Normalized phone number the reply is for.
 * @param {string} destino - Original Twilio `From` value the reply is sent to.
 * @param {string[]} partes - Reply chunks to send in order.
 * @returns {Promise<void>} Resolves when sent or when the failure was logged.
 */
async function enviarPorRest(numero: string, destino: string, partes: string[]) {
  try {
    for (const parte of partes) {
      await twilioClient?.messages.create({ from: TWILIO_WHATSAPP_FROM, to: destino, body: parte });
    }
    console.log(`[whatsapp] Respuesta enviada por REST a ${numero} (${partes.length} parte(s))`);
  } catch (err) {
    const { code, message } = err as { code?: number; message?: string };
    const pista = code ? PISTAS_ERROR[code] : undefined;
    console.error(
      `[whatsapp] Twilio no pudo enviar a ${numero} (código ${code ?? 'desconocido'}): ${message ?? err}` +
        (pista ? ` — ${pista}` : ''),
    );
  }
}

/**
 * Writes a TwiML response with one <Message> per chunk (an empty <Response/> when there
 * is nothing to say). The Twilio helper escapes XML special characters.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {Response} res - Express response.
 * @param {string[]} partes - Reply chunks.
 * @returns {void}
 */
function responderTwiml(res: Response, partes: string[]) {
  const twiml = new twilio.twiml.MessagingResponse();
  partes.forEach((parte) => twiml.message(parte));
  res.type('text/xml').send(twiml.toString());
}

/**
 * Express middleware that rejects requests whose X-Twilio-Signature does not match.
 * The public URL is rebuilt from the proxy headers so it works behind ngrok or Render.
 * Set TWILIO_SKIP_SIGNATURE=true to disable it for local curl tests.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {Request} req - Incoming Twilio request (body already parsed).
 * @param {Response} res - Express response.
 * @param {NextFunction} next - Continues to the webhook handler when valid.
 * @returns {void}
 */
function validarFirmaTwilio(req: Request, res: Response, next: NextFunction) {
  if (process.env.TWILIO_SKIP_SIGNATURE === 'true') return next();
  const protocolo = req.get('x-forwarded-proto')?.split(',')[0] ?? req.protocol;
  const url = `${protocolo}://${req.get('host')}${req.originalUrl}`;
  const firma = req.get('x-twilio-signature') ?? '';
  if (twilio.validateRequest(TWILIO_AUTH_TOKEN, firma, url, req.body ?? {})) return next();
  console.warn(`[whatsapp] Firma de Twilio inválida para ${url}; petición rechazada`);
  res.status(403).send('Firma inválida');
}

/**
 * POST /webhook handler: ignores duplicates (same MessageSid) and messages without text,
 * queues the rest per phone number and answers with DulceBot's reply as TwiML. If the
 * reply is not ready within the deadline (WHATSAPP_TWIML_TIMEOUT_MS, default 12 s), it
 * answers empty and sends the reply later through the REST API.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {Request} req - Twilio form-encoded request with From, Body and MessageSid.
 * @param {Response} res - Express response (always 200 with TwiML).
 * @returns {Promise<void>} Resolves once the HTTP response has been sent.
 */
async function recibirMensaje(req: Request, res: Response) {
  const { From, Body, MessageSid } = (req.body ?? {}) as Partial<Record<'From' | 'Body' | 'MessageSid', string>>;
  if (!From || !MessageSid || processedSids.has(MessageSid)) return responderTwiml(res, []);
  processedSids.add(MessageSid);

  const numero = normalizePhoneNumber(From);
  if (!Body?.trim()) {
    console.log(`[whatsapp] Mensaje sin texto de ${numero} (${MessageSid}); se ignora`);
    return responderTwiml(res, []);
  }
  console.log(`[whatsapp] Mensaje ${MessageSid} recibido de ${numero}`);

  const inicio = Date.now();
  const limiteMs = Number(process.env.WHATSAPP_TWIML_TIMEOUT_MS) || LIMITE_TWIML_MS;
  const respuesta = encolarPorNumero(numero, () => generarRespuesta(numero, Body));
  let temporizador: NodeJS.Timeout | undefined;
  const limite = new Promise<null>((resolver) => {
    temporizador = setTimeout(() => resolver(null), limiteMs);
  });
  const partes = await Promise.race([respuesta, limite]);
  clearTimeout(temporizador);

  if (partes === null) {
    console.warn(`[whatsapp] DulceBot tardó más de ${limiteMs} ms con ${numero}; la respuesta irá por REST`);
    responderTwiml(res, []);
    void respuesta.then((tardias) => (tardias?.length ? enviarPorRest(numero, From, tardias) : undefined));
    return;
  }
  responderTwiml(res, partes ?? []);
  if (partes?.length) {
    console.log(`[whatsapp] Respuesta a ${numero} por TwiML en ${Date.now() - inicio} ms (${partes.length} parte(s))`);
  }
}

export const whatsappRouter = Router();
whatsappRouter.post('/webhook', express.urlencoded({ extended: false }), validarFirmaTwilio, recibirMensaje);
