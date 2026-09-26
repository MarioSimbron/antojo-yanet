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
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';

import { usuarioTypeDefs } from './graphql/typeDefs/usuario.js';
import { authTypeDefs } from './graphql/typeDefs/auth.js';
import { productoTypeDefs } from './graphql/typeDefs/producto.js';
import { pedidoTypeDefs } from './graphql/typeDefs/pedido.js';
import { asistenteTypeDefs } from './graphql/typeDefs/asistente.js';

import { authResolvers } from './graphql/resolvers/auth.resolvers.js';
import { usuarioResolvers } from './graphql/resolvers/usuario.resolvers.js';
import { productoResolvers } from './graphql/resolvers/producto.resolvers.js';
import { pedidoResolvers } from './graphql/resolvers/pedido.resolvers.js';
import { asistenteResolvers } from './graphql/resolvers/asistente.resolvers.js';

import { buildContext } from './middleware/auth.js';
import { iniciarSocketIO } from './services/socket.service.js';
import { cargarDocumentos } from './lib/rag.js';
import { generarMenuMd } from './lib/menu-generator.js';

/**
 * Root GraphQL types that every module extends with `extend type Query/Mutation`.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const baseTypeDefs = `#graphql
  type Query { _empty: String }
  type Mutation { _empty: String }
`;

/**
 * Full GraphQL schema built by merging the base types with every module's typeDefs.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const typeDefs = mergeTypeDefs([
  baseTypeDefs,
  usuarioTypeDefs,
  authTypeDefs,
  productoTypeDefs,
  pedidoTypeDefs,
  asistenteTypeDefs,
]);

/**
 * Resolver map built by merging every module's resolvers.
 * @author Mario Simbron Gonzalez <simbron420@gmail.com>
 */
const resolvers = mergeResolvers([
  authResolvers,
  usuarioResolvers,
  productoResolvers,
  pedidoResolvers,
  asistenteResolvers,
]);

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

  const apolloServer = new ApolloServer({ typeDefs, resolvers });
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
