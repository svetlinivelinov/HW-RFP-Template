import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { initializeDatabase } from './db.js';
import { draftRoutes } from './routes/drafts.js';
import { fileRoutes } from './routes/files.js';
import { templateRoutes } from './routes/template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const HOST = process.env.HOST || '0.0.0.0';
const isProd = process.env.NODE_ENV === 'production';

async function start() {
  const fastify = Fastify({
    logger: true,
    bodyLimit: 50 * 1024 * 1024, // 50 MB — needed for DOCX uploads
  });

  // Register CORS (only needed in dev when running separate servers)
  if (!isProd) {
    await fastify.register(cors, {
      origin: true,
    });
  }

  // Initialize database
  initializeDatabase();

  // Register multipart plugin (needed for block content ingestion)
  // fileSize limit raised to 50 MB — DOCX files from large proposals can be several MB
  await fastify.register((await import('@fastify/multipart')).default, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50 MB
      fieldSize: 1 * 1024 * 1024, // 1 MB per text field
      files: 1,
    },
  });

  // Register API routes
  await fastify.register(draftRoutes, { prefix: '/api/drafts' });
  await fastify.register(fileRoutes, { prefix: '/api' });
  await fastify.register(templateRoutes, { prefix: '/api/template' });
    // Register block content ingestion routes
    const { blockContentRoutes } = await import('./routes/block-content.js');
    await fastify.register(blockContentRoutes, { prefix: '/api' });

  // Health check
  fastify.get('/api/health', async () => {
    return { status: 'ok' };
  });

  // Serve static files in production
  if (isProd) {
    const webDistPath = resolve(__dirname, '../../web/dist');
    
    if (existsSync(webDistPath)) {
      await fastify.register(fastifyStatic, {
        root: webDistPath,
        prefix: '/',
      });

      // SPA fallback - serve index.html for non-API routes
      fastify.setNotFoundHandler((request, reply) => {
        if (!request.url.startsWith('/api')) {
          return reply.sendFile('index.html');
        }
        return reply.status(404).send({ error: 'Not found' });
      });
    }
  }

  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`Server listening on http://${HOST}:${PORT}`);
    if (isProd) {
      console.log('Production mode: serving static files');
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
