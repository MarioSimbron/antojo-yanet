/**
 * API entry point for Antojo de Yanet. Wires Express, Apollo GraphQL, Socket.IO and
 * the RAG knowledge base, then starts the HTTP server.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
import 'dotenv/config';
import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { expressMiddleware } from '@apollo/server/express4';
import { buildApolloServer } from './graphql/createServer.js';

import { buildContext } from './middleware/auth.js';
import { iniciarSocketIO } from './services/socket.service.js';
import { cargarDocumentos } from './lib/rag.js';
import { generarMenuMd } from './lib/menu-generator.js';
import { PrismaClient } from '@prisma/client';
import { verificarToken } from './lib/jwt.js';

const prismaGlobal = new PrismaClient();

/**
 * Bootstraps the server: configures Express middleware and the /health endpoint, mounts
 * Apollo at /graphql, attaches Socket.IO, generates menu.md, loads RAG documents and
 * starts listening on PORT (default 4000).
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 * @returns {Promise<void>} Resolves once the server has been started.
 */
async function main() {
  const app = express();
  const PORT = process.env.PORT ?? 4000;

  app.use(cors({ origin: process.env.CORS_ORIGIN }));
  app.use(express.json({ limit: '5mb' }));

  // Serve uploaded product images as static files at /uploads/*
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  /**
   * POST /upload-imagen — accepts a single `imagen` file (≤2 MB, images only),
   * saves it to the `uploads/` folder and returns its public URL.
   * @author Mario Simbron Gonzalez <simbron420@gmail.com>
   */
  const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Solo se permiten imágenes'));
    },
  });

  app.post('/upload-imagen', upload.single('imagen'), (req, res) => {
    if (!req.file) { res.status(400).json({ error: 'No se subió ningún archivo' }); return; }
    const baseUrl = process.env.API_URL ?? `http://localhost:${PORT}`;
    res.json({ url: `${baseUrl}/uploads/${req.file.filename}` });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  /**
   * GET /push/vapid-public-key — returns the VAPID public key so the frontend can
   * create a PushSubscription without bundling the key in the build.
   * @author Mario Simbron Gonzalez <simbron420@gmail.com>
   */
  app.get('/push/vapid-public-key', (_req, res) => {
    res.json({ key: process.env.VAPID_PUBLIC_KEY ?? '' });
  });

  /**
   * POST /push/suscribir — saves a Web Push subscription for the authenticated user.
   * Expects Bearer JWT in Authorization header and { endpoint, keys: { p256dh, auth } }
   * in the body. Upserts to avoid duplicate entries for the same user+endpoint pair.
   * @author Mario Simbron Gonzalez <simbron420@gmail.com>
   */
  app.post('/push/suscribir', async (req, res) => {
    try {
      const authHeader = req.headers.authorization ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!token) { res.status(401).json({ error: 'No autorizado' }); return; }
      const payload = verificarToken(token, 'access');
      const { endpoint, keys } = req.body as { endpoint: string; keys: { p256dh: string; auth: string } };
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        res.status(400).json({ error: 'Suscripción inválida' }); return;
      }
      const existing = await prismaGlobal.pushSubscription.findFirst({
        where: { usuarioId: payload.usuarioId, endpoint },
      });
      if (existing) {
        await prismaGlobal.pushSubscription.update({
          where: { id: existing.id },
          data: { p256dh: keys.p256dh, auth: keys.auth },
        });
      } else {
        await prismaGlobal.pushSubscription.create({
          data: { usuarioId: payload.usuarioId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
        });
      }
      res.json({ ok: true });
    } catch {
      res.status(401).json({ error: 'Token inválido' });
    }
  });

  const apolloServer = buildApolloServer();
  await apolloServer.start();

  app.use(
    '/graphql',
    expressMiddleware(apolloServer, {
      context: async ({ req }) => buildContext({ req }),
    }),
  );

  const server = http.createServer(app);
  iniciarSocketIO(server);

  // Generate menu.md and load RAG documents on startup
  try {
    await generarMenuMd();
  } catch (e) {
    console.warn('No se pudo generar menu.md:', e);
  }
  await cargarDocumentos();

  server.listen(PORT, () => {
    console.log(`API escuchando en http://localhost:${PORT}`);
    console.log(`GraphQL en http://localhost:${PORT}/graphql`);
  });
}

main().catch(console.error);
