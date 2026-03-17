import { FastifyInstance } from 'fastify';
import '@fastify/multipart';
import { nanoid } from 'nanoid';
import { blockContentRepository } from '../db.js';
import { parseDocxBlocks, normalizeContentXml, computeSha256, generatePreviewHtml } from '../utils/block-ingest.js';
import { getManifest } from '../utils/manifest-cache.js';

// POST /api/block-content/ingest
export async function blockContentRoutes(fastify: FastifyInstance) {
  // PATCH /api/block-content/:id/usage
  fastify.patch('/block-content/:id/usage', async (request, reply) => {
    const { id } = request.params as { id: string };
    const variant = blockContentRepository.findById(id);
    if (!variant) return reply.status(404).send({ error: 'Not found' });
    blockContentRepository.incrementUsage(id);
    reply.send({ success: true });
  });

  fastify.post('/block-content/ingest', async (request, reply) => {
    // Parse multipart — collect file and text fields via parts() iterator
    let buffer: Buffer | null = null;
    let sourceProject = 'unknown';
    let variantPrefix = '';
    let notes = '';

    for await (const part of request.parts()) {
      if (part.type === 'file') {
        buffer = await part.toBuffer();
      } else {
        const value = part.value as string;
        if (part.fieldname === 'sourceProject') sourceProject = value;
        else if (part.fieldname === 'variantPrefix') variantPrefix = value;
        else if (part.fieldname === 'notes') notes = value;
      }
    }

    if (!buffer) return reply.status(400).send({ error: 'No file uploaded' });

    // Get block names from skeleton manifest
    const manifest = await getManifest();
    const blockNames = manifest.blocks || [];

    // Extract block content from DOCX
    const blocks = await parseDocxBlocks(buffer as Buffer, blockNames);
    const foundNames = Object.keys(blocks);
    fastify.log.info({ foundBlocks: foundNames, totalSkeleton: blockNames.length }, 'Block ingest: parsed source DOCX');
    console.log(`[ingest] source DOCX parsed. Skeleton has ${blockNames.length} blocks. Found in source: ${foundNames.length} (${foundNames.join(', ') || 'none'})`);

    const results = [];
    for (const blockName of blockNames) {
      const contentXml = blocks[blockName];
      if (!contentXml) {
        results.push({ block_name: blockName, stored: false, reason: 'Not found in DOCX' });
        continue;
      }
      // Normalize content_xml for hashing
      const normalizedXml = normalizeContentXml(contentXml);
      // Compute SHA-256 hash
      const contentHash = computeSha256(normalizedXml);
      // Duplicate detection
      const duplicate = blockContentRepository.findByHash(blockName, contentHash);
      if (duplicate) {
        results.push({ block_name: blockName, stored: false, isDuplicate: true, duplicateOf: duplicate.id, reason: `Identical to ${duplicate.variant_name} from ${duplicate.source_project}` });
        continue;
      }
      // Generate preview_html
      const previewHtml = generatePreviewHtml(contentXml);
      // Store variant
      const variantName = variantPrefix ? `${variantPrefix}_${blockName}` : blockName;
      const id = blockContentRepository.insert({
        block_name: blockName,
        variant_name: variantName,
        source_project: sourceProject,
        content_xml: contentXml,
        preview_html: previewHtml,
        created_by: 'admin',
        version: 1,
        updated_at: null,
        updated_by: null,
        parent_id: null,
        tags: null,
        description: notes,
        usage_count: 0,
        quality_rating: null,
        content_hash: contentHash
      });
      results.push({ block_name: blockName, stored: true, block_content_id: id });
    }
    return reply.send({ ingestionId: nanoid(), results, parsedCount: foundNames.length, skeletonCount: blockNames.length, warnings: [] });
  });

  // GET /api/block-content/all — list everything in the library (debug / admin)
  fastify.get('/block-content/all', async (_request, reply) => {
    const stmt = (await import('../db.js')).db.prepare(
      'SELECT id, block_name, variant_name, source_project, created_at FROM block_content ORDER BY created_at DESC'
    );
    return reply.send(stmt.all());
  });

  // GET /api/block-content/:id/preview
  fastify.get('/block-content/:id/preview', async (request, reply) => {
    const { id } = request.params as { id: string };
    const variant = blockContentRepository.findById(id);
    if (!variant) return reply.status(404).send({ error: 'Not found' });
    reply.send({
      block_name: variant.block_name,
      variant_name: variant.variant_name,
      source_project: variant.source_project,
      preview_html: variant.preview_html
    });
  });

  // GET /api/block-content?block_name=... (optional — omit for all)
  fastify.get('/block-content', async (request, reply) => {
    const { block_name } = request.query as { block_name?: string };
    if (!block_name) return reply.status(400).send({ error: 'Missing block_name' });
    const variants = blockContentRepository.findByBlockName(block_name);
    console.log(`[block-content] GET block_name=${block_name} → ${variants.length} variants`);
    reply.send(variants);
  });
}
