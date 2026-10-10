/**
 * Unit tests for the Twilio WhatsApp channel: phone normalization, reply splitting,
 * per-number queue, MessageSid dedup, TwiML replies, REST fallback for slow replies,
 * signature validation, error handling and the disabled state when TWILIO_* variables
 * are missing. DulceBot and the Twilio REST client are mocked; the router runs on a real
 * Express server on an ephemeral port.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import twilio from 'twilio';

const { mockProcesar, mockCreate } = vi.hoisted(() => ({
  mockProcesar: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('../../src/services/asistente.service', () => ({ procesarMensajeChat: mockProcesar }));
vi.mock('../../src/lib/twilio-client', () => ({
  twilioClient: { messages: { create: mockCreate } },
  TWILIO_AUTH_TOKEN: 'token-de-prueba',
  TWILIO_WHATSAPP_FROM: 'whatsapp:+14155238886',
}));

import {
  normalizePhoneNumber,
  dividirMensaje,
  encolarPorNumero,
  whatsappRouter,
} from '../../src/routes/whatsapp';

let server: Server;
let baseUrl: string;

/**
 * Posts a Twilio-like form-encoded webhook to the test server.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {Record<string, string>} campos - Form fields (From, Body, MessageSid).
 * @param {Record<string, string>} [headers] - Extra headers, e.g. X-Twilio-Signature.
 * @returns {Promise<Response>} The fetch response.
 */
function enviar(campos: Record<string, string>, headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}/whatsapp/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(campos).toString(),
  });
}

/**
 * Extracts the text of every <Message> in a TwiML response.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {string} xml - TwiML body.
 * @returns {string[]} Message texts, still XML-escaped.
 */
function mensajes(xml: string): string[] {
  return [...xml.matchAll(/<Message>([\s\S]*?)<\/Message>/g)].map((m) => m[1]);
}

/**
 * Creates a promise whose resolution is controlled by the test.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {{ promesa: Promise<{ respuesta: string }>, resolver: (texto: string) => void }}
 */
function diferida() {
  let resolver!: (texto: string) => void;
  const promesa = new Promise<{ respuesta: string }>((ok) => {
    resolver = (texto) => ok({ respuesta: texto });
  });
  return { promesa, resolver };
}

