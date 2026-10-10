/**
 * Single Twilio REST client used by the WhatsApp channel. When the TWILIO_* variables are
 * missing or invalid the client is `null` and the channel stays disabled instead of
 * crashing the API.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import twilio from 'twilio';

export const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? '';
export const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM ?? '';

/**
 * Builds the Twilio client from the environment, or returns null when the channel is not
 * configured (or the SDK rejects the credentials format).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {twilio.Twilio | null} The Twilio client, or null when unavailable.
 */
function crearCliente(): twilio.Twilio | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  if (!accountSid || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) return null;
  try {
    return twilio(accountSid, TWILIO_AUTH_TOKEN);
  } catch (err) {
    console.error('[twilio] Credenciales inválidas, canal WhatsApp desactivado:', err);
    return null;
  }
}

export const twilioClient = crearCliente();
