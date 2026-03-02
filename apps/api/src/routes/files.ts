import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { draftRepository, fileRepository } from '../db.js';
import { render } from '@packages/template-engine';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const TEMPLATE_PATH = resolve(__dirname, '../../../../assets/template/master_template_v2_1_skeleton.docx');
const OUTPUT_DIR = resolve(__dirname, '../../../output');

// Ensure output directory exists
mkdirSync(OUTPUT_DIR, { recursive: true });

export async function fileRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/drafts/:draftId/render
   * Render a draft to DOCX
   */
  fastify.post('/drafts/:draftId/render', async (request, reply) => {
    const { draftId } = request.params as { draftId: string };
    
    const draft = draftRepository.findById(draftId);
    
    if (!draft) {
      return reply.status(404).send({ error: 'Draft not found' });
    }
    
    try {
      // Load template
      const templateBuffer = readFileSync(TEMPLATE_PATH);
      
      // Parse draft data
      const draftData = JSON.parse(draft.draft_json);
      
      // Render document
      const outputBuffer = await render(templateBuffer, draftData);
      
      // Save output file
      const fileId = nanoid();
      const filename = `${draft.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.docx`;
      const filePath = resolve(OUTPUT_DIR, filename);
      
      writeFileSync(filePath, outputBuffer);
      
      // Save file record
      fileRepository.create(fileId, draftId, filePath, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      
      return {
        fileId,
        filename,
      };
    } catch (err) {
      fastify.log.error({ err }, 'Failed to render document');
      return reply.status(500).send({
        error: 'Failed to render document',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/files/:id/download
   * Download a rendered file
   */
  fastify.get('/files/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const file = fileRepository.findById(id);
    
    if (!file) {
      return reply.status(404).send({ error: 'File not found' });
    }
    
    try {
      const fileBuffer = readFileSync(file.path);
      const filename = file.path.split(/[\\/]/).pop() || 'document.docx';
      
      return reply
        .header('Content-Type', file.mime)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(fileBuffer);
    } catch (err) {
      fastify.log.error({ err }, 'Failed to read file');
      return reply.status(500).send({
        error: 'Failed to read file',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/drafts/:draftId/files
   * List all files for a draft
   */
  fastify.get('/drafts/:draftId/files', async (request, reply) => {
    const { draftId } = request.params as { draftId: string };
    
    const files = fileRepository.findByDraftId(draftId);
    
    return files.map(f => ({
      id: f.id,
      filename: f.path.split(/[\\/]/).pop(),
      createdAt: f.created_at,
    }));
  });
}
