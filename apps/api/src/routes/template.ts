import { FastifyInstance } from 'fastify';
import { parseTemplate } from '@packages/template-engine';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the built-in template
const TEMPLATE_PATH = resolve(__dirname, '../../../../assets/template/master_template_v2_1_skeleton.docx');

// Cache the manifest in memory
let cachedManifest: any = null;

export async function templateRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/template/manifest
   * Get the template manifest (blocks, placeholders, tables, statics)
   */
  fastify.get('/manifest', async (request, reply) => {
    if (cachedManifest) {
      return cachedManifest;
    }
    
    try {
      const templateBuffer = readFileSync(TEMPLATE_PATH);
      const manifest = await parseTemplate(templateBuffer);
      cachedManifest = manifest;
      return manifest;
    } catch (err) {
      fastify.log.error({ err }, 'Failed to load template');
      return reply.status(500).send({ 
        error: 'Failed to load template',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });
}
