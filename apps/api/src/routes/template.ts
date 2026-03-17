import { FastifyInstance } from 'fastify';
import { blockMetaRepository } from '../db.js';
import { getManifest } from '../utils/manifest-cache.js';

export async function templateRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/template/manifest
   * Get the template manifest (blocks, placeholders, tables, statics)
   */
  fastify.get('/manifest', async (request, reply) => {
    try {
      return await getManifest();
    } catch (err) {
      fastify.log.error({ err }, 'Failed to load template');
      return reply.status(500).send({
        error: 'Failed to load template',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/template/block-library
   * Returns all block entries merged with optional block_meta DB overrides.
   * block_meta values (title / category / description / sort_order) take priority
   * over the inferred values from the parser.
   */
  fastify.get('/block-library', async (request, reply) => {
    let manifest: Awaited<ReturnType<typeof getManifest>>;
    try {
      manifest = await getManifest();
    } catch (err) {
      fastify.log.error({ err }, 'Failed to load template for block-library');
      return reply.status(500).send({
        error: 'Failed to load template',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    const metaRows = blockMetaRepository.findAll();
    const metaMap = new Map(metaRows.map(m => [m.block_name, m]));

    const library = manifest.blockEntries.map((entry: any, idx: number) => {
      const meta = metaMap.get(entry.name);
      return {
        name: entry.name,
        title: meta?.title ?? entry.title,
        category: meta?.category ?? entry.inferredCategory,
        description: meta?.description ?? entry.description,
        sortOrder: meta?.sort_order ?? idx,
        isOptional: meta ? Boolean(meta.is_optional) : true,
        occurrences: entry.occurrences,
        fieldsUsed: entry.fieldsUsed,
        tablesUsed: entry.tablesUsed,
      };
    });

    library.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    return library;
  });

  /**
   * PATCH /api/template/block-meta
   * Upsert display metadata for a block (title, category, description, sortOrder, isOptional).
   * These values override the parser-inferred defaults in the block-library response.
   */
  fastify.patch('/block-meta', async (request, reply) => {
    const body = request.body as {
      blockName: string;
      title?: string;
      category?: string;
      description?: string;
      sortOrder?: number;
      isOptional?: boolean;
    };

    if (!body?.blockName) {
      return reply.status(400).send({ error: 'blockName is required' });
    }

    blockMetaRepository.upsert({
      block_name: body.blockName,
      title: body.title ?? null,
      category: body.category ?? null,
      description: body.description ?? null,
      sort_order: body.sortOrder,
      is_optional: body.isOptional !== undefined ? (body.isOptional ? 1 : 0) : undefined,
    });

    return { success: true };
  });
}