/**
 * Waits the given milliseconds.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

beforeAll(async () => {
  process.env.TWILIO_SKIP_SIGNATURE = 'true';
  const app = express();
  app.use('/whatsapp', whatsappRouter);
  server = app.listen(0);
  await new Promise((ok) => server.once('listening', ok));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  delete process.env.TWILIO_SKIP_SIGNATURE;
  server.close();
});

beforeEach(() => {
  mockProcesar.mockReset().mockResolvedValue({ respuesta: 'Hola, soy DulceBot', accion: 'NINGUNA' });
  mockCreate.mockReset().mockResolvedValue({ sid: 'SM_RESPUESTA' });
});

describe('normalizePhoneNumber', () => {
  it('quita el 1 de los números móviles de México (521 + 10 dígitos)', () => {
    expect(normalizePhoneNumber('whatsapp:+5215598765432')).toBe('525598765432');
  });

  it('solo limpia un número de México sin el 1', () => {
    expect(normalizePhoneNumber('whatsapp:+525512345678')).toBe('525512345678');
  });

  it('solo limpia números de otros países', () => {
    expect(normalizePhoneNumber('whatsapp:+11234567890')).toBe('11234567890');
  });
});

describe('dividirMensaje', () => {
  it('no divide un texto corto', () => {
    expect(dividirMensaje('Hola')).toEqual(['Hola']);
  });

  it('devuelve un arreglo vacío para un texto en blanco', () => {
    expect(dividirMensaje('   ')).toEqual([]);
  });

  it('divide en partes de máximo 1600 caracteres sin cortar palabras', () => {
    const texto = Array.from({ length: 700 }, (_, i) => `pan${i}`).join(' ');
    const partes = dividirMensaje(texto);
    expect(partes.length).toBeGreaterThan(1);
    partes.forEach((p) => expect(p.length).toBeLessThanOrEqual(1600));
    expect(partes.join(' ')).toBe(texto);
  });

  it('corta un texto sin espacios exactamente en el máximo', () => {
    expect(dividirMensaje('a'.repeat(25), 10)).toEqual(['a'.repeat(10), 'a'.repeat(10), 'a'.repeat(5)]);
  });
});

describe('encolarPorNumero', () => {
  it('una tarea fallida no rompe la cola del número', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const p1 = encolarPorNumero('cola-1', async () => {
      throw new Error('falla');
    });
    const p2 = encolarPorNumero('cola-1', async () => 'segunda');
    await expect(p1).resolves.toBeUndefined();
    await expect(p2).resolves.toBe('segunda');
    errorSpy.mockRestore();
  });
});

describe('POST /whatsapp/webhook', () => {
  it('responde con la respuesta de DulceBot como TwiML, sin usar la API REST', async () => {
    const res = await enviar({ From: 'whatsapp:+5210000000001', Body: 'Hola', MessageSid: 'SM_T_TWIML' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/xml');
    expect(mensajes(await res.text())).toEqual(['Hola, soy DulceBot']);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('pasa el número normalizado como sessionId', async () => {
    await enviar({ From: 'whatsapp:+5215598765432', Body: '¿Qué tienen de pan?', MessageSid: 'SM_T_SESION' });
    expect(mockProcesar).toHaveBeenCalledWith('¿Qué tienen de pan?', '525598765432');
  });

  it('escapa los caracteres especiales de XML en la respuesta', async () => {
    mockProcesar.mockResolvedValueOnce({ respuesta: 'Pan & café <recién> hecho' });
    const res = await enviar({ From: 'whatsapp:+5210000000002', Body: 'Hola', MessageSid: 'SM_T_XML' });
    expect(mensajes(await res.text())).toEqual(['Pan &amp; café &lt;recién&gt; hecho']);
  });

  it('no procesa dos veces un MessageSid repetido', async () => {
    const campos = { From: 'whatsapp:+5210000000003', Body: 'Hola', MessageSid: 'SM_T_DUP' };
    const r1 = await enviar(campos);
    const r2 = await enviar(campos);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(mensajes(await r1.text())).toHaveLength(1);
    expect(mensajes(await r2.text())).toHaveLength(0);
    expect(mockProcesar).toHaveBeenCalledTimes(1);
  });

  it('procesa en orden, no en paralelo, dos mensajes seguidos del mismo número', async () => {
    const primera = diferida();
    mockProcesar.mockReturnValueOnce(primera.promesa).mockResolvedValueOnce({ respuesta: 'respuesta 2' });
    const From = 'whatsapp:+5210000000004';
    const r1 = enviar({ From, Body: 'mensaje 1', MessageSid: 'SM_T_ORDEN_1' });
    await esperar(50);
    const r2 = enviar({ From, Body: 'mensaje 2', MessageSid: 'SM_T_ORDEN_2' });

    await esperar(50);
    expect(mockProcesar).toHaveBeenCalledTimes(1);

    primera.resolver('respuesta 1');
    expect(mensajes(await (await r1).text())).toEqual(['respuesta 1']);
    expect(mensajes(await (await r2).text())).toEqual(['respuesta 2']);
    expect(mockProcesar.mock.calls.map((c) => c[0])).toEqual(['mensaje 1', 'mensaje 2']);
  });

  it('divide respuestas largas en varios <Message> de máximo 1600 caracteres', async () => {
    mockProcesar.mockResolvedValueOnce({ respuesta: Array.from({ length: 700 }, () => 'concha').join(' ') });
    const res = await enviar({ From: 'whatsapp:+5210000000005', Body: 'Menú completo', MessageSid: 'SM_T_LARGO' });
    const partes = mensajes(await res.text());
    expect(partes).toHaveLength(4);
    partes.forEach((p) => expect(p.length).toBeLessThanOrEqual(1600));
  });

  it('ignora mensajes sin texto (multimedia) sin llamar a DulceBot', async () => {
    const res = await enviar({ From: 'whatsapp:+5210000000006', Body: '', MessageSid: 'SM_T_MEDIA' });
    expect(res.status).toBe(200);
    expect(mensajes(await res.text())).toHaveLength(0);
    expect(mockProcesar).not.toHaveBeenCalled();
  });

  it('responde vacío y no envía nada si DulceBot lanza una excepción', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockProcesar.mockRejectedValueOnce(new Error('Prisma caído'));
    const res = await enviar({ From: 'whatsapp:+5210000000007', Body: 'Hola', MessageSid: 'SM_T_EXC' });
    expect(res.status).toBe(200);
    expect(mensajes(await res.text())).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('no responde un mensaje vacío', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockProcesar.mockResolvedValueOnce({ respuesta: '   ' });
    const res = await enviar({ From: 'whatsapp:+5210000000008', Body: 'Hola', MessageSid: 'SM_T_VACIA' });
    expect(mensajes(await res.text())).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  describe('respuesta lenta (respaldo por REST)', () => {
    beforeAll(() => {
      process.env.WHATSAPP_TWIML_TIMEOUT_MS = '100';
    });
    afterAll(() => {
      delete process.env.WHATSAPP_TWIML_TIMEOUT_MS;
    });

    it('responde vacío al llegar al límite y después envía la respuesta por REST', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const lenta = diferida();
      mockProcesar.mockReturnValueOnce(lenta.promesa);
      const inicio = Date.now();
      const res = await enviar({ From: 'whatsapp:+5215598765432', Body: 'Hola', MessageSid: 'SM_T_LENTA' });
      expect(Date.now() - inicio).toBeLessThan(500);
      expect(mensajes(await res.text())).toHaveLength(0);
      expect(mockCreate).not.toHaveBeenCalled();

      lenta.resolver('respuesta tardía');
      await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
      expect(mockCreate).toHaveBeenCalledWith({
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:+5215598765432',
        body: 'respuesta tardía',
      });
      warnSpy.mockRestore();
    });

    it('un error de Twilio en el respaldo se registra con su código y no derrumba el proceso', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const lenta = diferida();
      mockProcesar.mockReturnValueOnce(lenta.promesa);
      mockCreate.mockRejectedValueOnce(Object.assign(new Error('KYC pendiente'), { code: 20003 }));
      await enviar({ From: 'whatsapp:+5210000000009', Body: 'Hola', MessageSid: 'SM_T_TWILIO' });
      lenta.resolver('tarde');
      await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());
      expect(String(errorSpy.mock.calls[0][0])).toContain('20003');
      errorSpy.mockRestore();
      warnSpy.mockRestore();

      // The server keeps answering after the failure
      const res = await enviar({ From: 'whatsapp:+5210000000009', Body: 'Hola', MessageSid: 'SM_T_TWILIO_2' });
      expect(res.status).toBe(200);
    });
  });

  describe('firma X-Twilio-Signature', () => {
    beforeAll(() => {
      delete process.env.TWILIO_SKIP_SIGNATURE;
    });
    afterAll(() => {
      process.env.TWILIO_SKIP_SIGNATURE = 'true';
    });

    it('rechaza con 403 una petición con firma inválida', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const res = await enviar(
        { From: 'whatsapp:+5210000000010', Body: 'Hola', MessageSid: 'SM_T_FIRMA_MALA' },
        { 'X-Twilio-Signature': 'firma-falsa' },
      );
      expect(res.status).toBe(403);
      expect(mockProcesar).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('acepta una petición firmada correctamente', async () => {
      const campos = { From: 'whatsapp:+5210000000011', Body: 'Hola', MessageSid: 'SM_T_FIRMA_OK' };
      const firma = twilio.getExpectedTwilioSignature('token-de-prueba', `${baseUrl}/whatsapp/webhook`, campos);
      const res = await enviar(campos, { 'X-Twilio-Signature': firma });
      expect(res.status).toBe(200);
      expect(mensajes(await res.text())).toEqual(['Hola, soy DulceBot']);
    });
  });
});

describe('twilio-client', () => {
  const VARIABLES = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM'];
  const originales = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]));

  afterAll(() => {
    VARIABLES.forEach((v) => {
      if (originales[v] === undefined) delete process.env[v];
      else process.env[v] = originales[v];
    });
  });

  it('el cliente es null cuando faltan las variables TWILIO_*', async () => {
    VARIABLES.forEach((v) => delete process.env[v]);
    vi.resetModules();
    const real = await vi.importActual<typeof import('../../src/lib/twilio-client')>('../../src/lib/twilio-client');
    expect(real.twilioClient).toBeNull();
  });

  it('crea el cliente cuando las tres variables están definidas', async () => {
    process.env.TWILIO_ACCOUNT_SID = `AC${'0'.repeat(32)}`;
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';
    vi.resetModules();
    const real = await vi.importActual<typeof import('../../src/lib/twilio-client')>('../../src/lib/twilio-client');
    expect(real.twilioClient).not.toBeNull();
  });
});
